/**
 * Geohash listing feed: fetches listings for a geohash-4 cell (map layers).
 *
 * Fetches listings (Helpouts, Social, etc.) from Nostr relays for a
 * geohash-4 cell, caches them in IndexedDB, and returns them for map rendering.
 *
 * Parameterized by listing tag (e.g. 'listing-helpouts', 'listing-social')
 * so one class serves all geohash verticals.
 *
 * Uses the shared Nostr connection pool. Resolves on EOSE (end of
 * stored events) for fast responses, with a fallback timeout.
 *
 * Cache strategy:
 *   - First fetch: relay → IDB (with timestamp)
 *   - Subsequent fetches within 30 min: return from IDB
 *   - After 30 min or forceRefresh: relay → IDB
 *   - On relay failure: fall back to IDB cache regardless of age
 */

import { type NostrService, type NostrEvent } from './nostrService';
import { idb } from '../idb';
import { logger } from '../utils/logger';
import { fetchDeletions, applyDeletions } from './listingDeletionService';
import { LISTING_MAX_AGE_MS } from './listingConstants';
import {
  parseListingEvent,
  trimByMaxAge,
  buildListingFilter,
  runListingSubscription,
  defaultSinceSec,
} from './listingFeedHelpers';
import type { Listing, ListingVertical } from '../types';

export class GeohashListingFeed {
  private nostr: NostrService;
  private listingTag: string;
  private cacheType: string;

  /**
   * @param nostr     Shared NostrService instance
   * @param listingTag  Nostr '#t' tag value, e.g. 'listing-helpouts' or 'listing-social'
   */
  constructor(nostr: NostrService, listingTag: string) {
    this.nostr = nostr;
    this.listingTag = listingTag;
    // Derive cache type from tag: 'listing-helpouts' → 'helpouts'
    this.cacheType = listingTag.replace('listing-', '');
  }

  /**
   * Fetch listings for a geohash-4 cell.
   * Uses IDB cache (<= 7 days old by listing timestamp) for
   * immediate rendering. Optionally refreshes from relay.
   * Pass forceRefresh=true to bypass cache and force a relay fetch.
   * When verticalId is provided, each listing gets vertical set (single-tag fetch).
   */
  async fetchListings(geohash4: string, forceRefresh = false, verticalId?: ListingVertical): Promise<Listing[]> {
    let cached: { listings: Listing[]; fetchedAt: number } | null = null;

    // Check cache first (unless forced). We treat any listing with
    // timestamp <= 7 days old as valid for rendering.
    if (!forceRefresh) {
      try {
        cached = await idb.loadListingCache(`${this.cacheType}:${geohash4}`);
        if (cached) {
          const recent = trimByMaxAge(cached.listings, LISTING_MAX_AGE_MS);
          if (recent.length > 0) return recent;
        }
      } catch {
        // IDB read failed, proceed to relay
      }
    }

    // Fetch from relay and DELETEs in parallel; write listing result then apply DELETEs
    try {
      const [listings, deletedSet] = await Promise.all([
        this.fetchFromRelay(geohash4, verticalId),
        fetchDeletions(this.nostr),
      ]);
      const trimmed = trimByMaxAge(listings, LISTING_MAX_AGE_MS);
      await idb.saveListingCache(`${this.cacheType}:${geohash4}`, { listings: trimmed, fetchedAt: Date.now() });
      await applyDeletions(deletedSet);
      return trimmed;
    } catch (e) {
      logger.warn(`Relay fetch failed for cell ${geohash4}, trying cache`, {
        component: 'GeohashListingFeed',
        operation: 'fetchListings',
      });
      // Fall back to cache regardless of age
      try {
        const fallback = await idb.loadListingCache(`${this.cacheType}:${geohash4}`);
        if (!fallback) return [];
        return trimByMaxAge(fallback.listings, LISTING_MAX_AGE_MS);
      } catch {
        return [];
      }
    }
  }

  /**
   * Subscribe to listings in the cell, collect events until
   * EOSE (end of stored events) fires, then unsubscribe and resolve.
   * Falls back to a timeout if EOSE never arrives.
   */
  private async fetchFromRelay(geohash4: string, verticalId?: ListingVertical): Promise<Listing[]> {
    const listings: Listing[] = [];
    const seen = new Set<string>();
    const filter = buildListingFilter({
      tags: this.listingTag,
      geohash: geohash4,
      since: defaultSinceSec(),
    });
    await runListingSubscription(this.nostr, filter, (event: NostrEvent) => {
      if (seen.has(event.id)) return;
      seen.add(event.id);
      const listing = parseListingEvent(event, verticalId ? { vertical: verticalId } : undefined);
      if (listing) listings.push(listing);
    }, { subIdPrefix: `geohash-${this.cacheType}` });
    return listings;
  }
}
