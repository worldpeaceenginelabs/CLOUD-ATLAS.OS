/**
 * WebRTC Service
 *
 * Manages RTCPeerConnections and DataChannels for direct P2P
 * communication after Nostr signaling completes.
 *
 * Uses public STUN/TURN servers for NAT traversal.
 */

import { logger } from '../utils/logger';
import type { NostrService, SignalPayload } from './nostrService';

// ─── Public STUN / TURN Servers ──────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
  // Open TURN relay (metered.ca free-tier compatible)
  {
    urls: 'turn:a.relay.metered.ca:80',
    username: 'open',
    credential: 'open',
  },
  {
    urls: 'turn:a.relay.metered.ca:443',
    username: 'open',
    credential: 'open',
  },
  {
    urls: 'turn:a.relay.metered.ca:443?transport=tcp',
    username: 'open',
    credential: 'open',
  },
];

/** How long to wait for an answer before timing out the peer. */
const SIGNALING_TIMEOUT_MS = 15_000;

// ─── Types ───────────────────────────────────────────────────

export interface PeerConnection {
  pubkey: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  state: 'connecting' | 'open' | 'closed' | 'failed';
  timeoutId?: ReturnType<typeof setTimeout>;
}

export type OnDataChannelMessage = (fromPubkey: string, message: string) => void;
export type OnConnectionStateChange = (pubkey: string, state: PeerConnection['state']) => void;

// ─── Service Class ───────────────────────────────────────────

export class WebRTCService {
  private connections: Map<string, PeerConnection> = new Map();
  private nostr: NostrService;
  private onMessage: OnDataChannelMessage | null = null;
  private onStateChange: OnConnectionStateChange | null = null;

  constructor(nostr: NostrService) {
    this.nostr = nostr;
  }

  /** Register callback for incoming DataChannel messages. */
  setOnMessage(callback: OnDataChannelMessage): void {
    this.onMessage = callback;
  }

  /** Register callback for connection state changes. */
  setOnStateChange(callback: OnConnectionStateChange): void {
    this.onStateChange = callback;
  }

  // ─── Initiate Connection (Offerer) ──────────────────────

  /**
   * Create a WebRTC connection as the initiator (offerer).
   * Called by the peer with the lexicographically lower pubkey.
   */
  async createOffer(remotePubkey: string): Promise<void> {
    if (this.connections.has(remotePubkey)) return;

    const pc = this.createPeerConnection(remotePubkey);
    const dc = pc.createDataChannel('gig', { ordered: true });
    this.setupDataChannel(dc, remotePubkey);

    const conn: PeerConnection = { pubkey: remotePubkey, pc, dc, state: 'connecting' };
    this.connections.set(remotePubkey, conn);

    // Gather ICE candidates and send them
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.nostr.sendSignal(remotePubkey, {
          type: 'ice-candidate',
          data: event.candidate.toJSON(),
        });
      }
    };

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.nostr.sendSignal(remotePubkey, {
      type: 'offer',
      data: offer,
    });

    // Timeout: if no answer arrives
    conn.timeoutId = setTimeout(() => {
      if (conn.state === 'connecting') {
        logger.warn(`Signaling timeout for peer ${remotePubkey.slice(0, 8)}`, { component: 'WebRTC', operation: 'createOffer' });
        this.closeConnection(remotePubkey);
      }
    }, SIGNALING_TIMEOUT_MS);

    logger.info(`Offer sent to ${remotePubkey.slice(0, 8)}`, { component: 'WebRTC', operation: 'createOffer' });
  }

  // ─── Handle Incoming Signal ─────────────────────────────

  /** Process an incoming signaling message from Nostr. */
  async handleSignal(fromPubkey: string, signal: SignalPayload): Promise<void> {
    if (signal.type === 'offer') {
      await this.handleOffer(fromPubkey, signal.data);
    } else if (signal.type === 'answer') {
      await this.handleAnswer(fromPubkey, signal.data);
    } else if (signal.type === 'ice-candidate') {
      await this.handleIceCandidate(fromPubkey, signal.data);
    }
  }

  private async handleOffer(fromPubkey: string, offer: RTCSessionDescriptionInit): Promise<void> {
    // If we already have a connection, ignore (we might have initiated one ourselves)
    if (this.connections.has(fromPubkey)) {
      const existing = this.connections.get(fromPubkey)!;
      if (existing.state === 'open') return;
      // Close the existing attempt and accept the incoming one
      existing.pc.close();
    }

    const pc = this.createPeerConnection(fromPubkey);
    const conn: PeerConnection = { pubkey: fromPubkey, pc, dc: null, state: 'connecting' };
    this.connections.set(fromPubkey, conn);

    // Listen for the DataChannel created by the offerer
    pc.ondatachannel = (event) => {
      conn.dc = event.channel;
      this.setupDataChannel(event.channel, fromPubkey);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.nostr.sendSignal(fromPubkey, {
          type: 'ice-candidate',
          data: event.candidate.toJSON(),
        });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await this.nostr.sendSignal(fromPubkey, {
      type: 'answer',
      data: answer,
    });

    logger.info(`Answer sent to ${fromPubkey.slice(0, 8)}`, { component: 'WebRTC', operation: 'handleOffer' });
  }

  private async handleAnswer(fromPubkey: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const conn = this.connections.get(fromPubkey);
    if (!conn) return;

    // Guard: only accept answer if we're waiting for one (have-local-offer state)
    if (conn.pc.signalingState !== 'have-local-offer') {
      logger.warn(`Ignoring answer from ${fromPubkey.slice(0, 8)} — signalingState is ${conn.pc.signalingState}`, { component: 'WebRTC', operation: 'handleAnswer' });
      return;
    }

    // Clear timeout
    if (conn.timeoutId) {
      clearTimeout(conn.timeoutId);
      conn.timeoutId = undefined;
    }

    await conn.pc.setRemoteDescription(new RTCSessionDescription(answer));
    logger.info(`Answer received from ${fromPubkey.slice(0, 8)}`, { component: 'WebRTC', operation: 'handleAnswer' });
  }

  private async handleIceCandidate(fromPubkey: string, candidate: RTCIceCandidateInit): Promise<void> {
    const conn = this.connections.get(fromPubkey);
    if (!conn) return;

    try {
      await conn.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      // Non-fatal: candidate may arrive before remote description
    }
  }

  // ─── DataChannel ────────────────────────────────────────

  private setupDataChannel(dc: RTCDataChannel, remotePubkey: string): void {
    dc.onopen = () => {
      const conn = this.connections.get(remotePubkey);
      if (conn) {
        conn.state = 'open';
        conn.dc = dc;
        this.onStateChange?.(remotePubkey, 'open');
      }
      logger.info(`DataChannel open with ${remotePubkey.slice(0, 8)}`, { component: 'WebRTC', operation: 'dataChannel' });
    };

    dc.onclose = () => {
      const conn = this.connections.get(remotePubkey);
      if (conn) {
        conn.state = 'closed';
        this.onStateChange?.(remotePubkey, 'closed');
      }
    };

    dc.onerror = () => {
      const conn = this.connections.get(remotePubkey);
      if (conn) {
        conn.state = 'failed';
        this.onStateChange?.(remotePubkey, 'failed');
      }
    };

    dc.onmessage = (event) => {
      this.onMessage?.(remotePubkey, event.data);
    };
  }

  // ─── Send / Query ───────────────────────────────────────

  /** Send a string message over the DataChannel to a specific peer. */
  send(toPubkey: string, message: string): boolean {
    const conn = this.connections.get(toPubkey);
    if (!conn || !conn.dc || conn.dc.readyState !== 'open') return false;
    conn.dc.send(message);
    return true;
  }

  /** Send a string message to ALL open peers. */
  broadcast(message: string): void {
    for (const [pubkey, conn] of this.connections) {
      if (conn.dc && conn.dc.readyState === 'open') {
        conn.dc.send(message);
      }
    }
  }

  /** Get the connection info for a peer. */
  getConnection(pubkey: string): PeerConnection | undefined {
    return this.connections.get(pubkey);
  }

  /** Get all peers with open DataChannels. */
  getOpenPeers(): string[] {
    const result: string[] = [];
    for (const [pubkey, conn] of this.connections) {
      if (conn.state === 'open') result.push(pubkey);
    }
    return result;
  }

  // ─── Cleanup ────────────────────────────────────────────

  /** Close connection to a specific peer. */
  closeConnection(pubkey: string): void {
    const conn = this.connections.get(pubkey);
    if (!conn) return;

    if (conn.timeoutId) clearTimeout(conn.timeoutId);
    if (conn.dc) conn.dc.close();
    conn.pc.close();
    conn.state = 'closed';
    this.connections.delete(pubkey);
    this.onStateChange?.(pubkey, 'closed');
    logger.info(`Connection closed with ${pubkey.slice(0, 8)}`, { component: 'WebRTC', operation: 'closeConnection' });
  }

  /** Close all connections except one (the matched peer). */
  closeAllExcept(keepPubkey: string): void {
    for (const [pubkey] of this.connections) {
      if (pubkey !== keepPubkey) {
        this.closeConnection(pubkey);
      }
    }
  }

  /** Close all connections. */
  closeAll(): void {
    for (const [pubkey] of this.connections) {
      this.closeConnection(pubkey);
    }
  }

  // ─── Internal ───────────────────────────────────────────

  private createPeerConnection(remotePubkey: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onconnectionstatechange = () => {
      const conn = this.connections.get(remotePubkey);
      if (!conn) return;

      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        conn.state = 'failed';
        this.onStateChange?.(remotePubkey, 'failed');
      }
    };

    return pc;
  }
}
