/**
 * Listing Service
 *
 * Publish-only service for long-lived listings (Helpouts, etc.).
 * No matching protocol — listings are published with a 14-day TTL
 * and discovered via map layers.
 *
 * Uses the same Nostr relay infrastructure as GigService but with
 * a fundamentally different protocol:
 *   - Publish-only (no subscriptions needed for the publisher)
 *   - 14-day NIP-40 TTL (no heartbeat)
 *   - Single replaceable event per listing
 *   - Unpublish by replacing with empty content
 */

import { NostrService, REPLACEABLE_KIND, type NostrEvent } from './nostrService';
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
  private listingId: string | null = null;

  constructor(sk: Uint8Array, callbacks: ListingCallbacks) {
    this.nostr = new NostrService(sk);
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
    this.listingId = listing.id;

    this.nostr.onRelayCountChange(this.callbacks.onRelayStatus);

    const tags = buildTags('listing-helpouts', listing.geohash);

    // Add category tag for filtering
    tags.push(['c', listing.category]);

    this.nostr.publishReplaceable(
      listing.id,
      tags,
      JSON.stringify(listing),
    );

    this.nostr.connectInBackground();

    logger.info(`Helpout listing published (${listing.category})`, {
      component: 'ListingService',
      operation: 'publishListing',
    });
  }

  /**
   * Unpublish the listing by replacing the event with empty content.
   * Relays will serve the empty replacement; NIP-40 TTL will eventually
   * clean it up even if we don't explicitly delete.
   */
  unpublishListing(listingId: string, geohash?: string): void {
    const tags = buildTags('listing-helpouts', geohash);
    this.nostr.publishReplaceable(listingId, tags, '');

    logger.info('Helpout listing unpublished', {
      component: 'ListingService',
      operation: 'unpublishListing',
    });
  }

  /** Disconnect from relays and clean up. */
  stop(): void {
    this.nostr.disconnect();
    this.listingId = null;
    logger.info('ListingService stopped', { component: 'ListingService', operation: 'stop' });
  }
}
