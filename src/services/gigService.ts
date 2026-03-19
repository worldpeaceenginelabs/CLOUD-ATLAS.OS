/**
 * Gig Economy Service
 *
 * Domain layer for P2P matching over Nostr, parameterized by vertical.
 * Events on the relay are the single source of truth — both requester and
 * provider subscribe to their own events and derive state from them.
 *
 * Protocol (identical across all verticals):
 *   1. Requester publishes request event (status: 'open', NIP-40 TTL 60 s)
 *   2. Requester self-subscribes; heartbeat fires 20 s before expiration
 *   3. Providers subscribe to requests in their geohash cell
 *   4. Provider publishes availability event (NIP-40 TTL 60 s, same heartbeat)
 *   5. Provider sends stored encrypted 'accept' DM to requester (NIP-40 TTL 60 s)
 *   6. Requester picks winner, updates event (status: 'taken', matchedProviderPubkey)
 *   7. All providers see the update — winner matches, losers move on
 *   8. If either side crashes, heartbeats stop and the event expires on relays
 *
 * Event lifecycle (NIP-40):
 *   Every published event carries an ['expiration', unix] tag.
 *   Relays that support NIP-40 automatically stop serving expired events.
 *   Both sides also run local expiration timers as a fallback.
 *   Self-subscriptions resync heartbeat timing with the relay's actual state.
 *
 * Messages:
 *   Public events:  request (open → taken/cancelled), provider availability
 *   Encrypted DMs:  accept (provider → requester, NIP-40 TTL 60 s) — the only DM in the protocol
 *
 * Vertical separation:
 *   Each vertical uses distinct Nostr '#t' tags (e.g. 'need-rides', 'offer-rides')
 *   so events from different verticals never interfere.
 */

import { type NostrService, type NostrEvent } from './nostrService';
import { logger } from '../utils/logger';
import type { GigRequest, GigVertical } from '../types';
import { REQUEST_TTL_SECS, EXPAND_WHEN_EMPTY_SECS, EXPAND_WHEN_NO_MATCH_SECS } from '../gig/constants';
import { cells3x3, cells4x4, cellsInG5 } from '../utils/geohash';
import {
  onRelayStatus,
  buildReplaceableFilter,
  publishReplaceable,
  sendDm,
  openStream,
  openDmStream,
  type RelayStreamHandle,
} from './relayOrchestrator';

// ─── Constants ────────────────────────────────────────────────

/** Heartbeat fires this many seconds before the event's expiration. */
const HEARTBEAT_LEAD_SECS = 20;

/** If remaining TTL drops below this, treat the event as expired. */
const MIN_VIABLE_TTL_SECS = 15;

/** Current unix timestamp + REQUEST_TTL_SECS. */
const freshExpiration = (): number => Math.floor(Date.now() / 1000) + REQUEST_TTL_SECS;

/** Build the standard NIP-33 tag set for a gig event. */
const buildTags = (geohash: string, type: string): string[][] => [
  ['g', geohash],
  ['t', type],
  ['expiration', String(freshExpiration())],
];

// ─── Types ───────────────────────────────────────────────────

export interface GigCallbacks {
  /** Relay connection count changed. */
  onRelayStatus: (connected: number, total: number) => void;
  /** Provider: a new open request appeared in the cell. */
  onRequest: (request: GigRequest) => void;
  /** Provider: a request was taken, cancelled, or expired. */
  onRequestGone: (requestId: string, matchedProviderPubkey: string | null) => void;
  /** Requester: a provider sent an accept for our request (includes provider's form details). */
  onProviderAccepted: (providerPubkey: string, requestId: string, details?: Record<string, string>) => void;
  /** Requester: number of available providers in the cell changed. */
  onProviderCount?: (count: number) => void;
  /** Requester: own request expired or disappeared from relays. */
  onOwnRequestExpired?: () => void;
  /** Provider: own availability event expired or disappeared from relays. */
  onOwnOfferExpired?: () => void;
}

/** The only DM type in the protocol. */
interface AcceptDM {
  type: 'accept';
  requestId: string;
  providerPubkey: string;
  details?: Record<string, string>;
}

// ─── Service ─────────────────────────────────────────────────

export class GigService {
  private nostr: NostrService;
  private callbacks: GigCallbacks;
  private needTag: string;
  private offerTag: string;
  private knownRequests = new Set<string>();
  private knownProviders = new Set<string>();
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private expirationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private dmSubId: string | null = null;
  private selfRequestStream: RelayStreamHandle | null = null;
  private selfAvailStream: RelayStreamHandle | null = null;
  private needRequestsStream: RelayStreamHandle | null = null;
  private providerAvailStream: RelayStreamHandle | null = null;
  private dmStream: RelayStreamHandle | null = null;

  // Expand subscription based on visibility / match status (1 → 9 → 16 → 32 cells)
  private expandEmptyTimer: ReturnType<typeof setTimeout> | null = null;
  private expandNoMatchTimer: ReturnType<typeof setTimeout> | null = null;
  private expandLevel = 0; // 0=1 cell, 1=9, 2=16, 3=32 (G5)
  private sinceAtStart = 0;
  private hasMatch = false;

  // Stored for heartbeat re-publish
  private myRequest: GigRequest | null = null;
  private myGeohash: string | null = null;
  private myProviderLocation: { latitude: number; longitude: number } | null = null;
  private myProviderDetails: Record<string, string> = {};

  constructor(nostr: NostrService, vertical: GigVertical, callbacks: GigCallbacks) {
    this.nostr = nostr;
    this.callbacks = callbacks;
    this.needTag = `need-${vertical}`;
    this.offerTag = `offer-${vertical}`;
  }

  /** Our Nostr public key. */
  get pubkey(): string {
    return this.nostr.pubkey;
  }

  // ─── Requester ──────────────────────────────────────────────

  /**
   * Start as a requester. Publishes the request event,
   * self-subscribes for lifecycle management, and subscribes
   * to accept DMs and provider availability.
   */
  startAsRequester(geohash: string, request: GigRequest): void {
    this.myRequest = request;
    this.myGeohash = geohash;
    this.hasMatch = false;

    onRelayStatus(this.nostr, this.callbacks.onRelayStatus);

    publishReplaceable(this.nostr, request.id, buildTags(geohash, this.needTag), JSON.stringify(request));
    this.scheduleHeartbeat(freshExpiration());

    // Self-subscribe to own request — relay echo drives heartbeat timing
    this.selfRequestStream?.close();
    this.selfRequestStream = openStream(this.nostr, {
      id: 'self-request',
      filter: buildReplaceableFilter({
        authors: [this.nostr.pubkey],
        dTags: [request.id],
      }),
      onEvent: (event: NostrEvent) => this.handleOwnEvent(event),
    });

    // Subscribe to incoming accept DMs
    this.dmStream?.close();
    this.dmStream = openDmStream(this.nostr, REQUEST_TTL_SECS, (fromPubkey: string, payload: unknown) => {
      const dm = payload as AcceptDM;
      if (dm?.type === 'accept' && dm.requestId === this.myRequest?.id) {
        // A provider explicitly wants to match with us
        this.hasMatch = true;
        this.clearExpandTimers();
        this.callbacks.onProviderAccepted(fromPubkey, dm.requestId, dm.details);
      }
    });
    this.dmSubId = this.dmStream.id;

    this.sinceAtStart = Math.floor(Date.now() / 1000) - REQUEST_TTL_SECS;
    this.expandLevel = 0;

    // Subscribe to provider availability events to show count
    this.providerAvailStream?.close();
    this.providerAvailStream = openStream(this.nostr, {
      id: 'provider-avail',
      filter: buildReplaceableFilter({
        gTags: [geohash],
        tTags: [this.offerTag],
        since: this.sinceAtStart,
      }),
      onEvent: (event: NostrEvent) => this.handleProviderAvailEvent(event),
    });

    this.scheduleExpandTimers();
    logger.info(`Requester started in cell ${geohash} [${this.needTag}]`, { component: 'GigService', operation: 'startAsRequester' });
  }

  /**
   * Requester confirms the winning provider.
   * Updates the request event with status 'taken' and the winner's pubkey.
   */
  confirmMatch(request: GigRequest, providerPubkey: string): void {
    this.clearHeartbeat();
    this.clearExpandTimers();

    const updated: GigRequest = {
      ...request,
      status: 'taken',
      matchedProviderPubkey: providerPubkey,
    };

    publishReplaceable(this.nostr, request.id, buildTags(request.geohash, this.needTag), JSON.stringify(updated));

    logger.info(`Match confirmed with provider ${providerPubkey.slice(0, 8)}`, { component: 'GigService', operation: 'confirmMatch' });
  }

  /** Requester cancels their request. Updates event status to 'cancelled'. */
  cancelRequest(request: GigRequest): void {
    this.clearHeartbeat();
    this.clearExpandTimers();

    const updated: GigRequest = {
      ...request,
      status: 'cancelled',
      matchedProviderPubkey: null,
    };

    publishReplaceable(this.nostr, request.id, buildTags(request.geohash, this.needTag), JSON.stringify(updated));

    logger.info('Request cancelled', { component: 'GigService', operation: 'cancelRequest' });
  }

  // ─── Provider ────────────────────────────────────────────────

  /**
   * Start as a provider. Publishes availability with NIP-40 TTL,
   * self-subscribes for lifecycle management, and subscribes to
   * requests in the cell.
   */
  startAsProvider(
    geohash: string,
    location: { latitude: number; longitude: number },
    details: Record<string, string> = {},
  ): void {
    this.myGeohash = geohash;
    this.myProviderLocation = location;
    this.myProviderDetails = details;
    this.hasMatch = false;

    onRelayStatus(this.nostr, this.callbacks.onRelayStatus);

    publishReplaceable(
      this.nostr,
      this.offerTag,
      buildTags(geohash, this.offerTag),
      JSON.stringify({ location, details }),
    );
    this.scheduleHeartbeat(freshExpiration());

    // Self-subscribe to own availability event
    this.selfAvailStream?.close();
    this.selfAvailStream = openStream(this.nostr, {
      id: 'self-avail',
      filter: buildReplaceableFilter({
        authors: [this.nostr.pubkey],
        dTags: [this.offerTag],
      }),
      onEvent: (event: NostrEvent) => this.handleOwnEvent(event),
    });

    this.sinceAtStart = Math.floor(Date.now() / 1000) - REQUEST_TTL_SECS;
    this.expandLevel = 0;

    // Subscribe to requests in this cell
    this.needRequestsStream?.close();
    this.needRequestsStream = openStream(this.nostr, {
      id: 'need-requests',
      filter: buildReplaceableFilter({
        gTags: [geohash],
        tTags: [this.needTag],
        since: this.sinceAtStart,
      }),
      onEvent: (event: NostrEvent) => this.handleRequestEvent(event),
    });

    this.scheduleExpandTimers();
    logger.info(`Provider started in cell ${geohash} [${this.offerTag}]`, { component: 'GigService', operation: 'startAsProvider' });
  }

  /**
   * Provider accepts a request.
   * Sends an encrypted DM to the requester.
   * Returns true if sent, false on error.
   */
  acceptRequest(requesterPubkey: string, requestId: string): boolean {
    try {
      const dm: AcceptDM = {
        type: 'accept',
        requestId,
        providerPubkey: this.pubkey,
        details: Object.keys(this.myProviderDetails).length > 0 ? this.myProviderDetails : undefined,
      };
      sendDm(this.nostr, requesterPubkey, dm, REQUEST_TTL_SECS);
      return true;
    } catch (e) {
      logger.error(`Failed to send accept DM: ${e}`, { component: 'GigService', operation: 'acceptRequest' });
      return false;
    }
  }

  // ─── Heartbeat ────────────────────────────────────────────

  /**
   * Schedule the next heartbeat based on an event's expiration timestamp.
   * Fires HEARTBEAT_LEAD_SECS before expiration to re-publish with fresh TTL.
   */
  private scheduleHeartbeat(expiration: number): void {
    this.clearHeartbeat();

    const now = Date.now() / 1000;
    const remaining = expiration - now;

    if (remaining < MIN_VIABLE_TTL_SECS) {
      this.handleExpired();
      return;
    }

    const delayMs = Math.max(0, (remaining - HEARTBEAT_LEAD_SECS) * 1000);

    this.heartbeatTimer = setTimeout(() => {
      this.heartbeatTimer = null;
      this.fireHeartbeat();
    }, delayMs);
  }

  /** Re-publish the current event with a fresh TTL. */
  private fireHeartbeat(): void {
    if (this.myRequest && this.myGeohash && this.myRequest.status === 'open') {
      publishReplaceable(this.nostr, this.myRequest.id, buildTags(this.myGeohash, this.needTag), JSON.stringify(this.myRequest));
      this.scheduleHeartbeat(freshExpiration());
    } else if (this.myProviderLocation && this.myGeohash) {
      publishReplaceable(
        this.nostr,
        this.offerTag,
        buildTags(this.myGeohash, this.offerTag),
        JSON.stringify({ location: this.myProviderLocation, details: this.myProviderDetails }),
      );
      this.scheduleHeartbeat(freshExpiration());
    }
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ─── Expand subscription ────────────────────────────────────

  /** Start or restart both expansion timers (empty in 15s, no-match in 30s). Does not reset expandLevel. */
  private scheduleExpandTimers(): void {
    if (this.expandEmptyTimer) {
      clearTimeout(this.expandEmptyTimer);
      this.expandEmptyTimer = null;
    }
    if (this.expandNoMatchTimer) {
      clearTimeout(this.expandNoMatchTimer);
      this.expandNoMatchTimer = null;
    }
    if (!this.myGeohash) return;

    this.expandEmptyTimer = setTimeout(() => {
      this.handleExpandTrigger('empty');
      if (!this.hasMatch && this.expandLevel < 3) {
        this.expandEmptyTimer = setTimeout(() => this.handleExpandTrigger('empty'), EXPAND_WHEN_EMPTY_SECS * 1000);
      }
    }, EXPAND_WHEN_EMPTY_SECS * 1000);

    this.expandNoMatchTimer = setTimeout(() => {
      this.handleExpandTrigger('no-match');
      if (!this.hasMatch && this.expandLevel < 3) {
        this.expandNoMatchTimer = setTimeout(() => this.handleExpandTrigger('no-match'), EXPAND_WHEN_NO_MATCH_SECS * 1000);
      }
    }, EXPAND_WHEN_NO_MATCH_SECS * 1000);
  }

  /** Stop all expansion timers and reset expansion level. */
  private clearExpandTimers(): void {
    if (this.expandEmptyTimer) {
      clearTimeout(this.expandEmptyTimer);
      this.expandEmptyTimer = null;
    }
    if (this.expandNoMatchTimer) {
      clearTimeout(this.expandNoMatchTimer);
      this.expandNoMatchTimer = null;
    }
    this.expandLevel = 0;
  }

  /**
   * Handle an expansion trigger:
   * - reason 'empty': list still empty?
   * - reason 'no-match': still no match?
   */
  private handleExpandTrigger(reason: 'empty' | 'no-match'): void {
    const geohash = this.myGeohash;
    if (!geohash || this.expandLevel >= 3 || this.hasMatch) return;

    const asRequester = !!this.myRequest;

    if (reason === 'empty') {
      const isEmpty = asRequester ? this.knownProviders.size === 0 : this.knownRequests.size === 0;
      if (!isEmpty) return;
    } else {
      if (this.hasMatch) return;
    }

    const nextLevel = this.expandLevel + 1;
    const cells = nextLevel === 1 ? cells3x3(geohash) : nextLevel === 2 ? cells4x4(geohash) : cellsInG5(geohash);
    if (asRequester) {
      this.providerAvailStream?.update({
        ...buildReplaceableFilter({
          gTags: cells,
          tTags: [this.offerTag],
          since: this.sinceAtStart,
        }),
      });
    } else {
      this.needRequestsStream?.update({
        ...buildReplaceableFilter({
          gTags: cells,
          tTags: [this.needTag],
          since: this.sinceAtStart,
        }),
      });
    }

    this.expandLevel = nextLevel;
    logger.info(
      `Subscription expanded (${reason}) to ${cells.length} cells (level ${nextLevel})`,
      { component: 'GigService', operation: 'handleExpandTrigger' },
    );
    if (nextLevel < 3) this.scheduleExpandTimers();
  }

  /** Called when the event's TTL is below MIN_VIABLE_TTL_SECS or gone from relay. */
  private handleExpired(): void {
    this.clearHeartbeat();
    if (this.myRequest) {
      this.callbacks.onOwnRequestExpired?.();
    } else if (this.myProviderLocation) {
      this.callbacks.onOwnOfferExpired?.();
    }
  }

  // ─── Self-Subscription Handlers ───────────────────────────

  /** Relay echoed our event back — resync heartbeat to its actual expiration. */
  private handleOwnEvent(event: NostrEvent): void {
    const expiration = this.getExpiration(event);
    if (expiration) this.scheduleHeartbeat(expiration);
  }

  // ─── Event Handling ────────────────────────────────────────

  /**
   * Handle an incoming request event (provider side).
   * Differentiates between new requests, heartbeats, status updates,
   * and expired events.
   */
  private handleRequestEvent(event: NostrEvent): void {
    if (!event.content) return;

    try {
      const request: GigRequest = JSON.parse(event.content);
      request.pubkey = event.pubkey;

      const expiration = this.getExpiration(event);

      if (expiration && Date.now() / 1000 > expiration) {
        if (this.knownRequests.has(request.id)) {
          this.knownRequests.delete(request.id);
          this.clearExpirationTimer(`req:${request.id}`);
          this.callbacks.onRequestGone(request.id, null);
        }
        return;
      }

      if (this.knownRequests.has(request.id)) {
        if (request.status === 'taken' || request.status === 'cancelled') {
          // If we are the winner, that counts as a match (provider side)
          if (request.status === 'taken' && request.matchedProviderPubkey === this.pubkey) {
            this.hasMatch = true;
            this.clearExpandTimers();
          }
          this.knownRequests.delete(request.id);
          this.clearExpirationTimer(`req:${request.id}`);
          this.callbacks.onRequestGone(request.id, request.matchedProviderPubkey);
        } else if (request.status === 'open' && expiration) {
          this.setRequestExpirationTimer(request.id, expiration);
        }
      } else if (request.status === 'open') {
        this.knownRequests.add(request.id);
        if (expiration) {
          this.setRequestExpirationTimer(request.id, expiration);
        }
        this.callbacks.onRequest(request);
      }
    } catch {
      logger.warn('Malformed request event', { component: 'GigService', operation: 'handleRequestEvent' });
    }
  }

  /**
   * Handle a provider availability event (requester side).
   * Tracks provider pubkeys with expiration timers and fires onProviderCount.
   */
  private handleProviderAvailEvent(event: NostrEvent): void {
    if (!event.content) {
      this.removeProvider(event.pubkey);
      return;
    }

    const expiration = this.getExpiration(event);

    if (expiration && Date.now() / 1000 > expiration) {
      this.removeProvider(event.pubkey);
      return;
    }

    if (!this.knownProviders.has(event.pubkey)) {
      this.knownProviders.add(event.pubkey);
      this.callbacks.onProviderCount?.(this.knownProviders.size);
    }

    if (expiration) {
      this.setExpirationTimer(`prv:${event.pubkey}`, expiration, () => {
        this.removeProvider(event.pubkey);
        logger.info(`Provider ${event.pubkey.slice(0, 8)} expired locally`, { component: 'GigService', operation: 'expirationTimer' });
      });
    }
  }

  /** Remove a provider from tracking and update the count. */
  private removeProvider(pubkey: string): void {
    this.clearExpirationTimer(`prv:${pubkey}`);
    if (this.knownProviders.delete(pubkey)) {
      this.callbacks.onProviderCount?.(this.knownProviders.size);
    }
  }

  // ─── Expiration Timers ────────────────────────────────────

  /** Extract the NIP-40 expiration timestamp from an event's tags. */
  private getExpiration(event: NostrEvent): number | null {
    const tag = event.tags?.find(t => t[0] === 'expiration');
    return tag ? parseInt(tag[1], 10) : null;
  }

  /**
   * Start (or reset) a keyed expiration timer.
   * When it fires, onExpire is called and the timer is removed.
   */
  private setExpirationTimer(key: string, expiration: number, onExpire: () => void): void {
    this.clearExpirationTimer(key);
    const delayMs = Math.max(0, (expiration - Date.now() / 1000) * 1000);

    this.expirationTimers.set(key, setTimeout(() => {
      this.expirationTimers.delete(key);
      onExpire();
    }, delayMs));
  }

  /** Clear a pending expiration timer by key. */
  private clearExpirationTimer(key: string): void {
    const timer = this.expirationTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.expirationTimers.delete(key);
    }
  }

  /** Convenience: set a request expiration timer with standard cleanup. */
  private setRequestExpirationTimer(requestId: string, expiration: number): void {
    this.setExpirationTimer(`req:${requestId}`, expiration, () => {
      if (this.knownRequests.has(requestId)) {
        this.knownRequests.delete(requestId);
        this.callbacks.onRequestGone(requestId, null);
        logger.info(`Request ${requestId.slice(0, 8)} expired locally`, { component: 'GigService', operation: 'expirationTimer' });
      }
    });
  }

  // ─── Cleanup ───────────────────────────────────────────────

  /**
   * Stop the service. Clears local state and removes subscriptions.
   * Events expire on relays via NIP-40 TTL — no deletion needed.
   * Shared NostrService connections remain open for other consumers.
   */
  stop(): void {
    this.clearHeartbeat();
    this.clearExpandTimers();

    for (const timer of this.expirationTimers.values()) clearTimeout(timer);
    this.expirationTimers.clear();

    // Remove our subscriptions from the shared NostrService
    this.selfRequestStream?.close();
    this.selfAvailStream?.close();
    this.needRequestsStream?.close();
    this.providerAvailStream?.close();
    this.dmStream?.close();

    this.knownRequests.clear();
    this.knownProviders.clear();
    this.myRequest = null;
    this.myGeohash = null;
    this.myProviderLocation = null;
    this.myProviderDetails = {};
    this.dmSubId = null;
    this.selfRequestStream = null;
    this.selfAvailStream = null;
    this.needRequestsStream = null;
    this.providerAvailStream = null;
    this.dmStream = null;

    logger.info('GigService stopped', { component: 'GigService', operation: 'stop' });
  }
}
