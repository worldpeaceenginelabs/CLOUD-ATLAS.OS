/**
 * Listing Layer Service
 *
 * Fetches listings (Helpouts, Social, etc.) from Nostr relays for a
 * geohash-4 cell, caches them in IndexedDB, and returns them for map rendering.
 *
 * Parameterized by listing tag (e.g. 'listing-helpouts', 'listing-social')
 * so one class serves all listing-type verticals.
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

import { type NostrService, REPLACEABLE_KIND, RELAY_LABEL, type NostrEvent } from './nostrService';
import { idb } from '../idb';
import { logger } from '../utils/logger';
import { fetchDeletions, applyDeletions } from './listingDeletionService';
import type { Listing } from '../types';

/** Fallback timeout if relay never sends EOSE (ms). */
const FETCH_TIMEOUT_MS = 5000;

/** Maximum age for listings we render/keep (7 days). */
const LISTING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export class ListingLayerService {
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
   */
  async fetchListings(geohash4: string, forceRefresh = false): Promise<Listing[]> {
    let cached: { listings: Listing[]; fetchedAt: number } | null = null;

    // Check cache first (unless forced). We treat any listing with
    // timestamp <= 7 days old as valid for rendering.
    if (!forceRefresh) {
      try {
        cached = await idb.loadListings(this.cacheType, geohash4);
        if (cached) {
          const cutoff = Date.now() - LISTING_MAX_AGE_MS;
          const recent = cached.listings.filter((l) => {
            const t = new Date(l.timestamp).getTime();
            return Number.isFinite(t) && t > cutoff;
          });
          if (recent.length > 0) {
            return recent;
          }
        }
      } catch {
        // IDB read failed, proceed to relay
      }
    }

    // Fetch from relay and DELETEs in parallel; write listing result then apply DELETEs
    try {
      const [listings, deletedSet] = await Promise.all([
        this.fetchFromRelay(geohash4),
        fetchDeletions(this.nostr),
      ]);
      const cutoff = Date.now() - LISTING_MAX_AGE_MS;
      const trimmed = listings.filter((l) => {
        const t = new Date(l.timestamp).getTime();
        return Number.isFinite(t) && t > cutoff;
      });
      await idb.saveListings(this.cacheType, geohash4, trimmed, Date.now());
      await applyDeletions(deletedSet);
      return trimmed;
    } catch (e) {
      logger.warn(`Relay fetch failed for cell ${geohash4}, trying cache`, {
        component: 'ListingLayerService',
        operation: 'fetchListings',
      });
      // Fall back to cache regardless of age
      try {
        const fallback = await idb.loadListings(this.cacheType, geohash4);
        if (!fallback) return [];
        const cutoff = Date.now() - LISTING_MAX_AGE_MS;
        return fallback.listings.filter((l) => {
          const t = new Date(l.timestamp).getTime();
          return Number.isFinite(t) && t > cutoff;
        });
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
  private fetchFromRelay(geohash4: string): Promise<Listing[]> {
    return new Promise((resolve) => {
      const listings: Listing[] = [];
      const seen = new Set<string>();
      const subId = `layer-${this.cacheType}-${Date.now()}`;
      let resolved = false;

      const done = () => {
        if (resolved) return;
        resolved = true;
        this.nostr.unsubscribe(subId);
        resolve(listings);
      };

      this.nostr.subscribe(subId, {
        kinds: [REPLACEABLE_KIND],
        '#g': [geohash4],
        '#t': [this.listingTag],
        '#L': [RELAY_LABEL],
        since: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,
      }, (event: NostrEvent) => {
        if (!event.content) return;
        if (seen.has(event.id)) return;
        seen.add(event.id);

        try {
          const listing: Listing = JSON.parse(event.content);
          listing.pubkey = event.pubkey;
          listings.push(listing);
        } catch {
          // Malformed event, skip
        }
      }, done); // onEose → resolve immediately

      // Fallback timeout if relay never sends EOSE
      setTimeout(done, FETCH_TIMEOUT_MS);
    });
  }
}
