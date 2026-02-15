/**
 * Gig Economy Service
 *
 * Domain layer for ride matching over Nostr.
 * Events on the relay are the single source of truth — both rider and
 * driver subscribe to their own events and derive state from them.
 *
 * Protocol:
 *   1. Rider publishes ride request event (status: 'open', NIP-40 TTL 60 s)
 *   2. Rider self-subscribes; heartbeat fires 20 s before expiration
 *   3. Drivers subscribe to ride requests in their geohash cell
 *   4. Driver publishes availability event (NIP-40 TTL 60 s, same heartbeat)
 *   5. Driver sends encrypted 'accept' DM to rider
 *   6. Rider picks winner, updates event (status: 'taken', matchedDriverPubkey)
 *   7. All drivers see the update — winner matches, losers move on
 *   8. If either side crashes, heartbeats stop and the event expires on relays
 *
 * Event lifecycle (NIP-40):
 *   Every published event carries an ['expiration', unix] tag.
 *   Relays that support NIP-40 automatically stop serving expired events.
 *   Both sides also run local expiration timers as a fallback.
 *   Self-subscriptions resync heartbeat timing with the relay's actual state.
 *
 * Messages:
 *   Public events:  ride request (open → taken/cancelled), driver availability
 *   Encrypted DMs:  accept (driver → rider) — the only DM in the protocol
 */

import { NostrService, REPLACEABLE_KIND, type NostrEvent } from './nostrService';
import { logger } from '../utils/logger';
import type { RideRequest } from '../types';

// ─── Constants ────────────────────────────────────────────────

/** NIP-40 expiration: seconds from now until the event expires on relays. */
const REQUEST_TTL_SECS = 60;

/** Heartbeat fires this many seconds before the event's expiration. */
const HEARTBEAT_LEAD_SECS = 20;

/** If remaining TTL drops below this, treat the event as expired. */
const MIN_VIABLE_TTL_SECS = 15;

/** Current unix timestamp + REQUEST_TTL_SECS. */
const freshExpiration = (): number => Math.floor(Date.now() / 1000) + REQUEST_TTL_SECS;

/** Build the standard NIP-33 tag set for a gig event. */
const buildTags = (geohash: string, type: 'ride-request' | 'driver-avail'): string[][] => [
  ['g', geohash],
  ['t', type],
  ['expiration', String(freshExpiration())],
];

// ─── Types ───────────────────────────────────────────────────

export interface GigCallbacks {
  /** Relay connection count changed. */
  onRelayStatus: (connected: number, total: number) => void;
  /** Driver: a new open ride request appeared in the cell. */
  onRideRequest: (request: RideRequest) => void;
  /** Driver: a ride request was taken, cancelled, or expired. */
  onRideRequestGone: (requestId: string, matchedDriverPubkey: string | null) => void;
  /** Rider: a driver sent an accept for our request. */
  onDriverAccepted: (driverPubkey: string, requestId: string) => void;
  /** Rider: number of available drivers in the cell changed. */
  onDriverCount?: (count: number) => void;
  /** Rider: own ride request expired or disappeared from relays. */
  onOwnRequestExpired?: () => void;
  /** Driver: own availability event expired or disappeared from relays. */
  onOwnAvailExpired?: () => void;
}

/** The only DM type in the protocol. */
interface AcceptDM {
  type: 'accept';
  requestId: string;
  driverPubkey: string;
}

// ─── Service ─────────────────────────────────────────────────

export class GigService {
  private nostr: NostrService;
  private callbacks: GigCallbacks;
  private knownRequests = new Set<string>();            // requestIds we've delivered to the component
  private knownDrivers = new Set<string>();             // driver pubkeys seen in the cell (for rider count)
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private expirationTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Stored for heartbeat re-publish
  private myRequest: RideRequest | null = null;
  private myGeohash: string | null = null;
  private myDriverLocation: { latitude: number; longitude: number } | null = null;

  constructor(callbacks: GigCallbacks) {
    this.nostr = new NostrService();
    this.callbacks = callbacks;
  }

  /** Our Nostr public key. */
  get pubkey(): string {
    return this.nostr.pubkey;
  }

  // ─── Rider ─────────────────────────────────────────────────

  /**
   * Start as a rider. Publishes the ride request event,
   * self-subscribes for lifecycle management, and subscribes
   * to accept DMs and driver availability.
   */
  startAsRider(geohash: string, request: RideRequest): void {
    this.myRequest = request;
    this.myGeohash = geohash;

    // Wire up relay status
    this.nostr.onRelayCountChange(this.callbacks.onRelayStatus);

    // Publish ride request as a public replaceable event with NIP-40 TTL
    this.nostr.publishReplaceable(request.id, buildTags(geohash, 'ride-request'), JSON.stringify(request));

    // Schedule first heartbeat (we just published, so full TTL from now)
    this.scheduleHeartbeat(freshExpiration());

    // Self-subscribe to own ride request — relay echo drives heartbeat timing
    this.nostr.subscribe('self-request', {
      kinds: [REPLACEABLE_KIND],
      authors: [this.nostr.pubkey],
      '#d': [request.id],
    }, (event: NostrEvent) => this.handleOwnEvent(event));

    // Subscribe to incoming accept DMs
    this.nostr.subscribeDMs(REQUEST_TTL_SECS, (fromPubkey: string, payload: unknown) => {
      const dm = payload as AcceptDM;
      if (dm?.type === 'accept' && dm.requestId === this.myRequest?.id) {
        this.callbacks.onDriverAccepted(fromPubkey, dm.requestId);
      }
    });

    // Subscribe to driver availability events to show count
    this.nostr.subscribe('driver-avail', {
      kinds: [REPLACEABLE_KIND],
      '#g': [geohash],
      '#t': ['driver-avail'],
      since: Math.floor(Date.now() / 1000) - REQUEST_TTL_SECS,
    }, (event: NostrEvent) => this.handleDriverAvailEvent(event));

    // Connect to relays in the background
    this.nostr.connectInBackground();

    logger.info(`Rider started in cell ${geohash}`, { component: 'GigService', operation: 'startAsRider' });
  }

  /**
   * Rider confirms the winning driver.
   * Updates the ride request event with status 'taken' and the winner's pubkey.
   * Every driver in the cell sees this through their subscription.
   */
  confirmMatch(request: RideRequest, driverPubkey: string): void {
    this.clearHeartbeat();

    const updated: RideRequest = {
      ...request,
      status: 'taken',
      matchedDriverPubkey: driverPubkey,
    };

    this.nostr.publishReplaceable(request.id, buildTags(request.geohash, 'ride-request'), JSON.stringify(updated));

    logger.info(`Match confirmed with driver ${driverPubkey.slice(0, 8)}`, { component: 'GigService', operation: 'confirmMatch' });
  }

  /** Rider cancels their request. Updates event status to 'cancelled'. */
  cancelRequest(request: RideRequest): void {
    this.clearHeartbeat();

    const updated: RideRequest = {
      ...request,
      status: 'cancelled',
      matchedDriverPubkey: null,
    };

    this.nostr.publishReplaceable(request.id, buildTags(request.geohash, 'ride-request'), JSON.stringify(updated));

    logger.info('Ride request cancelled', { component: 'GigService', operation: 'cancelRequest' });
  }

  // ─── Driver ────────────────────────────────────────────────

  /**
   * Start as a driver. Publishes availability with NIP-40 TTL,
   * self-subscribes for lifecycle management, and subscribes to
   * ride requests in the cell.
   */
  startAsDriver(geohash: string, location: { latitude: number; longitude: number }): void {
    this.myGeohash = geohash;
    this.myDriverLocation = location;

    // Wire up relay status
    this.nostr.onRelayCountChange(this.callbacks.onRelayStatus);

    // Publish driver availability with NIP-40 TTL
    this.nostr.publishReplaceable('driver-avail', buildTags(geohash, 'driver-avail'), JSON.stringify({ location }));

    // Schedule first heartbeat (we just published, so full TTL from now)
    this.scheduleHeartbeat(freshExpiration());

    // Self-subscribe to own driver-avail event — relay echo drives heartbeat timing
    this.nostr.subscribe('self-avail', {
      kinds: [REPLACEABLE_KIND],
      authors: [this.nostr.pubkey],
      '#d': ['driver-avail'],
    }, (event: NostrEvent) => this.handleOwnEvent(event));

    // Subscribe to ride requests in this cell
    this.nostr.subscribe('ride-requests', {
      kinds: [REPLACEABLE_KIND],
      '#g': [geohash],
      '#t': ['ride-request'],
      since: Math.floor(Date.now() / 1000) - REQUEST_TTL_SECS,
    }, (event: NostrEvent) => this.handleRideRequestEvent(event));

    // Connect to relays in the background
    this.nostr.connectInBackground();

    logger.info(`Driver started in cell ${geohash}`, { component: 'GigService', operation: 'startAsDriver' });
  }

  /**
   * Driver accepts a ride request.
   * Sends an encrypted DM to the rider.
   * Returns true if sent, false on error.
   */
  acceptRequest(riderPubkey: string, requestId: string): boolean {
    try {
      const dm: AcceptDM = {
        type: 'accept',
        requestId,
        driverPubkey: this.pubkey,
      };
      this.nostr.sendDM(riderPubkey, dm);
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
      // Too late to recover — treat as expired
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
      // Rider heartbeat
      this.nostr.publishReplaceable(this.myRequest.id, buildTags(this.myGeohash, 'ride-request'), JSON.stringify(this.myRequest));
      this.scheduleHeartbeat(freshExpiration());
    } else if (this.myDriverLocation && this.myGeohash) {
      // Driver heartbeat
      this.nostr.publishReplaceable('driver-avail', buildTags(this.myGeohash, 'driver-avail'), JSON.stringify({ location: this.myDriverLocation }));
      this.scheduleHeartbeat(freshExpiration());
    }
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Called when the event's TTL is below MIN_VIABLE_TTL_SECS or gone from relay. */
  private handleExpired(): void {
    this.clearHeartbeat();
    if (this.myRequest) {
      this.callbacks.onOwnRequestExpired?.();
    } else if (this.myDriverLocation) {
      this.callbacks.onOwnAvailExpired?.();
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
   * Handle an incoming ride request event (driver side).
   * Differentiates between new requests, heartbeats, status updates,
   * and expired events.
   */
  private handleRideRequestEvent(event: NostrEvent): void {
    // Ignore empty events (deleted/replaced with no content)
    if (!event.content) return;

    try {
      const request: RideRequest = JSON.parse(event.content);
      // Ensure pubkey matches the event author (tamper-proof)
      request.pubkey = event.pubkey;

      // Extract NIP-40 expiration from event tags
      const expiration = this.getExpiration(event);

      // Check if expired
      if (expiration && Date.now() / 1000 > expiration) {
        if (this.knownRequests.has(request.id)) {
          // Known request expired — treat as gone
          this.knownRequests.delete(request.id);
          this.clearExpirationTimer(`req:${request.id}`);
          this.callbacks.onRideRequestGone(request.id, null);
        }
        // Unknown expired request — ignore
        return;
      }

      if (this.knownRequests.has(request.id)) {
        if (request.status === 'taken' || request.status === 'cancelled') {
          // Status changed — gone
          this.knownRequests.delete(request.id);
          this.clearExpirationTimer(`req:${request.id}`);
          this.callbacks.onRideRequestGone(request.id, request.matchedDriverPubkey);
        } else if (request.status === 'open' && expiration) {
          // Heartbeat — reset expiration timer
          this.setRequestExpirationTimer(request.id, expiration);
        }
      } else if (request.status === 'open') {
        // New open request
        this.knownRequests.add(request.id);
        if (expiration) {
          this.setRequestExpirationTimer(request.id, expiration);
        }
        this.callbacks.onRideRequest(request);
      }
      // Ignore historical taken/cancelled events we never saw as open
    } catch {
      logger.warn('Malformed ride request event', { component: 'GigService', operation: 'handleRideRequestEvent' });
    }
  }

  /**
   * Handle a driver availability event (rider side).
   * Tracks driver pubkeys with expiration timers and fires onDriverCount.
   */
  private handleDriverAvailEvent(event: NostrEvent): void {
    if (!event.content) {
      // Empty content = driver went offline — remove them
      this.removeDriver(event.pubkey);
      return;
    }

    // Extract NIP-40 expiration from event tags
    const expiration = this.getExpiration(event);

    // Check if expired
    if (expiration && Date.now() / 1000 > expiration) {
      // Expired driver — remove if known
      this.removeDriver(event.pubkey);
      return;
    }

    if (!this.knownDrivers.has(event.pubkey)) {
      this.knownDrivers.add(event.pubkey);
      this.callbacks.onDriverCount?.(this.knownDrivers.size);
    }

    // Start or reset expiration timer for this driver
    if (expiration) {
      this.setExpirationTimer(`drv:${event.pubkey}`, expiration, () => {
        this.removeDriver(event.pubkey);
        logger.info(`Driver ${event.pubkey.slice(0, 8)} expired locally`, { component: 'GigService', operation: 'expirationTimer' });
      });
    }
  }

  /** Remove a driver from tracking and update the count. */
  private removeDriver(pubkey: string): void {
    this.clearExpirationTimer(`drv:${pubkey}`);
    if (this.knownDrivers.delete(pubkey)) {
      this.callbacks.onDriverCount?.(this.knownDrivers.size);
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

  /** Convenience: set a ride-request expiration timer with standard cleanup. */
  private setRequestExpirationTimer(requestId: string, expiration: number): void {
    this.setExpirationTimer(`req:${requestId}`, expiration, () => {
      if (this.knownRequests.has(requestId)) {
        this.knownRequests.delete(requestId);
        this.callbacks.onRideRequestGone(requestId, null);
        logger.info(`Request ${requestId.slice(0, 8)} expired locally`, { component: 'GigService', operation: 'expirationTimer' });
      }
    });
  }

  // ─── Cleanup ───────────────────────────────────────────────

  /**
   * Stop the service. Clears local state and disconnects.
   * Events expire on relays via NIP-40 TTL — no deletion needed.
   */
  stop(): void {
    this.clearHeartbeat();

    for (const timer of this.expirationTimers.values()) clearTimeout(timer);
    this.expirationTimers.clear();

    this.knownRequests.clear();
    this.knownDrivers.clear();
    this.myRequest = null;
    this.myGeohash = null;
    this.myDriverLocation = null;
    this.nostr.disconnect();

    logger.info('GigService stopped', { component: 'GigService', operation: 'stop' });
  }
}
