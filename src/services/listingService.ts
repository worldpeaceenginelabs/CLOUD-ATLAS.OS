/**
 * Listing Service
 *
 * Publish-only service for long-lived listings (Helpouts, Social, etc.).
 * No matching protocol — listings are published with a 7-day TTL
 * and discovered via map layers.
 *
 * Parameterized by listing tag so one class serves all listing verticals.
 *
 * Uses the shared Nostr connection pool. Protocol:
 *   - Publish-only (no subscriptions needed for the publisher)
 *   - 7-day NIP-40 TTL (no heartbeat)
 *   - Single replaceable event per listing
 *   - Take-down via 1-second TTL replacement (handled in detail cards)
 */

import { type NostrService } from './nostrService';
import { logger } from '../utils/logger';
import type { Listing } from '../types';
import { onRelayStatus, publishVerifiedReplaceable, type RelayPublishOutcome } from './relayOrchestrator';

// ─── Constants ────────────────────────────────────────────────

/** Default 7 days in seconds (NIP-40 listing TTL). */
export const DEFAULT_LISTING_TTL_SECS = 7 * 24 * 60 * 60;

/** Build the standard NIP-33 tag set for a listing event. */
const buildTags = (listingTag: string, ttlSecs: number, geohash?: string): string[][] => {
  const exp = Math.floor(Date.now() / 1000) + ttlSecs;
  const tags: string[][] = [
    ['t', listingTag],
    ['expiration', String(exp)],
  ];
  if (geohash) {
    tags.push(['g', geohash]);
  }
  return tags;
};

// ─── Types ───────────────────────────────────────────────────

export interface ListingCallbacks {
  /** Relay connection count changed. */
  onRelayStatus: (connected: number, total: number) => void;
}

export interface ListingPublishResult {
  outcome: RelayPublishOutcome;
  verified: boolean;
}

// ─── Service ─────────────────────────────────────────────────

export class ListingService {
  private nostr: NostrService;
  private callbacks: ListingCallbacks;
  private listingTag: string;
  private ttlSecs: number;

  /**
   * @param nostr       Shared NostrService instance
   * @param listingTag  Nostr '#t' tag, e.g. 'listing-helpouts' or 'listing-social'
   * @param callbacks   Relay status callbacks
   * @param ttlSecs     NIP-40 expiration offset from publish time (default 7 days)
   */
  constructor(
    nostr: NostrService,
    listingTag: string,
    callbacks: ListingCallbacks,
    ttlSecs: number = DEFAULT_LISTING_TTL_SECS,
  ) {
    this.nostr = nostr;
    this.listingTag = listingTag;
    this.callbacks = callbacks;
    this.ttlSecs = ttlSecs;
  }

  /** Our Nostr public key. */
  get pubkey(): string {
    return this.nostr.pubkey;
  }

  /**
   * Publish a listing with 7-day TTL.
   * Uses a stable d-tag so re-publishing replaces the previous listing.
   */
  async publishListing(listing: Listing): Promise<ListingPublishResult> {
    onRelayStatus(this.nostr, this.callbacks.onRelayStatus);

    const tags = buildTags(this.listingTag, this.ttlSecs, listing.geohash);

    // Add category tag for filtering
    tags.push(['c', listing.category]);

    const result = await publishVerifiedReplaceable(this.nostr, {
      dTag: listing.id,
      extraTags: tags,
      content: JSON.stringify(listing),
      verifyTTags: [this.listingTag],
      minRelaysAfterSettle: 1,
      retries: 2,
      onMetrics: (meta) => {
        logger.info(
          `relay-metrics publish listing=${this.listingTag} status=${meta.status} outcome=${meta.outcome} verified=${meta.verified} connected=${meta.connectedAtStart} eose=${meta.eoseReceived} retries=${meta.retriesUsed} timedOut=${meta.timedOut}`,
          { component: 'ListingService', operation: 'publishListing' },
        );
      },
    });

    logger.info(`Listing published (${this.listingTag}: ${listing.category})`, {
      component: 'ListingService',
      operation: 'publishListing',
    });
    return { outcome: result.outcome, verified: result.verified };
  }

  /** Clean up. Shared NostrService connections remain open. */
  stop(): void {
    logger.info('ListingService stopped', { component: 'ListingService', operation: 'stop' });
  }
}
