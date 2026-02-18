/**
 * Generic Nostr Relay Client
 *
 * Provides Nostr primitives with no domain-specific logic:
 *   - WebSocket connections with auto-reconnect
 *   - NIP-33 replaceable event publishing (with NIP-40 expiration support)
 *   - NIP-44 encrypted direct messages
 *   - Subscription management with late-relay replay
 *   - Event deduplication and signature verification
 *
 * Event Kinds used:
 *   30078 – NIP-33 parametrized replaceable events
 *   20004 – Ephemeral encrypted DMs (not persisted by relays)
 */

import {
  finalizeEvent,
  getPublicKey,
  verifyEvent,
  type EventTemplate,
  type Event as NostrEvent,
} from 'nostr-tools/pure';
import {
  v2 as nip44,
} from 'nostr-tools/nip44';
import { logger } from '../utils/logger';

export type { NostrEvent };

// ─── Constants ───────────────────────────────────────────────

export const REPLACEABLE_KIND = 30078;
const DM_KIND = 20004;

/** Public Nostr relays – updated 2026-02-12. */
const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://nostr.mom',
  'wss://relay.damus.io',
  'wss://relay.nostromo.social',
  'wss://nostr.data.haus',
  'wss://relay.fountain.fm',
  'wss://nostr.vulpem.com',
];

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

// ─── Types ───────────────────────────────────────────────────

interface StoredSubscription {
  id: string;
  filter: object;
  onEvent: (event: NostrEvent) => void;
  onEose?: () => void;
}

// ─── Service ─────────────────────────────────────────────────

export class NostrService {
  private sk: Uint8Array;
  private pk: string;
  private relays: string[];
  private sockets = new Map<string, WebSocket>();
  private subscriptions = new Map<string, StoredSubscription>();
  private cachedEvents = new Map<string, string>();     // cacheKey → signed JSON msg
  private seenEventIds = new Set<string>();              // dedup across relays
  private static readonly MAX_SEEN_IDS = 10000;         // cap to prevent unbounded growth
  private conversationKeys = new Map<string, Uint8Array>(); // pubkey → NIP-44 key
  private reconnectAttempts = new Map<string, number>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private relayCountCallback: ((connected: number, total: number) => void) | null = null;
  private closed = false;

  constructor(sk: Uint8Array, relays?: string[]) {
    this.sk = sk;
    this.pk = getPublicKey(this.sk);
    this.relays = relays ?? DEFAULT_RELAYS;
    logger.info('NostrService created', { component: 'NostrService', operation: 'constructor' });
  }

  /** Our Nostr public key (hex). */
  get pubkey(): string {
    return this.pk;
  }

  // ─── Connection ────────────────────────────────────────────

  /** Register a callback for relay connection count changes. */
  onRelayCountChange(cb: (connected: number, total: number) => void): void {
    this.relayCountCallback = cb;
    this.emitRelayCount();
  }

  /** Start connecting to all relays in the background (non-blocking). */
  connectInBackground(): void {
    for (const url of this.relays) {
      this.connectRelay(url);
    }
  }

  /** Disconnect from all relays and cancel pending reconnections. */
  disconnect(): void {
    this.closed = true;

    for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
    this.reconnectTimers.clear();
    this.reconnectAttempts.clear();

    for (const ws of this.sockets.values()) {
      ws.close();
    }

    this.sockets.clear();
    this.subscriptions.clear();
    this.cachedEvents.clear();
    this.conversationKeys.clear();
    logger.info('Disconnected from all relays', { component: 'NostrService', operation: 'disconnect' });
  }

  private connectRelay(url: string): void {
    if (this.closed) return;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        if (this.closed) { ws.close(); return; }
        this.sockets.set(url, ws);
        this.reconnectAttempts.delete(url);
        this.emitRelayCount();
        logger.info(`Connected to ${url}`, { component: 'NostrService', operation: 'connectRelay' });

        // Replay cached events to this newly connected relay
        for (const msg of this.cachedEvents.values()) {
          ws.send(msg);
        }

        // Replay active subscriptions to this relay
        for (const sub of this.subscriptions.values()) {
          ws.send(JSON.stringify(['REQ', sub.id, sub.filter]));
        }
      };

      ws.onclose = () => {
        this.sockets.delete(url);
        this.emitRelayCount();
        this.scheduleReconnect(url);
      };

      ws.onerror = () => {};

      ws.onmessage = (msg) => this.handleMessage(msg.data);
    } catch {
      this.scheduleReconnect(url);
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   * 1s → 2s → 4s → 8s → ... → 30s (capped).
   */
  private scheduleReconnect(url: string): void {
    if (this.closed) return;

    const attempt = this.reconnectAttempts.get(url) ?? 0;
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
    this.reconnectAttempts.set(url, attempt + 1);

    const existing = this.reconnectTimers.get(url);
    if (existing) clearTimeout(existing);

    this.reconnectTimers.set(url, setTimeout(() => {
      this.reconnectTimers.delete(url);
      if (!this.closed) {
        logger.info(`Reconnecting to ${url} (attempt ${attempt + 1}, delay ${delay}ms)`, { component: 'NostrService', operation: 'scheduleReconnect' });
        this.connectRelay(url);
      }
    }, delay));
  }

  private emitRelayCount(): void {
    if (!this.relayCountCallback) return;
    let count = 0;
    for (const ws of this.sockets.values()) {
      if (ws.readyState === WebSocket.OPEN) count++;
    }
    this.relayCountCallback(count, this.relays.length);
  }

  // ─── Message Handling ──────────────────────────────────────

  private handleMessage(raw: string): void {
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return;

      if (data[0] === 'EVENT' && data[1] && data[2]) {
        this.handleIncomingEvent(data[1] as string, data[2] as NostrEvent);
      } else if (data[0] === 'EOSE' && data[1]) {
        const sub = this.subscriptions.get(data[1] as string);
        if (sub?.onEose) sub.onEose();
      }
    } catch {
      // Malformed relay message — ignore
    }
  }

  private handleIncomingEvent(subId: string, event: NostrEvent): void {
    const isOwn = event.pubkey === this.pk;

    // Verify signature (skip for own events — we signed them)
    if (!isOwn && !verifyEvent(event)) {
      logger.warn(`Rejected event with invalid signature: ${event.id?.slice(0, 8)}`, { component: 'NostrService', operation: 'handleIncomingEvent' });
      return;
    }

    // Deduplicate across relays (skip for own events — self-subscriptions
    // need every echo so the heartbeat timer can resync with relay state)
    if (!isOwn) {
      if (this.seenEventIds.has(event.id)) return;
      this.seenEventIds.add(event.id);

      // Evict oldest entries when cap is reached
      if (this.seenEventIds.size > NostrService.MAX_SEEN_IDS) {
        const iter = this.seenEventIds.values();
        this.seenEventIds.delete(iter.next().value!);
      }
    }

    // Route to the subscription that matched
    const sub = this.subscriptions.get(subId);
    if (sub) {
      sub.onEvent(event);
    }
  }

  // ─── Publishing ────────────────────────────────────────────

  /**
   * Publish a NIP-33 replaceable event.
   * Cached for automatic replay to late-connecting relays.
   * Returns the event ID.
   */
  publishReplaceable(dTag: string, extraTags: string[][], content: string): string {
    const template: EventTemplate = {
      kind: REPLACEABLE_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['d', dTag], ...extraTags],
      content,
    };

    const event = finalizeEvent(template, this.sk);
    const msg = JSON.stringify(['EVENT', event]);
    this.cachedEvents.set(`rep:${dTag}`, msg);
    this.broadcast(msg);

    logger.info(`Published replaceable event (d=${dTag})`, { component: 'NostrService', operation: 'publishReplaceable' });
    return event.id;
  }

  // ─── Subscriptions ─────────────────────────────────────────

  /**
   * Subscribe to events matching a filter.
   * Stored and replayed to late-connecting relays.
   * Optional onEose fires when the relay sends EOSE (end of stored events).
   */
  subscribe(id: string, filter: object, onEvent: (event: NostrEvent) => void, onEose?: () => void): void {
    this.subscriptions.set(id, { id, filter, onEvent, onEose });

    for (const ws of this.sockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(['REQ', id, filter]));
      }
    }
  }

  /**
   * Remove a subscription and send CLOSE to all connected relays.
   */
  unsubscribe(id: string): void {
    this.subscriptions.delete(id);
    for (const ws of this.sockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(['CLOSE', id]));
      }
    }
  }

  // ─── Encrypted DMs (NIP-44) ────────────────────────────────

  /**
   * Subscribe to incoming encrypted DMs addressed to us.
   * Decrypts automatically and passes the plaintext payload to the callback.
   * Returns the subscription ID.
   */
  subscribeDMs(lookbackSecs: number, onMessage: (fromPubkey: string, payload: unknown) => void): string {
    const subId = `dm-${Date.now()}`;

    this.subscribe(subId, {
      kinds: [DM_KIND],
      '#p': [this.pk],
      since: Math.floor(Date.now() / 1000) - lookbackSecs,
    }, (event: NostrEvent) => {
      try {
        const key = this.getConversationKey(event.pubkey);
        const plaintext = nip44.decrypt(event.content, key);
        const payload = JSON.parse(plaintext);
        onMessage(event.pubkey, payload);
      } catch {
        logger.warn(`Failed to decrypt DM from ${event.pubkey.slice(0, 8)}`, { component: 'NostrService', operation: 'subscribeDMs' });
      }
    });

    return subId;
  }

  /** Send a NIP-44 encrypted DM to a specific pubkey. */
  sendDM(toPubkey: string, payload: unknown): void {
    const plaintext = JSON.stringify(payload);
    const key = this.getConversationKey(toPubkey);
    const ciphertext = nip44.encrypt(plaintext, key);

    const template: EventTemplate = {
      kind: DM_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', toPubkey]],
      content: ciphertext,
    };

    const event = finalizeEvent(template, this.sk);
    this.broadcast(JSON.stringify(['EVENT', event]));
    logger.info(`DM sent to ${toPubkey.slice(0, 8)}`, { component: 'NostrService', operation: 'sendDM' });
  }

  // ─── Helpers ───────────────────────────────────────────────

  /** Broadcast a signed event message to all connected relays. */
  private broadcast(msg: string): void {
    for (const ws of this.sockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  /**
   * Get or compute the NIP-44 conversation key for a peer.
   * Cached to avoid recomputing on every message.
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
