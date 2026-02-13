/**
 * Gig Economy Service
 *
 * Domain layer for ride matching over Nostr.
 * The rider's request event is the single source of truth.
 *
 * Protocol:
 *   1. Rider publishes ride request event (status: 'open')
 *   2. Drivers subscribe to ride requests in their geohash cell
 *   3. Driver sends encrypted 'accept' DM to rider
 *   4. Rider picks winner, updates event (status: 'taken', matchedDriverPubkey)
 *   5. All drivers see the update — winner matches, losers move on
 *
 * Messages:
 *   Public events:  ride request (open → taken/cancelled), driver availability
 *   Encrypted DMs:  accept (driver → rider) — the only DM in the protocol
 */

import { NostrService, REPLACEABLE_KIND, type NostrEvent } from './nostrService';
import { logger } from '../utils/logger';
import type { RideRequest } from '../types';

// ─── Types ───────────────────────────────────────────────────

export interface GigCallbacks {
  /** Relay connection count changed. */
  onRelayStatus: (connected: number, total: number) => void;
  /** Driver: a new open ride request appeared in the cell. */
  onRideRequest: (request: RideRequest) => void;
  /** Driver: a ride request was taken or cancelled. */
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
  private eventIds = new Map<string, string>();          // dTag → eventId (for deletion)

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

    // Publish ride request as a public replaceable event
    const eventId = this.nostr.publishReplaceable(request.id, [
      ['g', geohash],
      ['t', 'ride-request'],
    ], JSON.stringify(request));
    this.eventIds.set(request.id, eventId);

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

    const eventId = this.nostr.publishReplaceable(request.id, [
      ['g', request.geohash],
      ['t', 'ride-request'],
    ], JSON.stringify(updated));
    this.eventIds.set(request.id, eventId);

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
    const eventId = this.nostr.publishReplaceable('driver-avail', [
      ['g', geohash],
      ['t', 'driver-avail'],
    ], JSON.stringify({ location }));
    this.eventIds.set('driver-avail', eventId);

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
   * Differentiates between new requests and status updates.
   */
  private handleRideRequestEvent(event: NostrEvent): void {
    // Ignore empty events (deleted/replaced with no content)
    if (!event.content) return;

    try {
      const request: RideRequest = JSON.parse(event.content);
      // Ensure pubkey matches the event author (tamper-proof)
      request.pubkey = event.pubkey;

      if (this.knownRequests.has(request.id)) {
        // Known request — check for status change
        if (request.status === 'taken' || request.status === 'cancelled') {
          this.knownRequests.delete(request.id);
          this.callbacks.onRideRequestGone(request.id, request.matchedDriverPubkey);
        }
      } else if (request.status === 'open') {
        // New open request
        this.knownRequests.add(request.id);
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

  // ─── Cleanup ───────────────────────────────────────────────

  /** Stop the service. Deletes published events and disconnects. */
  async stop(): Promise<void> {
    for (const [dTag, eventId] of this.eventIds) {
      await this.nostr.deleteReplaceable(dTag, eventId);
    }
    this.eventIds.clear();
    this.knownRequests.clear();
    this.knownDrivers.clear();
    this.myRequestId = null;
    this.nostr.disconnect();

    logger.info('GigService stopped', { component: 'GigService', operation: 'stop' });
  }
}
