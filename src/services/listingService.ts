/**
 * Listing Service
 *
 * Publish-only service for long-lived listings (Helpouts, etc.).
 * No matching protocol — listings are published with a 14-day TTL
 * and discovered via map layers.
 *
 * Uses the shared Nostr connection pool. Protocol:
 *   - Publish-only (no subscriptions needed for the publisher)
 *   - 14-day NIP-40 TTL (no heartbeat)
 *   - Single replaceable event per listing
 *   - Take-down via 1-second TTL replacement (handled in HelpoutDetail)
 */

import type { NostrService } from './nostrService';
import { logger } from '../utils/logger';
import type { HelpoutListing } from '../types';

// ─── Constants ────────────────────────────────────────────────

/** 14 days in seconds. */
const LISTING_TTL_SECS = 14 * 24 * 60 * 60;

/** Current unix timestamp + LISTING_TTL_SECS. */
const freshExpiration = (): number => Math.floor(Date.now() / 1000) + LISTING_TTL_SECS;

/** Build the standard NIP-33 tag set for a listing event. */
const buildTags = (type: string, geohash?: string): string[][] => {
  const tags: string[][] = [
    ['t', type],
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

  constructor(nostr: NostrService, callbacks: ListingCallbacks) {
    this.nostr = nostr;
    this.callbacks = callbacks;
  }

  /** Our Nostr public key. */
  get pubkey(): string {
    return this.nostr.pubkey;
  }

  /**
   * Publish a helpout listing with 14-day TTL.
   * Uses a stable d-tag so re-publishing replaces the previous listing.
   */
  publishListing(listing: HelpoutListing): void {
    this.nostr.onRelayCountChange(this.callbacks.onRelayStatus);

    const tags = buildTags('listing-helpouts', listing.geohash);

    // Add category tag for filtering
    tags.push(['c', listing.category]);

    this.nostr.publishReplaceable(
      listing.id,
      tags,
      JSON.stringify(listing),
    );

    logger.info(`Helpout listing published (${listing.category})`, {
      component: 'ListingService',
      operation: 'publishListing',
    });
  }

  /** Clean up. Shared NostrService connections remain open. */
  stop(): void {
    logger.info('ListingService stopped', { component: 'ListingService', operation: 'stop' });
  }
}
