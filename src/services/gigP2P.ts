/**
 * Gig P2P Orchestrator
 *
 * Ties together Nostr discovery and encrypted match messaging
 * for the Gig Economy feature.
 *
 * All communication (discovery + matching protocol) flows over Nostr relays.
 * No WebRTC — no NAT traversal issues, no TURN dependency, 100% connectivity.
 *
 * Lifecycle:
 *   1. start(role, geohash, payload)  → connect relays, publish presence, subscribe
 *   2. Peers discovered via Nostr     → added to peer map, callback fired
 *   3. Matching via encrypted DMs     → ride-request / accept / confirm / taken
 *   4. stop()                         → cleanup everything
 */

import { NostrService, type PresencePayload } from './nostrService';
import { logger } from '../utils/logger';
import type { GigPeer, GigP2PMessage, GigRole } from '../types';

// ─── Types ───────────────────────────────────────────────────

export interface GigP2PCallbacks {
  /** A new peer was discovered via Nostr presence. */
  onPeerDiscovered: (peer: GigPeer) => void;
  /** A P2P message was received over a Nostr encrypted DM. */
  onMessage: (fromPubkey: string, message: GigP2PMessage) => void;
  /** Relay connection count changed. */
  onRelayCountChange: (connected: number, total: number) => void;
}

// ─── Orchestrator ────────────────────────────────────────────

export class GigP2P {
  private nostr: NostrService;
  private callbacks: GigP2PCallbacks;
  private myRole: GigRole | null = null;
  private myGeohash: string = '';
  private discoveredPeers: Map<string, GigPeer> = new Map();
  private running = false;

  constructor(callbacks: GigP2PCallbacks) {
    this.nostr = new NostrService();
    this.callbacks = callbacks;
  }

  /** Our Nostr public key. */
  get pubkey(): string {
    return this.nostr.pubkey;
  }

  /** Whether the service is currently active. */
  get isRunning(): boolean {
    return this.running;
  }

  /** All currently discovered peers. */
  get peers(): Map<string, GigPeer> {
    return this.discoveredPeers;
  }

  // ─── Start / Stop ───────────────────────────────────────

  /**
   * Start the Gig P2P session.
   * Returns immediately — relay connections happen in the background.
   * Presence is published automatically when the first relay connects.
   */
  start(role: GigRole, geohash: string, payload: PresencePayload): void {
    if (this.running) return;
    this.running = true;
    this.myRole = role;
    this.myGeohash = geohash;

    // 1. Wire up relay count change callback
    this.nostr.setOnRelayCountChange((connected, total) => {
      this.callbacks.onRelayCountChange(connected, total);
    });

    // 2. Set up subscriptions (stored internally, sent to relays as they connect)
    const oppositeRole: GigRole = role === 'rider' ? 'driver' : 'rider';
    this.nostr.subscribePresence(geohash, oppositeRole, (pubkey, peerPayload, _eventId) => {
      this.handlePeerDiscovered(pubkey, peerPayload);
    });
    this.nostr.subscribeMatchMessages((fromPubkey, message) => {
      this.callbacks.onMessage(fromPubkey, message);
    });

    // 3. Queue presence for auto-publish when first relay connects
    this.nostr.queuePresence(payload);

    // 4. Start connecting to relays in background (non-blocking)
    this.nostr.connectInBackground();

    logger.info(`GigP2P started as ${role} in cell ${geohash}`, { component: 'GigP2P', operation: 'start' });
  }

  /**
   * Stop the session completely. Deletes presence, closes all subscriptions.
   * Order: Delete presence → wait for relay confirmation → close subs → disconnect sockets
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    // 1. Delete presence and wait for relay confirmation (up to 3s)
    await this.nostr.deletePresence();
    // 2. Short grace period so delete events propagate before sockets close
    await this.delay(500);
    // 3. Close Nostr subscriptions
    this.nostr.closeSubscriptions();
    // 4. Disconnect sockets
    this.nostr.disconnect();

    this.discoveredPeers.clear();
    this.myRole = null;
    this.myGeohash = '';

    logger.info('GigP2P stopped', { component: 'GigP2P', operation: 'stop' });
  }

  // ─── Messaging ──────────────────────────────────────────

  /** Send a typed message to a specific peer via Nostr encrypted DM. */
  sendTo(toPubkey: string, message: GigP2PMessage): void {
    this.nostr.sendMatchMessage(toPubkey, message);
  }

  /** Send a typed message to all discovered peers. */
  broadcastMessage(message: GigP2PMessage): void {
    for (const [pubkey] of this.discoveredPeers) {
      this.nostr.sendMatchMessage(pubkey, message);
    }
  }

  // ─── Match Finalization ─────────────────────────────────

  /**
   * Called when a match is confirmed. Keeps only the matched peer,
   * cleans up presence so no new peers discover us.
   */
  async finalizeMatch(matchedPubkey: string): Promise<void> {
    // 1. Delete presence from relays (waits for OK or 3s timeout)
    await this.nostr.deletePresence();
    // 2. Grace period for delete propagation
    await this.delay(500);
    // 3. Clean up peer map, keep only matched
    const matchedPeer = this.discoveredPeers.get(matchedPubkey);
    this.discoveredPeers.clear();
    if (matchedPeer) {
      this.discoveredPeers.set(matchedPubkey, matchedPeer);
    }

    logger.info(`Match finalized with ${matchedPubkey.slice(0, 8)}`, { component: 'GigP2P', operation: 'finalizeMatch' });
  }

  /**
   * Full cleanup after "Done" or final cancel.
   * Ensures presence is removed from relays before disconnecting.
   * Order: Delete presence → wait → close subs → disconnect sockets
   */
  async finish(): Promise<void> {
    // 1. Delete presence and wait for relay confirmation (up to 3s)
    await this.nostr.deletePresence();
    // 2. Grace period for event propagation
    await this.delay(500);
    // 3. Close Nostr subscriptions
    this.nostr.closeSubscriptions();
    // 4. Disconnect Nostr sockets
    this.nostr.disconnect();

    this.discoveredPeers.clear();
    this.running = false;
    this.myRole = null;
    this.myGeohash = '';

    logger.info('GigP2P finished', { component: 'GigP2P', operation: 'finish' });
  }

  // ─── Helpers ────────────────────────────────────────────

  /** Simple async delay. */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Discovery Handler ─────────────────────────────────

  private handlePeerDiscovered(pubkey: string, payload: PresencePayload): void {
    // Skip if already known
    if (this.discoveredPeers.has(pubkey)) return;

    const peer: GigPeer = {
      pubkey,
      role: payload.role,
      geohash: payload.geohash,
      rideType: payload.rideType,
      destination: payload.destination,
      startLocation: payload.startLocation,
      timestamp: new Date().toISOString(),
    };

    this.discoveredPeers.set(pubkey, peer);
    this.callbacks.onPeerDiscovered(peer);

    logger.info(`Peer discovered: ${pubkey.slice(0, 8)} (${payload.role})`, { component: 'GigP2P', operation: 'handlePeerDiscovered' });
  }
}
