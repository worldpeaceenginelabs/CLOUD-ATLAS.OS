/**
 * Nostr Service
 *
 * Handles relay connections, presence publishing/subscribing, and
 * encrypted match messaging over Nostr for the Gig Economy feature.
 *
 * Event Kinds used:
 *   30078  – Replaceable: Gig presence (discovery)
 *   20004  – Ephemeral: Encrypted match-protocol messages (ride-request, accept, confirm, etc.)
 *   5      – Deletion: remove own presence on cleanup
 */

import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  verifyEvent,
  type EventTemplate,
  type Event as NostrEvent,
} from 'nostr-tools/pure';
import {
  v2 as nip44,
} from 'nostr-tools/nip44';
import { logger } from '../utils/logger';
import type { GigP2PMessage } from '../types';

/** Convert Uint8Array to hex string. */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Constants ───────────────────────────────────────────────

/** Replaceable event kind for gig presence (NIP-33 parametrized replaceable). */
const PRESENCE_KIND = 30078;

/** Ephemeral event kind for match messaging (20000+ = relays don't persist). */
const MATCH_MSG_KIND = 20004;

/** Event deletion kind. */
const DELETE_KIND = 5;

/** Public Nostr relays – updated 2026-02-12. */
const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://nostr.mom',
  'wss://relay.damus.io',
  'wss://relay.nostromo.social',
  'wss://nostr.data.haus',
  'wss://relay.fountain.fm',
  'wss://relay.verified-nostr.com',
  'wss://nostr.vulpem.com',
];

/** Reconnection constants. */
const RECONNECT_BASE_MS = 1000;    // initial backoff delay
const RECONNECT_MAX_MS = 30000;    // max backoff cap
const RECONNECT_MULTIPLIER = 2;    // exponential growth factor

// ─── Types ───────────────────────────────────────────────────

export interface PresencePayload {
  geohash: string;
  role: 'rider' | 'driver';
  rideType?: 'person' | 'delivery';
  startLocation?: { latitude: number; longitude: number };
  destination?: { latitude: number; longitude: number };
}

export type OnPresenceCallback = (pubkey: string, payload: PresencePayload, eventId: string) => void;
export type OnMatchMessageCallback = (fromPubkey: string, message: GigP2PMessage) => void;
export type OnRelayCountChangeCallback = (connected: number, total: number) => void;

// ─── Service Class ───────────────────────────────────────────

export class NostrService {
  private sk: Uint8Array;
  private pk: string;
  private sockets: Map<string, WebSocket> = new Map();
  private subscriptionIds: Map<string, string[]> = new Map(); // relay → [subId]
  private onPresence: OnPresenceCallback | null = null;
  private onMatchMessage: OnMatchMessageCallback | null = null;
  private presenceEventId: string | null = null;
  private relays: string[];
  private closed = false;
  private seenEventIds: Set<string> = new Set(); // dedup events from multiple relays
  private pendingOkResolvers: Map<string, () => void> = new Map(); // eventId → resolve callback
  private onRelayCountChange: OnRelayCountChangeCallback | null = null;
  private pendingPresence: PresencePayload | null = null;
  private presenceEventMsg: string | null = null; // cached signed ["EVENT", ...] for late-connecting relays
  private pendingPresenceFilter: { subId: string; filter: object } | null = null;
  private pendingMatchFilter: { subId: string; filter: object } | null = null;
  private reconnectAttempts: Map<string, number> = new Map();       // relay url → attempt count
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map(); // relay url → timer
  private conversationKeys: Map<string, Uint8Array> = new Map();   // peer pubkey → NIP-44 conversation key

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

  /** Register a callback for relay count changes. */
  setOnRelayCountChange(callback: OnRelayCountChangeCallback): void {
    this.onRelayCountChange = callback;
  }

  /**
   * Start connecting to all relays in the background (non-blocking).
   * Each relay connects independently. When the first relay connects,
   * any pending presence is automatically published.
   */
  connectInBackground(): void {
    for (const url of this.relays) {
      this.connectRelay(url);
    }
  }

  /**
   * Queue a presence payload to be published when the first relay connects.
   * If a relay is already connected, publishes immediately.
   */
  queuePresence(payload: PresencePayload): void {
    this.pendingPresence = payload;
    this.presenceEventMsg = null;
    // If we already have a connected relay, publish now
    if (this.connectedRelayCount > 0) {
      this.publishPresence(payload);
      this.pendingPresence = null;
    }
  }

  private connectRelay(url: string): void {
    // Don't connect if service is closed
    if (this.closed) return;

    const timeout = setTimeout(() => {
      logger.warn(`Timeout connecting to ${url}`, { component: 'NostrService', operation: 'connectRelay' });
    }, 5000);

    try {
      const ws = new WebSocket(url);
      ws.onopen = () => {
        clearTimeout(timeout);
        if (this.closed) { ws.close(); return; }
        this.sockets.set(url, ws);
        // Reset reconnect backoff on successful connection
        this.reconnectAttempts.delete(url);
        logger.info(`Connected to relay ${url}`, { component: 'NostrService', operation: 'connectRelay' });
        this.notifyRelayCountChange();

        // Send presence to this relay
        if (this.presenceEventMsg) {
          // Already signed for an earlier relay — send cached message to this one
          ws.send(this.presenceEventMsg);
        } else if (this.pendingPresence) {
          // First relay to connect — sign, broadcast, cache
          this.publishPresence(this.pendingPresence);
          this.pendingPresence = null;
        }

        // Send active subscriptions to this relay
        this.sendPendingSubscriptions(url, ws);
      };
      ws.onclose = () => {
        this.sockets.delete(url);
        this.subscriptionIds.delete(url);
        this.notifyRelayCountChange();
        // Attempt to reconnect with exponential backoff
        this.scheduleReconnect(url);
      };
      ws.onerror = () => {
        clearTimeout(timeout);
      };
      ws.onmessage = (msg) => this.handleRelayMessage(url, msg);
    } catch (e) {
      clearTimeout(timeout);
      // Schedule reconnect even on construction failure
      this.scheduleReconnect(url);
    }
  }

  /**
   * Schedule a reconnection attempt for a relay with exponential backoff.
   * Backs off from 1s → 2s → 4s → 8s → ... → 30s (capped).
   */
  private scheduleReconnect(url: string): void {
    if (this.closed) return;

    const attempt = this.reconnectAttempts.get(url) ?? 0;
    const delayMs = Math.min(RECONNECT_BASE_MS * Math.pow(RECONNECT_MULTIPLIER, attempt), RECONNECT_MAX_MS);
    this.reconnectAttempts.set(url, attempt + 1);

    // Clear any existing reconnect timer for this relay
    const existingTimer = this.reconnectTimers.get(url);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(url);
      if (!this.closed) {
        logger.info(`Reconnecting to ${url} (attempt ${attempt + 1}, delay ${delayMs}ms)`, { component: 'NostrService', operation: 'scheduleReconnect' });
        this.connectRelay(url);
      }
    }, delayMs);

    this.reconnectTimers.set(url, timer);
  }

  /** Notify the relay count change callback. */
  private notifyRelayCountChange(): void {
    if (this.onRelayCountChange) {
      this.onRelayCountChange(this.connectedRelayCount, this.relays.length);
    }
  }

  /** Send any active subscriptions to a newly connected relay. */
  private sendPendingSubscriptions(url: string, ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Re-send presence subscription if active
    if (this.pendingPresenceFilter) {
      const subId = this.pendingPresenceFilter.subId;
      ws.send(JSON.stringify(['REQ', subId, this.pendingPresenceFilter.filter]));
      const existing = this.subscriptionIds.get(url) ?? [];
      existing.push(subId);
      this.subscriptionIds.set(url, existing);
    }

    // Re-send match message subscription if active
    if (this.pendingMatchFilter) {
      const subId = this.pendingMatchFilter.subId;
      ws.send(JSON.stringify(['REQ', subId, this.pendingMatchFilter.filter]));
      const existing = this.subscriptionIds.get(url) ?? [];
      existing.push(subId);
      this.subscriptionIds.set(url, existing);
    }
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
      } else if (type === 'OK') {
        // ["OK", <event-id>, <accepted: bool>, <message>]
        const eventId: string = data[1];
        const accepted: boolean = data[2];
        if (accepted && eventId) {
          const resolver = this.pendingOkResolvers.get(eventId);
          if (resolver) {
            resolver();
            this.pendingOkResolvers.delete(eventId);
          }
        }
      }
    } catch (e) {
      // Malformed message
    }
  }

  private async handleEvent(event: NostrEvent) {
    // Ignore own events
    if (event.pubkey === this.pk) return;

    // Verify event signature — reject forged events from malicious relays
    if (!verifyEvent(event)) {
      logger.warn(`Rejected event with invalid signature: ${event.id?.slice(0, 8)}`, { component: 'NostrService', operation: 'handleEvent' });
      return;
    }

    // Deduplicate: same event may arrive from multiple relays
    if (this.seenEventIds.has(event.id)) return;
    this.seenEventIds.add(event.id);

    if (event.kind === PRESENCE_KIND && this.onPresence) {
      try {
        const payload: PresencePayload = JSON.parse(event.content);
        // Ignore empty presence (deleted/replaced)
        if (!payload.role || !payload.geohash) return;
        this.onPresence(event.pubkey, payload, event.id);
      } catch {
        logger.warn('Malformed presence event content', { component: 'NostrService', operation: 'handleEvent' });
      }
    }

    if (event.kind === MATCH_MSG_KIND && this.onMatchMessage) {
      try {
        const conversationKey = this.getConversationKey(event.pubkey);
        const plaintext = nip44.decrypt(event.content, conversationKey);
        const envelope = JSON.parse(plaintext);
        // Only process messages tagged as gig match messages
        if (envelope.gig && envelope.message) {
          this.onMatchMessage(event.pubkey, envelope.message as GigP2PMessage);
        }
      } catch {
        logger.warn(`Failed to decrypt match message from ${event.pubkey.slice(0, 8)}`, { component: 'NostrService', operation: 'handleEvent' });
      }
    }
  }

  // ─── Presence (Discovery) ───────────────────────────────

  /** Publish or update our gig presence. Uses replaceable event (d-tag = "gig"). */
  publishPresence(payload: PresencePayload): void {
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
    this.presenceEventMsg = JSON.stringify(['EVENT', event]); // cache for late-connecting relays
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
      since: Math.floor(Date.now() / 1000) - 300, // only events from last 5 minutes
    };

    // Store for late-connecting relays
    this.pendingPresenceFilter = { subId, filter };

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

  // ─── Match Messaging (Encrypted DMs) ──────────────────────

  /** Subscribe to incoming match messages addressed to us. */
  subscribeMatchMessages(callback: OnMatchMessageCallback): void {
    this.onMatchMessage = callback;
    const subId = `gig-match-${Date.now()}`;

    const filter = {
      kinds: [MATCH_MSG_KIND],
      '#p': [this.pk],
      since: Math.floor(Date.now() / 1000) - 60, // only recent
    };

    // Store for late-connecting relays
    this.pendingMatchFilter = { subId, filter };

    for (const [url, ws] of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(['REQ', subId, filter]));
        const existing = this.subscriptionIds.get(url) ?? [];
        existing.push(subId);
        this.subscriptionIds.set(url, existing);
      }
    }
    logger.info('Subscribed to match messages', { component: 'NostrService', operation: 'subscribeMatchMessages' });
  }

  /** Send a match-protocol message (NIP-44 encrypted) to a specific peer. */
  sendMatchMessage(toPubkey: string, message: GigP2PMessage): void {
    try {
      const envelope = { gig: true, message };
      const plaintext = JSON.stringify(envelope);
      const conversationKey = this.getConversationKey(toPubkey);
      const ciphertext = nip44.encrypt(plaintext, conversationKey);

      const template: EventTemplate = {
        kind: MATCH_MSG_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', toPubkey]],
        content: ciphertext,
      };

      const event = finalizeEvent(template, this.sk);
      this.broadcast(event);
      logger.info(`Match message sent to ${toPubkey.slice(0, 8)}: ${message.type}`, { component: 'NostrService', operation: 'sendMatchMessage' });
    } catch (e) {
      logger.error(`Failed to send match message to ${toPubkey.slice(0, 8)}: ${e}`, { component: 'NostrService', operation: 'sendMatchMessage' });
      throw e; // re-throw so callers can handle
    }
  }

  // ─── Cleanup ────────────────────────────────────────────

  /**
   * Delete our presence from relays. Uses two strategies:
   *   1. NIP-09 DELETE event (Kind 5) referencing the original event
   *   2. Empty replacement event (same Kind 30078 + d-tag "gig") to overwrite on relays
   *      that don't honour DELETE
   *
   * Waits for at least one relay to confirm the replacement via OK,
   * or times out after 3 seconds.
   */
  async deletePresence(): Promise<void> {
    if (!this.presenceEventId) return;

    // 1. Send NIP-09 DELETE event (best-effort, some relays may ignore)
    const deleteTemplate: EventTemplate = {
      kind: DELETE_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['e', this.presenceEventId]],
      content: 'gig session ended',
    };
    const deleteEvent = finalizeEvent(deleteTemplate, this.sk);
    this.broadcast(deleteEvent);

    // 2. Send empty replacement event (overwrites the original on all NIP-33 relays)
    const replaceTemplate: EventTemplate = {
      kind: PRESENCE_KIND,
      created_at: Math.floor(Date.now() / 1000) + 1, // +1s to ensure it's newer
      tags: [['d', 'gig']],   // same d-tag → replaces the old one, no geohash/role tags
      content: '',             // empty content = no longer available
    };
    const replaceEvent = finalizeEvent(replaceTemplate, this.sk);

    // Wait for at least one relay to confirm the replacement, or timeout after 3s
    const confirmed = await this.broadcastAndWaitForOk(replaceEvent, 3000);

    this.presenceEventId = null;
    this.presenceEventMsg = null;
    this.pendingPresence = null;
    if (confirmed) {
      logger.info('Presence deleted (confirmed by relay)', { component: 'NostrService', operation: 'deletePresence' });
    } else {
      logger.warn('Presence deletion not confirmed (timeout), proceeding anyway', { component: 'NostrService', operation: 'deletePresence' });
    }
  }

  /**
   * Broadcast an event and wait until at least one relay responds with OK.
   * Returns true if confirmed, false if timed out.
   */
  private broadcastAndWaitForOk(event: NostrEvent, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingOkResolvers.delete(event.id);
        resolve(false);
      }, timeoutMs);

      this.pendingOkResolvers.set(event.id, () => {
        clearTimeout(timer);
        resolve(true);
      });

      this.broadcast(event);
    });
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
    this.onMatchMessage = null;
    this.pendingPresenceFilter = null;
    this.pendingMatchFilter = null;
  }

  /** Disconnect from all relays and cancel all pending reconnections. */
  disconnect(): void {
    this.closed = true;

    // Cancel all pending reconnection timers
    for (const [, timer] of this.reconnectTimers) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    this.reconnectAttempts.clear();

    this.closeSubscriptions();
    for (const [, ws] of this.sockets) {
      ws.close();
    }
    this.sockets.clear();
    this.conversationKeys.clear();
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

  /**
   * Get or compute the NIP-44 conversation key for a peer.
   * Caches the key to avoid recomputing on every message.
   */
  private getConversationKey(peerPubkey: string): Uint8Array {
    let key = this.conversationKeys.get(peerPubkey);
    if (!key) {
      key = nip44.utils.getConversationKey(this.sk, peerPubkey);
      this.conversationKeys.set(peerPubkey, key);
    }
    return key;
  }
}
