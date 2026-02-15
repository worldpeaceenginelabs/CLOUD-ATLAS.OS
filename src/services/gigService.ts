/**
 * Gig Economy Service
 *
 * Domain layer for ride matching over Nostr.
 * The rider's request event is the single source of truth.
 *
 * Protocol:
 *   1. Rider publishes ride request event (status: 'open', NIP-40 TTL 60 s)
 *   2. Rider heartbeats every 45 s — re-publishes with fresh expiration
 *   3. Drivers subscribe to ride requests in their geohash cell
 *   4. Driver sends encrypted 'accept' DM to rider
 *   5. Rider picks winner, updates event (status: 'taken', matchedDriverPubkey)
 *   6. All drivers see the update — winner matches, losers move on
 *   7. If the rider crashes, heartbeats stop and the event expires on relays
 *
 * Event lifecycle (NIP-40):
 *   Every ride request event carries an ['expiration', unix] tag.
 *   Relays that support NIP-40 automatically stop serving expired events.
 *   The driver side also runs a local timer per request — when it fires,
 *   the request is treated as gone (same path as cancelled/taken).
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
  private myRequestId: string | null = null;            // rider's own request ID (to filter DMs)
  private expirationTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
   * Start as a rider. Publishes the ride request event and
   * subscribes to accept DMs from drivers.
   */
  startAsRider(geohash: string, request: RideRequest): void {
    this.myRequestId = request.id;

    // Wire up relay status
    this.nostr.onRelayCountChange(this.callbacks.onRelayStatus);

    // Publish ride request as a public replaceable event with NIP-40 TTL
    this.nostr.publishReplaceable(request.id, [
      ['g', geohash],
      ['t', 'ride-request'],
      ['expiration', String(Math.floor(Date.now() / 1000) + REQUEST_TTL_SECS)],
    ], JSON.stringify(request));

    // Subscribe to incoming accept DMs
    this.nostr.subscribeDMs((fromPubkey: string, payload: unknown) => {
      const dm = payload as AcceptDM;
      if (dm?.type === 'accept' && dm.requestId === this.myRequestId) {
        this.callbacks.onDriverAccepted(fromPubkey, dm.requestId);
      }
    });

    // Subscribe to driver availability events to show count
    this.nostr.subscribe('driver-avail', {
      kinds: [REPLACEABLE_KIND],
      '#g': [geohash],
      '#t': ['driver-avail'],
      since: Math.floor(Date.now() / 1000) - 300,
    }, (event: NostrEvent) => this.handleDriverAvailEvent(event));

    // Connect to relays in the background
    this.nostr.connectInBackground();

    logger.info(`Rider started in cell ${geohash}`, { component: 'GigService', operation: 'startAsRider' });
  }

  /**
   * Rider heartbeat — re-publishes the open request with a fresh
   * created_at and expiration so it stays alive on relays.
   */
  refreshRequest(request: RideRequest): void {
    this.nostr.publishReplaceable(request.id, [
      ['g', request.geohash],
      ['t', 'ride-request'],
      ['expiration', String(Math.floor(Date.now() / 1000) + REQUEST_TTL_SECS)],
    ], JSON.stringify(request));

    logger.info('Heartbeat: refreshed ride request', { component: 'GigService', operation: 'refreshRequest' });
  }

  /**
   * Rider confirms the winning driver.
   * Updates the ride request event with status 'taken' and the winner's pubkey.
   * Every driver in the cell sees this through their subscription.
   */
  confirmMatch(request: RideRequest, driverPubkey: string): void {
    const updated: RideRequest = {
      ...request,
      status: 'taken',
      matchedDriverPubkey: driverPubkey,
    };

    this.nostr.publishReplaceable(request.id, [
      ['g', request.geohash],
      ['t', 'ride-request'],
      ['expiration', String(Math.floor(Date.now() / 1000) + REQUEST_TTL_SECS)],
    ], JSON.stringify(updated));

    logger.info(`Match confirmed with driver ${driverPubkey.slice(0, 8)}`, { component: 'GigService', operation: 'confirmMatch' });
  }

  /** Rider cancels their request. Updates event status to 'cancelled'. */
  cancelRequest(request: RideRequest): void {
    const updated: RideRequest = {
      ...request,
      status: 'cancelled',
      matchedDriverPubkey: null,
    };

    this.nostr.publishReplaceable(request.id, [
      ['g', request.geohash],
      ['t', 'ride-request'],
      ['expiration', String(Math.floor(Date.now() / 1000) + REQUEST_TTL_SECS)],
    ], JSON.stringify(updated));

    logger.info('Ride request cancelled', { component: 'GigService', operation: 'cancelRequest' });
  }

  // ─── Driver ────────────────────────────────────────────────

  /**
   * Start as a driver. Publishes availability and subscribes to
   * ride requests in the cell + accept DMs.
   */
  startAsDriver(geohash: string, location: { latitude: number; longitude: number }): void {
    // Wire up relay status
    this.nostr.onRelayCountChange(this.callbacks.onRelayStatus);

    // Publish driver availability as a public replaceable event
    this.nostr.publishReplaceable('driver-avail', [
      ['g', geohash],
      ['t', 'driver-avail'],
    ], JSON.stringify({ location }));

    // Subscribe to ride requests in this cell
    this.nostr.subscribe('ride-requests', {
      kinds: [REPLACEABLE_KIND],
      '#g': [geohash],
      '#t': ['ride-request'],
      since: Math.floor(Date.now() / 1000) - 300,
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

  // ─── Event Handling ────────────────────────────────────────

  /**
   * Handle an incoming ride request event.
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
          this.clearExpirationTimer(request.id);
          this.callbacks.onRideRequestGone(request.id, null);
        }
        // Unknown expired request — ignore
        return;
      }

      if (this.knownRequests.has(request.id)) {
        if (request.status === 'taken' || request.status === 'cancelled') {
          // Status changed — gone
          this.knownRequests.delete(request.id);
          this.clearExpirationTimer(request.id);
          this.callbacks.onRideRequestGone(request.id, request.matchedDriverPubkey);
        } else if (request.status === 'open' && expiration) {
          // Heartbeat — reset expiration timer
          this.startExpirationTimer(request.id, expiration);
        }
      } else if (request.status === 'open') {
        // New open request
        this.knownRequests.add(request.id);
        if (expiration) {
          this.startExpirationTimer(request.id, expiration);
        }
        this.callbacks.onRideRequest(request);
      }
      // Ignore historical taken/cancelled events we never saw as open
    } catch {
      logger.warn('Malformed ride request event', { component: 'GigService', operation: 'handleRideRequestEvent' });
    }
  }

  /**
   * Handle a driver availability event.
   * Tracks driver pubkeys and fires onDriverCount when the count changes.
   */
  private handleDriverAvailEvent(event: NostrEvent): void {
    if (!event.content) {
      // Empty content = driver went offline — remove them
      if (this.knownDrivers.delete(event.pubkey)) {
        this.callbacks.onDriverCount?.(this.knownDrivers.size);
      }
      return;
    }

    if (!this.knownDrivers.has(event.pubkey)) {
      this.knownDrivers.add(event.pubkey);
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
   * Start (or reset) a local expiration timer for a request.
   * When it fires, the request is treated as gone.
   */
  private startExpirationTimer(requestId: string, expiration: number): void {
    this.clearExpirationTimer(requestId);
    const delayMs = Math.max(0, (expiration - Date.now() / 1000) * 1000);

    this.expirationTimers.set(requestId, setTimeout(() => {
      this.expirationTimers.delete(requestId);
      if (this.knownRequests.has(requestId)) {
        this.knownRequests.delete(requestId);
        this.callbacks.onRideRequestGone(requestId, null);
        logger.info(`Request ${requestId.slice(0, 8)} expired locally`, { component: 'GigService', operation: 'expirationTimer' });
      }
    }, delayMs));
  }

  /** Clear a pending expiration timer for a request. */
  private clearExpirationTimer(requestId: string): void {
    const timer = this.expirationTimers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.expirationTimers.delete(requestId);
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────

  /**
   * Stop the service. Clears local state and disconnects.
   * Events expire on relays via NIP-40 TTL — no deletion needed.
   */
  stop(): void {
    for (const timer of this.expirationTimers.values()) {
      clearTimeout(timer);
    }
    this.expirationTimers.clear();
    this.knownRequests.clear();
    this.knownDrivers.clear();
    this.myRequestId = null;
    this.nostr.disconnect();

    logger.info('GigService stopped', { component: 'GigService', operation: 'stop' });
  }
}
