/**
 * Listing Service
 *
 * Publish-only service for long-lived listings (Helpouts, Social, etc.).
 * No matching protocol — listings are published with a 14-day TTL
 * and discovered via map layers.
 *
 * Parameterized by listing tag so one class serves all listing verticals.
 *
 * Uses the shared Nostr connection pool. Protocol:
 *   - Publish-only (no subscriptions needed for the publisher)
 *   - 14-day NIP-40 TTL (no heartbeat)
 *   - Single replaceable event per listing
 *   - Take-down via 1-second TTL replacement (handled in detail cards)
 */

import { type NostrService, RELAY_LABEL } from './nostrService';
import { logger } from '../utils/logger';
import type { Listing } from '../types';

// ─── Constants ────────────────────────────────────────────────

/** 14 days in seconds. */
const LISTING_TTL_SECS = 14 * 24 * 60 * 60;

/** Current unix timestamp + LISTING_TTL_SECS. */
const freshExpiration = (): number => Math.floor(Date.now() / 1000) + LISTING_TTL_SECS;

/** Build the standard NIP-33 tag set for a listing event. */
const buildTags = (listingTag: string, geohash?: string): string[][] => {
  const tags: string[][] = [
    ['t', listingTag],
    ['L', RELAY_LABEL],
    ['expiration', String(freshExpiration())],
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

// ─── Service ─────────────────────────────────────────────────

export class ListingService {
  private nostr: NostrService;
  private callbacks: ListingCallbacks;
  private listingTag: string;

  /**
   * @param nostr       Shared NostrService instance
   * @param listingTag  Nostr '#t' tag, e.g. 'listing-helpouts' or 'listing-social'
   * @param callbacks   Relay status callbacks
   */
  constructor(nostr: NostrService, listingTag: string, callbacks: ListingCallbacks) {
    this.nostr = nostr;
    this.listingTag = listingTag;
    this.callbacks = callbacks;
  }

  /** Our Nostr public key. */
  get pubkey(): string {
    return this.nostr.pubkey;
  }

  /**
   * Publish a listing with 14-day TTL.
   * Uses a stable d-tag so re-publishing replaces the previous listing.
   */
  publishListing(listing: Listing): void {
    this.nostr.onRelayCountChange(this.callbacks.onRelayStatus);

    const tags = buildTags(this.listingTag, listing.geohash);

    // Add category tag for filtering
    tags.push(['c', listing.category]);

    this.nostr.publishReplaceable(
      listing.id,
      tags,
      JSON.stringify(listing),
    );

    logger.info(`Listing published (${this.listingTag}: ${listing.category})`, {
      component: 'ListingService',
      operation: 'publishListing',
    });
  }

  /** Clean up. Shared NostrService connections remain open. */
  stop(): void {
    logger.info('ListingService stopped', { component: 'ListingService', operation: 'stop' });
  }
}
