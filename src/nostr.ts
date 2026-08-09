/**
 * nostr.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Generic Nostr infrastructure API.
 *
 * Provides the mechanisms for creating, signing, publishing, querying,
 * subscribing to, verifying, encrypting, and decrypting Nostr events, plus
 * the relay-connectivity and synchronization primitives needed to use those
 * mechanisms reliably over real WebSocket relays.
 *
 * This module knows about the Nostr protocol. It does NOT know about any
 * application built on top of it: no domain models, no business workflows,
 * no persistence layer, no UI. Callers decide what an event kind, tag, or
 * payload *means*; this file only provides the primitives to move events
 * to and from relays correctly.
 *
 * Dependency direction:
 *
 *   Application / Domain
 *           │
 *           ▼
 *        nostr.ts
 *           │
 *           ▼
 *       nostr-tools
 *           │
 *           ▼
 *         Relays
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

import {
    finalizeEvent,
    generateSecretKey,
    getPublicKey,
    verifyEvent as verifyNostrEvent,
    type EventTemplate,
    type Event as NostrEvent,
  } from 'nostr-tools/pure';
  import { v2 as nip44 } from 'nostr-tools/nip44';
  
  export type { NostrEvent, EventTemplate };
  
  // ═══════════════════════════════════════════════════════════════════════
  // Constants
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * A small set of well-connected public relays, usable as a default when
   * the caller doesn't want to supply its own relay list. Purely a
   * convenience — any NostrClient can be constructed with a different list.
   */
  export const DEFAULT_RELAYS: readonly string[] = [
    'wss://nos.lol',
    'wss://nostr.mom',
    'wss://relay.damus.io',
    'wss://relay.nostromo.social',
    'wss://nostr.data.haus',
    'wss://relay.fountain.fm',
    'wss://nostr.vulpem.com',
  ];
  
  /**
   * Default event kind used by publishReplaceable() for NIP-33
   * parameterized-replaceable events. 30078 falls within the
   * parameterized-replaceable range (30000-39999) and is simply this
   * client's chosen default — callers may override it per-call via
   * ReplaceableEventInput.kind; nothing about NIP-33 requires this
   * specific kind.
   */
  export const DEFAULT_REPLACEABLE_KIND = 30078;
  
  /**
   * Default event kind used by sendEncrypted()/subscribeEncrypted().
   * NIP-44 defines the encryption scheme (how content is encrypted/decrypted)
   * and is independent of event kind — it says nothing about which kind an
   * encrypted event should carry. This constant is only this client's
   * chosen default kind for transporting NIP-44-encrypted content; callers
   * may override it per-call via the `kind` parameter.
   */
  export const DEFAULT_ENCRYPTED_KIND = 14;
  
  const RECONNECT_BASE_MS = 1000;
  const RECONNECT_MAX_MS = 30000;
  const MAX_SEEN_IDS = 10000;
  
  // ═══════════════════════════════════════════════════════════════════════
  // Generic protocol types
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * A generic NIP-01 style filter. Standard fields are typed; arbitrary
   * single-letter tag filters (`#e`, `#p`, `#d`, `#t`, `#g`, ...) are
   * supported through the index signature, since which tags matter is a
   * protocol-level (NIP-01/NIP-12) concern, not a domain concern.
   */
  export interface NostrFilter {
    ids?: string[];
    authors?: string[];
    kinds?: number[];
    since?: number;
    until?: number;
    limit?: number;
    search?: string;
    [tagFilter: `#${string}`]: string[] | number[] | number | string | undefined;
  }
  
  export type RelaySyncStatus = 'synced' | 'partial' | 'failed';
  
  export interface RelayQueryMeta {
    connectedAtStart: number;
    eoseReceived: number;
    retriesUsed: number;
    timedOut: boolean;
  }
  
  export interface RelayQueryResult {
    status: RelaySyncStatus;
    events: NostrEvent[];
    meta: RelayQueryMeta;
  }
  
  export type RelayPublishOutcome =
    | 'verified_synced'
    | 'verified_partial'
    | 'verify_pending'
    | 'failed';
  
  export interface PublishVerifyResult {
    status: RelaySyncStatus;
    meta: RelayQueryMeta;
    event: NostrEvent;
    verified: boolean;
    outcome: RelayPublishOutcome;
  }
  
  /** A handle returned by subscribe(), for ergonomic update/close without re-passing the id. */
  export interface SubscriptionHandle {
    id: string;
    update: (filter: NostrFilter) => void;
    close: () => void;
  }
  
  interface StoredSubscription {
    id: string;
    filter: NostrFilter;
    onEvent: (event: NostrEvent) => void;
    onEose?: () => void;
    onEoseRelay?: (relayUrl: string) => void;
  }
  
  export interface WaitReadyOptions {
    /** Stop waiting early once this many relays are connected. */
    expectedRelays?: number;
    /** Consider the connection count "settled" after this many ms without a new connection. */
    settleQuietMs?: number;
    /** Minimum connected relays required to consider readiness successful. */
    minRelaysAfterSettle?: number;
    /** Hard timeout for the wait. */
    timeoutMs?: number;
    /** Poll interval while waiting. */
    pollMs?: number;
  }
  
  export interface WaitReadyResult {
    ok: boolean;
    connected: number;
    relayUrls: string[];
  }
  
  export interface QueryOptions extends WaitReadyOptions {
    subIdPrefix?: string;
    retries?: number;
    retryBackoffMs?: number;
    timeoutMs?: number;
    onEvent?: (event: NostrEvent) => void;
    onMetrics?: (meta: RelayQueryMeta & { status: RelaySyncStatus }) => void;
  }
  
  export interface PublishOptions {
    /** Event kind for a one-off (non-replaceable) publish. */
    kind: number;
    tags?: string[][];
    content?: string;
    createdAt?: number;
  }
  
  export interface ReplaceableEventInput {
    /** NIP-33 `d` tag value identifying this replaceable event. */
    dTag: string;
    tags?: string[][];
    content: string;
    /** Overrides the client's default replaceable kind for this call. */
    kind?: number;
  }
  
  export interface PublishWithVerifyOptions extends ReplaceableEventInput {
    verifyFilter: NostrFilter;
    query?: QueryOptions;
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // Standalone key / crypto helpers (no relay state required)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Generate a new Nostr keypair. Persistence, if any, is the caller's responsibility. */
  export function generateKeypair(): { secretKey: Uint8Array; publicKey: string } {
    const secretKey = generateSecretKey();
    return { secretKey, publicKey: getPublicKey(secretKey) };
  }
  
  /** Derive the public key (hex) for a secret key. */
  export function derivePublicKey(secretKey: Uint8Array): string {
    return getPublicKey(secretKey);
  }
  
  /** Verify an event's signature and id. */
  export function verify(event: NostrEvent): boolean {
    return verifyNostrEvent(event);
  }
  
  /**
   * Read the NIP-40 `expiration` tag off an event, if present.
   * Returns undefined if absent or malformed.
   */
  export function getExpiration(event: NostrEvent): number | undefined {
    const tag = event.tags?.find((t) => t[0] === 'expiration');
    if (!tag?.[1]) return undefined;
    const n = parseInt(tag[1], 10);
    return Number.isFinite(n) ? n : undefined;
  }
  
  /**
   * Tag value that marks a parameterized-replaceable event as a
   * deletion/tombstone marker (custom convention, not NIP-09). A tombstone
   * is itself an ordinary replaceable event: it carries the same `d` tag as
   * the resource it retires, tagged with ['t', DELETION_TAG_VALUE], so
   * relays and late subscribers converge on "this `d`-tag from this author
   * is deleted" the same way they converge on any other replaceable state.
   *
   * This is a generic replaceable-event-level mechanism — it recognizes and
   * produces tombstone markers, but has no notion of what a `d` tag
   * identifies in any given application.
   */
  export const DELETION_TAG_VALUE = 'DELETE';
  
  /** True if a replaceable event is a deletion/tombstone marker. */
  export function isDeletionEvent(event: NostrEvent): boolean {
    return event.tags?.some((t) => t[0] === 't' && t[1] === DELETION_TAG_VALUE) ?? false;
  }
  
  /**
   * If `event` is a tombstone marker, returns the identifier (`d` tag) and
   * author (pubkey) of the replaceable resource it retires. Returns null if
   * the event isn't a deletion marker, or is missing a `d` tag/pubkey.
   */
  export function getDeletionTarget(event: NostrEvent): { dTag: string; author: string } | null {
    if (!isDeletionEvent(event)) return null;
    const dTag = event.tags?.find((t) => t[0] === 'd')?.[1];
    if (!dTag || !event.pubkey) return null;
    return { dTag, author: event.pubkey };
  }
  
  /**
   * Build a generic NIP-01 filter from structured options, including
   * arbitrary indexable tag filters (any single-letter tag, e.g. d/t/g/p/e).
   * This is protocol-level convenience, not a domain concept.
   */
  export function buildFilter(opts: {
    kinds?: number[];
    authors?: string[];
    ids?: string[];
    tags?: Record<string, string[]>;
    since?: number;
    until?: number;
    limit?: number;
  }): NostrFilter {
    const filter: NostrFilter = {};
    if (opts.kinds?.length) filter.kinds = opts.kinds;
    if (opts.authors?.length) filter.authors = opts.authors;
    if (opts.ids?.length) filter.ids = opts.ids;
    if (opts.tags) {
      for (const [letter, values] of Object.entries(opts.tags)) {
        if (values?.length) filter[`#${letter}`] = values;
      }
    }
    if (opts.since != null) filter.since = opts.since;
    if (opts.until != null) filter.until = opts.until;
    if (opts.limit != null) filter.limit = opts.limit;
    return filter;
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // Expiry tracker — generic NIP-40 local-timer bookkeeping
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Tracks per-key local expiry timers (e.g. "fire a callback when this
   * event's NIP-40 expiration is reached"). Purely a technical convenience
   * for scheduling setTimeout-based local expiry; carries no opinion about
   * what a key or an expiry callback means.
   */
  export interface ExpiryTracker {
    /** (Re)schedule a callback to fire at the given unix-seconds timestamp. */
    set(key: string, expirationUnixSecs: number, onExpire: () => void): void;
    /** Cancel a pending timer, if any. */
    clear(key: string): void;
    /** Cancel all pending timers. */
    clearAll(): void;
  }
  
  export function createExpiryTracker(): ExpiryTracker {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
  
    return {
      set(key, expirationUnixSecs, onExpire) {
        const existing = timers.get(key);
        if (existing) clearTimeout(existing);
  
        const delayMs = Math.max(0, expirationUnixSecs * 1000 - Date.now());
        timers.set(
          key,
          setTimeout(() => {
            timers.delete(key);
            onExpire();
          }, delayMs),
        );
      },
      clear(key) {
        const existing = timers.get(key);
        if (existing) {
          clearTimeout(existing);
          timers.delete(key);
        }
      },
      clearAll() {
        for (const t of timers.values()) clearTimeout(t);
        timers.clear();
      },
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // NostrClient
  // ═══════════════════════════════════════════════════════════════════════
  
  export interface NostrClientOptions {
    relays?: string[];
    /** Default kind used by publishReplaceable() when not overridden per-call. */
    replaceableKind?: number;
    /** Default kind used by sendEncrypted()/subscribeEncrypted() when not overridden per-call. */
    encryptedKind?: number;
    /** Optional hook for structured logging; defaults to a no-op. */
    onLog?: (level: 'info' | 'warn', message: string) => void;
  }
  
  /**
   * A generic Nostr relay client.
   *
   * Provides Nostr primitives with no domain-specific logic:
   *   - WebSocket relay connections with exponential-backoff auto-reconnect
   *   - Event creation, signing, and signature verification
   *   - NIP-33 parameterized-replaceable event publishing (NIP-40 expiration friendly)
   *   - One-off event publishing
   *   - Subscriptions with late-relay replay, EOSE tracking, and updates
   *   - Reliable snapshot queries (settle-detection, timeout, retry)
   *   - Publish-then-verify workflow
   *   - NIP-44 payload encryption/decryption and encrypted event send/receive
   *   - Cross-relay event deduplication
   */
  export class NostrClient {
    private readonly sk: Uint8Array;
    private readonly pk: string;
    private readonly relays: string[];
    private readonly replaceableKind: number;
    private readonly encryptedKind: number;
    private readonly log: (level: 'info' | 'warn', message: string) => void;
  
    private sockets = new Map<string, WebSocket>();
    private subscriptions = new Map<string, StoredSubscription>();
    /**
     * Replay buffer for already-published events (replaceable + one-off),
     * keyed by a cache key derived from the event. Kept so that relays
     * which connect (or reconnect) after publish still receive them —
     * generic infrastructure for late-relay replay, not a persistence layer.
     */
    private publishReplayBuffer = new Map<string, string>(); // cacheKey -> signed ["EVENT", ...] JSON
    private seenEventIds = new Set<string>(); // cross-relay dedup
    private conversationKeys = new Map<string, Uint8Array>(); // peer pubkey -> NIP-44 key
    private reconnectAttempts = new Map<string, number>();
    private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private relayCountCallback: ((connected: number, total: number) => void) | null = null;
    private closed = false;
  
    constructor(secretKey: Uint8Array, options: NostrClientOptions = {}) {
      this.sk = secretKey;
      this.pk = getPublicKey(secretKey);
      this.relays = options.relays ?? [...DEFAULT_RELAYS];
      this.replaceableKind = options.replaceableKind ?? DEFAULT_REPLACEABLE_KIND;
      this.encryptedKind = options.encryptedKind ?? DEFAULT_ENCRYPTED_KIND;
      this.log = options.onLog ?? (() => {});
    }
  
    /** Our Nostr public key (hex). */
    get pubkey(): string {
      return this.pk;
    }
  
    // ─── Connection ────────────────────────────────────────────────────
  
    /** Register a callback fired whenever the connected-relay count changes. */
    onRelayCountChange(cb: (connected: number, total: number) => void): void {
      this.relayCountCallback = cb;
      this.emitRelayCount();
    }
  
    /** Number of relays currently connected (readyState OPEN). */
    getConnectedRelayCount(): number {
      let count = 0;
      for (const ws of this.sockets.values()) if (ws.readyState === WebSocket.OPEN) count++;
      return count;
    }
  
    /** URLs of relays currently connected (readyState OPEN). */
    getConnectedRelayUrls(): string[] {
      const urls: string[] = [];
      for (const [url, ws] of this.sockets.entries()) if (ws.readyState === WebSocket.OPEN) urls.push(url);
      return urls;
    }
  
    /** Start connecting to all configured relays in the background (non-blocking). */
    connect(): void {
      for (const url of this.relays) this.connectRelay(url);
    }
  
    /** Disconnect from all relays and cancel pending reconnections. Clears cached/subscription state. */
    disconnect(): void {
      this.closed = true;
  
      for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
      this.reconnectTimers.clear();
      this.reconnectAttempts.clear();
  
      for (const ws of this.sockets.values()) ws.close();
  
      this.sockets.clear();
      this.subscriptions.clear();
      this.publishReplayBuffer.clear();
      this.conversationKeys.clear();
      this.log('info', 'Disconnected from all relays');
    }
  
    /**
     * Wait until relay connectivity looks "ready": either the expected relay
     * count is reached, or the connection count has gone quiet (no new
     * connections for settleQuietMs) — whichever comes first, bounded by
     * timeoutMs.
     */
    async waitReady(options: WaitReadyOptions = {}): Promise<WaitReadyResult> {
      const expectedRelays = options.expectedRelays ?? this.relays.length;
      const settleQuietMs = options.settleQuietMs ?? 3000;
      const minRelaysAfterSettle = options.minRelaysAfterSettle ?? 1;
      const timeoutMs = options.timeoutMs ?? 20000;
      const pollMs = options.pollMs ?? 100;
      const startedAt = Date.now();
  
      let lastCount = this.getConnectedRelayCount();
      let lastIncreaseAt = lastCount > 0 ? Date.now() : 0;
  
      while (Date.now() - startedAt < timeoutMs) {
        const connected = this.getConnectedRelayCount();
        if (connected > lastCount) lastIncreaseAt = Date.now();
        lastCount = connected;
  
        if (connected >= expectedRelays) {
          const relayUrls = this.getConnectedRelayUrls();
          return { ok: relayUrls.length >= minRelaysAfterSettle, connected: relayUrls.length, relayUrls };
        }
  
        if (lastIncreaseAt > 0 && Date.now() - lastIncreaseAt >= settleQuietMs) {
          const relayUrls = this.getConnectedRelayUrls();
          return { ok: relayUrls.length >= minRelaysAfterSettle, connected: relayUrls.length, relayUrls };
        }
  
        await sleep(pollMs);
      }
  
      const relayUrls = this.getConnectedRelayUrls();
      return { ok: relayUrls.length >= minRelaysAfterSettle, connected: relayUrls.length, relayUrls };
    }
  
    private connectRelay(url: string): void {
      if (this.closed) return;
  
      try {
        const ws = new WebSocket(url);
  
        ws.onopen = () => {
          if (this.closed) {
            ws.close();
            return;
          }
          this.sockets.set(url, ws);
          this.reconnectAttempts.delete(url);
          this.emitRelayCount();
          this.log('info', `Connected to ${url}`);
  
          // Replay cached (replaceable/one-off) events to this newly connected relay.
          for (const msg of this.publishReplayBuffer.values()) ws.send(msg);
  
          // Replay active subscriptions to this relay.
          for (const sub of this.subscriptions.values()) ws.send(JSON.stringify(['REQ', sub.id, sub.filter]));
        };
  
        ws.onclose = () => {
          this.sockets.delete(url);
          this.emitRelayCount();
          this.scheduleReconnect(url);
        };
  
        ws.onerror = () => {};
  
        ws.onmessage = (msg) => this.handleMessage(msg.data as string, url);
      } catch {
        this.scheduleReconnect(url);
      }
    }
  
    /** Exponential-backoff reconnect: 1s -> 2s -> 4s -> ... -> 30s (capped). */
    private scheduleReconnect(url: string): void {
      if (this.closed) return;
  
      const attempt = this.reconnectAttempts.get(url) ?? 0;
      const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
      this.reconnectAttempts.set(url, attempt + 1);
  
      const existing = this.reconnectTimers.get(url);
      if (existing) clearTimeout(existing);
  
      this.reconnectTimers.set(
        url,
        setTimeout(() => {
          this.reconnectTimers.delete(url);
          if (!this.closed) {
            this.log('info', `Reconnecting to ${url} (attempt ${attempt + 1}, delay ${delay}ms)`);
            this.connectRelay(url);
          }
        }, delay),
      );
    }
  
    private emitRelayCount(): void {
      if (!this.relayCountCallback) return;
      this.relayCountCallback(this.getConnectedRelayCount(), this.relays.length);
    }
  
    // ─── Message handling / dedup / verification ───────────────────────
  
    private handleMessage(raw: string, relayUrl: string): void {
      try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) return;
  
        if (data[0] === 'EVENT' && data[1] && data[2]) {
          this.handleIncomingEvent(data[1] as string, data[2] as NostrEvent);
        } else if (data[0] === 'EOSE' && data[1]) {
          const sub = this.subscriptions.get(data[1] as string);
          sub?.onEoseRelay?.(relayUrl);
          sub?.onEose?.();
        }
      } catch {
        // Malformed relay message — ignore.
      }
    }
  
    private handleIncomingEvent(subId: string, event: NostrEvent): void {
      const isOwn = event.pubkey === this.pk;
  
      // Own events skip verification/dedup so self-subscriptions see every echo.
      if (!isOwn) {
        if (this.seenEventIds.has(event.id)) return;
  
        if (!verifyNostrEvent(event)) {
          this.log('warn', `Rejected event with invalid signature: ${event.id?.slice(0, 8)}`);
          return;
        }
  
        this.seenEventIds.add(event.id);
        if (this.seenEventIds.size > MAX_SEEN_IDS) {
          const iter = this.seenEventIds.values();
          this.seenEventIds.delete(iter.next().value!);
        }
      }
  
      const sub = this.subscriptions.get(subId);
      sub?.onEvent(event);
    }
  
    // ─── Publishing ─────────────────────────────────────────────────────
  
    /** Broadcast a signed event message to all connected relays. */
    private broadcast(msg: string): void {
      for (const ws of this.sockets.values()) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
      }
    }
  
    /**
     * Sign and publish a one-off (non-replaceable) event. Not cached for
     * replay to late-connecting relays — use publishReplaceable for events
     * that should persist and be replayed.
     */
    publish(input: PublishOptions): NostrEvent {
      const template: EventTemplate = {
        kind: input.kind,
        created_at: input.createdAt ?? Math.floor(Date.now() / 1000),
        tags: input.tags ?? [],
        content: input.content ?? '',
      };
      const event = finalizeEvent(template, this.sk);
      this.broadcast(JSON.stringify(['EVENT', event]));
      return event;
    }
  
    /**
     * Publish a NIP-33 parameterized-replaceable event (identified by its
     * `d` tag). Cached for automatic replay to relays that connect later.
     * Returns the signed event.
     */
    publishReplaceable(input: ReplaceableEventInput): NostrEvent {
      const kind = input.kind ?? this.replaceableKind;
      const template: EventTemplate = {
        kind,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['d', input.dTag], ...(input.tags ?? [])],
        content: input.content,
      };
  
      const event = finalizeEvent(template, this.sk);
      const msg = JSON.stringify(['EVENT', event]);
      this.publishReplayBuffer.set(`rep:${kind}:${input.dTag}`, msg);
      this.broadcast(msg);
  
      this.log('info', `Published replaceable event (kind=${kind}, d=${input.dTag})`);
      return event;
    }
  
    /**
     * Publish a replaceable event, then run a reliable snapshot query to
     * confirm relays actually accepted it. Generic publish-then-verify
     * workflow: retries the verification query on failure and reports a
     * best-effort sync/verification outcome.
     */
    async publishReplaceableWithVerify(options: PublishWithVerifyOptions): Promise<PublishVerifyResult> {
      const event = this.publishReplaceable(options);
      let verified = false;
  
      const snapshot = await this.query(options.verifyFilter, {
        ...options.query,
        onEvent: (e) => {
          if (e.id === event.id) verified = true;
          options.query?.onEvent?.(e);
        },
      });
  
      const status: RelaySyncStatus = verified
        ? snapshot.status
        : snapshot.status === 'synced'
          ? 'partial'
          : 'failed';
  
      const outcome: RelayPublishOutcome = verified
        ? status === 'synced'
          ? 'verified_synced'
          : 'verified_partial'
        : status === 'failed'
          ? 'failed'
          : 'verify_pending';
  
      return { status, meta: snapshot.meta, event, verified, outcome };
    }
  
    /**
     * Publish a deletion/tombstone marker for a previously published
     * replaceable event, identified by its `d` tag. Implemented as an
     * ordinary replaceable event via publishReplaceable — no new publish
     * mechanism, just the DELETION_TAG_VALUE convention layered on top.
     */
    publishDeletionMarker(dTag: string, extraTags: string[][] = [], kind?: number): NostrEvent {
      return this.publishReplaceable({
        dTag,
        tags: [['t', DELETION_TAG_VALUE], ...extraTags],
        content: '',
        kind,
      });
    }
  
    // ─── Subscriptions ──────────────────────────────────────────────────
  
    /**
     * Subscribe to events matching a filter. Stored and replayed to
     * late-connecting relays. onEose fires per relay (onEoseRelay) and once
     * overall (onEose) — useful for detecting when stored-event backfill is
     * complete. Returns a handle for convenient update/close.
     */
    subscribe(
      id: string,
      filter: NostrFilter,
      onEvent: (event: NostrEvent) => void,
      onEose?: () => void,
      onEoseRelay?: (relayUrl: string) => void,
    ): SubscriptionHandle {
      this.subscriptions.set(id, { id, filter, onEvent, onEose, onEoseRelay });
  
      for (const ws of this.sockets.values()) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(['REQ', id, filter]));
      }
  
      return {
        id,
        update: (nextFilter: NostrFilter) => this.updateSubscription(id, nextFilter),
        close: () => this.unsubscribe(id),
      };
    }
  
    /** Remove a subscription and send CLOSE to all connected relays. */
    unsubscribe(id: string): void {
      this.subscriptions.delete(id);
      for (const ws of this.sockets.values()) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(['CLOSE', id]));
      }
    }
  
    /**
     * Update an existing subscription with a new filter (same id, same
     * callbacks). Sends CLOSE then REQ with the new filter to all connected
     * relays — e.g. to expand a query's scope without tearing the subscription down.
     */
    updateSubscription(id: string, newFilter: NostrFilter): void {
      const sub = this.subscriptions.get(id);
      if (!sub) return;
      sub.filter = newFilter;
      for (const ws of this.sockets.values()) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(['CLOSE', id]));
          ws.send(JSON.stringify(['REQ', id, newFilter]));
        }
      }
    }
  
    // ─── Reliable snapshot queries ──────────────────────────────────────
  
    /**
     * Run a one-shot snapshot query: waits for relay readiness, subscribes,
     * collects events until every connected relay has sent EOSE (or a
     * timeout is hit), then closes the subscription. Retries on failure.
     *
     * This is the generic mechanism behind "give me all matching events
     * right now" — the caller decides what the filter and events mean.
     */
    async query(filter: NostrFilter, options: QueryOptions = {}): Promise<RelayQueryResult> {
      const timeoutMs = options.timeoutMs ?? 20000;
      const retries = options.retries ?? 2;
      const retryBackoffMs = options.retryBackoffMs ?? 500;
      const subIdPrefix = options.subIdPrefix ?? 'query';
  
      let last: RelayQueryResult | null = null;
  
      for (let attempt = 0; attempt <= retries; attempt++) {
        const ready = await this.waitReady(options);
  
        if (!ready.ok || ready.relayUrls.length === 0) {
          last = {
            status: 'failed',
            events: [],
            meta: { connectedAtStart: ready.connected, eoseReceived: 0, retriesUsed: attempt, timedOut: true },
          };
        } else {
          const result = await this.runSingleQuery(filter, subIdPrefix, ready.relayUrls, timeoutMs, options.onEvent);
          result.meta.retriesUsed = attempt;
          last = result;
          options.onMetrics?.({ ...result.meta, status: result.status });
          if (result.status !== 'failed') return result;
        }
  
        if (attempt < retries) await sleep(retryBackoffMs * (attempt + 1));
      }
  
      const fallback: RelayQueryResult = last ?? {
        status: 'failed',
        events: [],
        meta: { connectedAtStart: 0, eoseReceived: 0, retriesUsed: retries, timedOut: true },
      };
      options.onMetrics?.({ ...fallback.meta, status: fallback.status });
      return fallback;
    }
  
    private runSingleQuery(
      filter: NostrFilter,
      subIdPrefix: string,
      connectedRelayUrls: string[],
      timeoutMs: number,
      onEvent?: (event: NostrEvent) => void,
    ): Promise<RelayQueryResult> {
      const events: NostrEvent[] = [];
      const expected = new Set(connectedRelayUrls);
      const seenEose = new Set<string>();
      const subId = `${subIdPrefix}-${Date.now()}`;
  
      return new Promise((resolve) => {
        let settled = false;
        const finish = (timedOut: boolean) => {
          if (settled) return;
          settled = true;
          this.unsubscribe(subId);
  
          if (expected.size === 0) {
            resolve({
              status: 'failed',
              events,
              meta: { connectedAtStart: 0, eoseReceived: 0, retriesUsed: 0, timedOut },
            });
            return;
          }
  
          const allEose = seenEose.size >= expected.size;
          const hasSomeEose = seenEose.size > 0;
          const status: RelaySyncStatus = allEose ? 'synced' : hasSomeEose ? 'partial' : 'failed';
          resolve({
            status,
            events,
            meta: { connectedAtStart: expected.size, eoseReceived: seenEose.size, retriesUsed: 0, timedOut },
          });
        };
  
        const timeout = setTimeout(() => finish(true), timeoutMs);
  
        this.subscribe(
          subId,
          filter,
          (event) => {
            events.push(event);
            onEvent?.(event);
          },
          () => {},
          (relayUrl) => {
            if (expected.has(relayUrl)) seenEose.add(relayUrl);
            if (seenEose.size >= expected.size) {
              clearTimeout(timeout);
              finish(false);
            }
          },
        );
      });
    }
  
    // ─── NIP-44 encryption / encrypted events ──────────────────────────
  
    /** Get (or derive and cache) the NIP-44 conversation key for a peer. */
    private getConversationKey(peerPubkey: string): Uint8Array {
      let key = this.conversationKeys.get(peerPubkey);
      if (!key) {
        key = nip44.utils.getConversationKey(this.sk, peerPubkey);
        this.conversationKeys.set(peerPubkey, key);
      }
      return key;
    }
  
    /** NIP-44 encrypt plaintext for a given peer pubkey. */
    encrypt(peerPubkey: string, plaintext: string): string {
      return nip44.encrypt(plaintext, this.getConversationKey(peerPubkey));
    }
  
    /** NIP-44 decrypt ciphertext received from a given peer pubkey. */
    decrypt(peerPubkey: string, ciphertext: string): string {
      return nip44.decrypt(ciphertext, this.getConversationKey(peerPubkey));
    }
  
    /**
     * Sign, NIP-44 encrypt, and publish a payload string to a specific
     * pubkey. `tags` are additional plaintext tags (e.g. NIP-40 expiration);
     * `p` is always added automatically per NIP-44 convention.
     */
    sendEncrypted(toPubkey: string, plaintext: string, tags: string[][] = [], kind?: number): NostrEvent {
      const ciphertext = this.encrypt(toPubkey, plaintext);
      const template: EventTemplate = {
        kind: kind ?? this.encryptedKind,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', toPubkey], ...tags],
        content: ciphertext,
      };
      const event = finalizeEvent(template, this.sk);
      this.broadcast(JSON.stringify(['EVENT', event]));
      this.log('info', `Encrypted event sent to ${toPubkey.slice(0, 8)}`);
      return event;
    }
  
    /**
     * Subscribe to encrypted events matching a filter, decrypting each
     * with the sender's derived conversation key before calling back.
     * Decryption failures are swallowed (logged) rather than surfaced,
     * since a bad payload from one peer shouldn't break the subscription.
     * Returns the subscription handle.
     */
    subscribeEncrypted(
      filter: NostrFilter,
      onDecrypted: (fromPubkey: string, plaintext: string, event: NostrEvent) => void,
      id: string = `enc-${Date.now()}`,
    ): SubscriptionHandle {
      return this.subscribe(id, filter, (event: NostrEvent) => {
        try {
          const plaintext = this.decrypt(event.pubkey, event.content);
          onDecrypted(event.pubkey, plaintext, event);
        } catch {
          this.log('warn', `Failed to decrypt event from ${event.pubkey.slice(0, 8)}`);
        }
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // Internal utilities
  // ═══════════════════════════════════════════════════════════════════════
  
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }