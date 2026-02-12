/**
 * Nostr Service
 *
 * Handles relay connections, presence publishing/subscribing, and
 * WebRTC signaling over Nostr for the Gig Economy feature.
 *
 * Event Kinds used:
 *   30078  – Replaceable: Gig presence (discovery)
 *   4      – Encrypted DM: WebRTC signaling (offer/answer/ice)
 *   5      – Deletion: remove own presence on cleanup
 */

import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  type EventTemplate,
  type Event as NostrEvent,
} from 'nostr-tools/pure';
import { encrypt, decrypt } from 'nostr-tools/nip04';
import { logger } from '../utils/logger';

/** Convert Uint8Array to hex string. */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Constants ───────────────────────────────────────────────

/** Replaceable event kind for gig presence (NIP-33 parametrized replaceable). */
const PRESENCE_KIND = 30078;

/** Encrypted DM kind used for WebRTC signaling. */
const SIGNAL_KIND = 4;

/** Event deletion kind. */
const DELETE_KIND = 5;

/** Public Nostr relays – updated periodically. */
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.mom',
  'wss://relay.nostr.bg',
];

// ─── Types ───────────────────────────────────────────────────

export interface PresencePayload {
  geohash: string;
  role: 'rider' | 'driver';
  rideType?: 'person' | 'delivery';
  startLocation?: { latitude: number; longitude: number };
  destination?: { latitude: number; longitude: number };
}

export interface SignalPayload {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
}

export type OnPresenceCallback = (pubkey: string, payload: PresencePayload, eventId: string) => void;
export type OnSignalCallback = (fromPubkey: string, signal: SignalPayload) => void;

// ─── Service Class ───────────────────────────────────────────

export class NostrService {
  private sk: Uint8Array;
  private pk: string;
  private sockets: Map<string, WebSocket> = new Map();
  private subscriptionIds: Map<string, string[]> = new Map(); // relay → [subId]
  private onPresence: OnPresenceCallback | null = null;
  private onSignal: OnSignalCallback | null = null;
  private presenceEventId: string | null = null;
  private relays: string[];
  private closed = false;
  private seenEventIds: Set<string> = new Set(); // dedup events from multiple relays

  constructor(relays?: string[]) {
    this.sk = generateSecretKey();
    this.pk = getPublicKey(this.sk);
    this.relays = relays ?? DEFAULT_RELAYS;
    logger.info('NostrService created', { component: 'NostrService', operation: 'constructor' });
  }

  /** Our public key (hex). */
  get pubkey(): string {
    return this.pk;
  }

  /** Our secret key (hex). */
  get secretKeyHex(): string {
    return bytesToHex(this.sk);
  }

  // ─── Relay Connection ────────────────────────────────────

  /** Connect to all relays. Waits until all have connected or failed. */
  async connect(): Promise<void> {
    const results = await Promise.allSettled(
      this.relays.map(url => this.connectRelay(url))
    );
    const connected = results.filter(r => r.status === 'fulfilled').length;
    if (connected === 0) {
      logger.warn('No relay connected', { component: 'NostrService', operation: 'connect' });
    } else {
      logger.info(`Connected to ${connected}/${this.relays.length} relays`, { component: 'NostrService', operation: 'connect' });
    }
  }

  private connectRelay(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 5s timeout per relay to prevent allSettled from hanging
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout connecting to ${url}`));
      }, 5000);

      try {
        const ws = new WebSocket(url);
        ws.onopen = () => {
          clearTimeout(timeout);
          this.sockets.set(url, ws);
          logger.info(`Connected to relay ${url}`, { component: 'NostrService', operation: 'connectRelay' });
          resolve();
        };
        ws.onclose = () => {
          this.sockets.delete(url);
          this.subscriptionIds.delete(url);
        };
        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error(`Failed to connect to ${url}`));
        };
        ws.onmessage = (msg) => this.handleRelayMessage(url, msg);
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });
  }

  private handleRelayMessage(relayUrl: string, msg: MessageEvent) {
    try {
      const data = JSON.parse(msg.data);
      if (!Array.isArray(data)) return;

      const [type] = data;

      if (type === 'EVENT') {
        const event: NostrEvent = data[2];
        if (!event) return;
        this.handleEvent(event);
      }
      // EOSE, OK, NOTICE — ignored for now
    } catch (e) {
      // Malformed message
    }
  }

  private async handleEvent(event: NostrEvent) {
    // Ignore own events
    if (event.pubkey === this.pk) return;

    // Deduplicate: same event may arrive from multiple relays
    if (this.seenEventIds.has(event.id)) return;
    this.seenEventIds.add(event.id);

    if (event.kind === PRESENCE_KIND && this.onPresence) {
      try {
        const payload: PresencePayload = JSON.parse(event.content);
        this.onPresence(event.pubkey, payload, event.id);
      } catch { /* malformed content */ }
    }

    if (event.kind === SIGNAL_KIND && this.onSignal) {
      try {
        const plaintext = await decrypt(this.sk, event.pubkey, event.content);
        const signal: SignalPayload = JSON.parse(plaintext);
        this.onSignal(event.pubkey, signal);
      } catch { /* decrypt or parse failure */ }
    }
  }

  // ─── Presence (Discovery) ───────────────────────────────

  /** Publish or update our gig presence. Uses replaceable event (d-tag = "gig"). */
  async publishPresence(payload: PresencePayload): Promise<void> {
    const template: EventTemplate = {
      kind: PRESENCE_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', 'gig'],                          // NIP-33 identifier
        ['g', payload.geohash],                 // geohash tag for filtering
        ['r', payload.role],                    // role tag (single-letter for NIP-12 filtering)
      ],
      content: JSON.stringify(payload),
    };

    const event = finalizeEvent(template, this.sk);
    this.presenceEventId = event.id;
    this.broadcast(event);
    logger.info('Presence published', { component: 'NostrService', operation: 'publishPresence' });
  }

  /** Subscribe to presence events for the given geohash and opposite role. */
  subscribePresence(geohash: string, oppositeRole: 'rider' | 'driver', callback: OnPresenceCallback): void {
    this.onPresence = callback;
    const subId = `gig-disc-${Date.now()}`;

    const filter = {
      kinds: [PRESENCE_KIND],
      '#g': [geohash],
      '#r': [oppositeRole],
    };

    for (const [url, ws] of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(['REQ', subId, filter]));
        const existing = this.subscriptionIds.get(url) ?? [];
        existing.push(subId);
        this.subscriptionIds.set(url, existing);
      }
    }
    logger.info(`Subscribed to presence: geohash=${geohash}, role=${oppositeRole}`, { component: 'NostrService', operation: 'subscribePresence' });
  }

  // ─── Signaling (WebRTC over Nostr) ──────────────────────

  /** Subscribe to incoming signaling messages addressed to us. */
  subscribeSignaling(callback: OnSignalCallback): void {
    this.onSignal = callback;
    const subId = `gig-sig-${Date.now()}`;

    const filter = {
      kinds: [SIGNAL_KIND],
      '#p': [this.pk],
      since: Math.floor(Date.now() / 1000) - 60, // only recent
    };

    for (const [url, ws] of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(['REQ', subId, filter]));
        const existing = this.subscriptionIds.get(url) ?? [];
        existing.push(subId);
        this.subscriptionIds.set(url, existing);
      }
    }
    logger.info('Subscribed to signaling', { component: 'NostrService', operation: 'subscribeSignaling' });
  }

  /** Send a signaling message (offer/answer/ice) encrypted to a specific peer. */
  async sendSignal(toPubkey: string, signal: SignalPayload): Promise<void> {
    const plaintext = JSON.stringify(signal);
    const ciphertext = await encrypt(this.sk, toPubkey, plaintext);

    const template: EventTemplate = {
      kind: SIGNAL_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', toPubkey]],
      content: ciphertext,
    };

    const event = finalizeEvent(template, this.sk);
    this.broadcast(event);
  }

  // ─── Cleanup ────────────────────────────────────────────

  /** Delete our presence event from relays and close all subscriptions. */
  async deletePresence(): Promise<void> {
    if (!this.presenceEventId) return;

    const template: EventTemplate = {
      kind: DELETE_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['e', this.presenceEventId]],
      content: 'gig session ended',
    };

    const event = finalizeEvent(template, this.sk);
    this.broadcast(event);
    this.presenceEventId = null;
    logger.info('Presence deleted', { component: 'NostrService', operation: 'deletePresence' });
  }

  /** Close all subscriptions on all relays. */
  closeSubscriptions(): void {
    for (const [url, ws] of this.sockets) {
      const subs = this.subscriptionIds.get(url) ?? [];
      for (const subId of subs) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(['CLOSE', subId]));
        }
      }
      this.subscriptionIds.set(url, []);
    }
    this.onPresence = null;
    this.onSignal = null;
  }

  /** Disconnect from all relays. */
  disconnect(): void {
    this.closed = true;
    this.closeSubscriptions();
    for (const [, ws] of this.sockets) {
      ws.close();
    }
    this.sockets.clear();
    logger.info('Disconnected from all relays', { component: 'NostrService', operation: 'disconnect' });
  }

  // ─── Helpers ────────────────────────────────────────────

  /** Broadcast a signed event to all connected relays. */
  private broadcast(event: NostrEvent): void {
    const msg = JSON.stringify(['EVENT', event]);
    for (const [, ws] of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  /** Number of connected relays. */
  get connectedRelayCount(): number {
    let count = 0;
    for (const [, ws] of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) count++;
    }
    return count;
  }
}
