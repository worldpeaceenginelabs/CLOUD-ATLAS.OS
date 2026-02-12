/**
 * Gig P2P Orchestrator
 *
 * Ties together Nostr discovery, WebRTC signaling, and the 3-step
 * matching protocol for the Gig Economy feature.
 *
 * Lifecycle:
 *   1. start(role, geohash, payload)  → connect relays, publish presence, subscribe
 *   2. Peers discovered via Nostr     → WebRTC connections established
 *   3. Matching via DataChannels      → accept / confirm / taken
 *   4. stop()                         → cleanup everything
 */

import { NostrService, type PresencePayload, type SignalPayload } from './nostrService';
import { WebRTCService } from './webrtcService';
import { logger } from '../utils/logger';
import type { GigPeer, GigP2PMessage, RideRequest, GigRole } from '../types';

// ─── Types ───────────────────────────────────────────────────

export interface GigP2PCallbacks {
  /** A new peer was discovered and WebRTC connection attempt started. */
  onPeerDiscovered: (peer: GigPeer) => void;
  /** A DataChannel to a peer is now open. */
  onPeerConnected: (pubkey: string) => void;
  /** A peer's connection was lost or closed. */
  onPeerDisconnected: (pubkey: string) => void;
  /** A P2P message was received over a DataChannel. */
  onMessage: (fromPubkey: string, message: GigP2PMessage) => void;
}

// ─── Orchestrator ────────────────────────────────────────────

export class GigP2P {
  private nostr: NostrService;
  private webrtc: WebRTCService;
  private callbacks: GigP2PCallbacks;
  private myRole: GigRole | null = null;
  private myGeohash: string = '';
  private discoveredPeers: Map<string, GigPeer> = new Map();
  private running = false;

  constructor(callbacks: GigP2PCallbacks) {
    this.nostr = new NostrService();
    this.webrtc = new WebRTCService(this.nostr);
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
   * Connects to relays, publishes presence, subscribes to discovery & signaling.
   */
  async start(role: GigRole, geohash: string, payload: PresencePayload): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.myRole = role;
    this.myGeohash = geohash;

    // 1. Connect to relays
    await this.nostr.connect();

    // 2. Publish our presence
    await this.nostr.publishPresence(payload);

    // 3. Subscribe to presence of opposite role
    const oppositeRole: GigRole = role === 'rider' ? 'driver' : 'rider';
    this.nostr.subscribePresence(geohash, oppositeRole, (pubkey, peerPayload, eventId) => {
      this.handlePeerDiscovered(pubkey, peerPayload);
    });

    // 4. Subscribe to signaling messages addressed to us
    this.nostr.subscribeSignaling((fromPubkey, signal) => {
      this.webrtc.handleSignal(fromPubkey, signal);
    });

    // 5. Wire up WebRTC callbacks
    this.webrtc.setOnMessage((fromPubkey, data) => {
      try {
        const message: GigP2PMessage = JSON.parse(data);
        this.callbacks.onMessage(fromPubkey, message);
      } catch { /* malformed */ }
    });

    this.webrtc.setOnStateChange((pubkey, state) => {
      if (state === 'open') {
        this.callbacks.onPeerConnected(pubkey);
      } else if (state === 'closed' || state === 'failed') {
        this.callbacks.onPeerDisconnected(pubkey);
        this.discoveredPeers.delete(pubkey);
      }
    });

    logger.info(`GigP2P started as ${role} in cell ${geohash}`, { component: 'GigP2P', operation: 'start' });
  }

  /**
   * Stop the session completely. Deletes presence, closes all connections.
   * Order: Delete presence → wait for relay confirmation → close subs → close WebRTC → disconnect sockets
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
    // 4. Close all WebRTC connections
    this.webrtc.closeAll();
    // 5. Disconnect sockets
    this.nostr.disconnect();

    this.discoveredPeers.clear();
    this.myRole = null;
    this.myGeohash = '';

    logger.info('GigP2P stopped', { component: 'GigP2P', operation: 'stop' });
  }

  // ─── Messaging ──────────────────────────────────────────

  /** Send a typed message to a specific peer. */
  sendTo(toPubkey: string, message: GigP2PMessage): boolean {
    return this.webrtc.send(toPubkey, JSON.stringify(message));
  }

  /** Broadcast a typed message to all connected peers. */
  broadcastMessage(message: GigP2PMessage): void {
    this.webrtc.broadcast(JSON.stringify(message));
  }

  // ─── Match Finalization ─────────────────────────────────

  /**
   * Called when a match is confirmed. Keeps only the matched peer's
   * connection, closes everything else, and cleans up Nostr.
   */
  async finalizeMatch(matchedPubkey: string): Promise<void> {
    // 1. Delete presence from relays (waits for OK or 3s timeout)
    await this.nostr.deletePresence();
    // 2. Grace period for delete propagation
    await this.delay(500);
    // 3. Close Nostr subscriptions (no more discovery needed)
    this.nostr.closeSubscriptions();
    // 4. Close all WebRTC connections except the matched one
    this.webrtc.closeAllExcept(matchedPubkey);
    // 5. Clean up peer map, keep only matched
    const matchedPeer = this.discoveredPeers.get(matchedPubkey);
    this.discoveredPeers.clear();
    if (matchedPeer) {
      this.discoveredPeers.set(matchedPubkey, matchedPeer);
    }

    logger.info(`Match finalized with ${matchedPubkey.slice(0, 8)}`, { component: 'GigP2P', operation: 'finalizeMatch' });
  }

  /**
   * Full cleanup after "Done" or final cancel. Closes the last connection too.
   * Ensures presence is removed from relays before disconnecting.
   * Order: Delete presence → wait → close WebRTC → disconnect sockets
   */
  async finish(): Promise<void> {
    // 1. Reconnect briefly if sockets were closed after finalizeMatch
    //    (finalizeMatch only closes subscriptions, not sockets – so usually still connected)
    // 2. Delete presence and wait for relay confirmation (up to 3s)
    await this.nostr.deletePresence();
    // 3. Grace period for event propagation
    await this.delay(500);
    // 4. Close all remaining WebRTC connections (including the matched peer)
    this.webrtc.closeAll();
    // 5. Disconnect Nostr sockets
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

    // Initiate WebRTC: lower pubkey creates the offer
    if (this.nostr.pubkey < pubkey) {
      this.webrtc.createOffer(pubkey);
    }
    // else: we wait for their offer (they have the lower pubkey)

    logger.info(`Peer discovered: ${pubkey.slice(0, 8)} (${payload.role})`, { component: 'GigP2P', operation: 'handlePeerDiscovered' });
  }

  // ─── Getters ────────────────────────────────────────────

  /** Get pubkeys of all peers with open DataChannels. */
  getConnectedPeerPubkeys(): string[] {
    return this.webrtc.getOpenPeers();
  }

  /** Check if a specific peer has an open DataChannel. */
  isPeerConnected(pubkey: string): boolean {
    const conn = this.webrtc.getConnection(pubkey);
    return conn?.state === 'open';
  }
}
