/**
 * Online Listing Service
 *
 * Fetches online-mode helpout and social listings from Nostr relays
 * without geohash filtering (global scope). Uses limit-based pagination
 * and optional category filtering via the '#c' tag.
 *
 * Cache strategy mirrors ListingLayerService but keys by vertical + category.
 */

import { type NostrService, REPLACEABLE_KIND, RELAY_LABEL, type NostrEvent } from './nostrService';
import { idb } from '../idb';
import { logger } from '../utils/logger';
import { fetchDeletions, applyDeletions } from './listingDeletionService';
import type { Listing } from '../types';

const FETCH_TIMEOUT_MS = 8000;
/** Maximum age for listings we render/keep (7 days). */
const LISTING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 50;

export interface OnlinePage {
  listings: Listing[];
  /** created_at of the oldest event — use as `until` for the next page. */
  oldestTimestamp: number | null;
  /** True when the relay returned fewer than PAGE_SIZE results. */
  exhausted: boolean;
}

export class OnlineListingService {
  private nostr: NostrService;
  private listingTag: string;
  private cacheType: string;

  constructor(nostr: NostrService, listingTag: string) {
    this.nostr = nostr;
    this.listingTag = listingTag;
    this.cacheType = listingTag.replace('listing-', '');
  }

  /**
   * Fetch a page of online listings, optionally filtered by category.
   *
   * @param category  Category id to filter by, or undefined for all categories
   * @param until     Pagination cursor — pass oldestTimestamp from the previous page
   * @param forceRefresh  Bypass cache staleness check
   */
  async fetchPage(category?: string, until?: number, forceRefresh = false): Promise<OnlinePage> {
    const cacheKey = this.cacheKey(category, until);

    if (!forceRefresh) {
      try {
        const cached = await idb.loadListings(this.cacheType, cacheKey);
        if (cached) {
          const cutoff = Date.now() - LISTING_MAX_AGE_MS;
          const recent = cached.listings.filter((l) => {
            const t = new Date(l.timestamp).getTime();
            return Number.isFinite(t) && t > cutoff;
          });
          if (recent.length > 0) {
            const listings = recent;
          return {
            listings,
            oldestTimestamp: this.getOldestTimestamp(listings),
            exhausted: listings.length < PAGE_SIZE,
          };
          }
        }
      } catch { /* proceed to relay */ }
    }

    try {
      const [page, deletedSet] = await Promise.all([
        this.fetchFromRelay(category, until),
        fetchDeletions(this.nostr),
      ]);
      const cutoff = Date.now() - LISTING_MAX_AGE_MS;
      const trimmedListings = page.listings.filter((l) => {
        const t = new Date(l.timestamp).getTime();
        return Number.isFinite(t) && t > cutoff;
      });
      await idb.saveListings(this.cacheType, cacheKey, trimmedListings, Date.now());
      await applyDeletions(deletedSet);
      return {
        listings: trimmedListings,
        oldestTimestamp: this.getOldestTimestamp(trimmedListings),
        exhausted: trimmedListings.length < PAGE_SIZE,
      };
    } catch (e) {
      logger.warn(`Online relay fetch failed (${this.cacheType}, cat=${category ?? 'all'})`, {
        component: 'OnlineListingService',
        operation: 'fetchPage',
      });
      try {
        const cached = await idb.loadListings(this.cacheType, cacheKey);
        if (cached) {
          const cutoff = Date.now() - LISTING_MAX_AGE_MS;
          const recent = cached.listings.filter((l) => {
            const t = new Date(l.timestamp).getTime();
            return Number.isFinite(t) && t > cutoff;
          });
          const effective = recent;
          return {
            listings: effective,
            oldestTimestamp: this.getOldestTimestamp(effective),
            exhausted: effective.length < PAGE_SIZE,
          };
        }
      } catch { /* no cache either */ }
      return { listings: [], oldestTimestamp: null, exhausted: true };
    }
  }

  private fetchFromRelay(category?: string, until?: number): Promise<OnlinePage> {
    return new Promise((resolve) => {
      const listings: Listing[] = [];
      const seen = new Set<string>();
      const subId = `online-${this.cacheType}-${Date.now()}`;
      let resolved = false;
      let oldestCreatedAt = Infinity;

      const done = () => {
        if (resolved) return;
        resolved = true;
        this.nostr.unsubscribe(subId);

        const online = listings.filter(l => l.mode === 'online' || l.mode === 'both');

        resolve({
          listings: online,
          oldestTimestamp: oldestCreatedAt === Infinity ? null : oldestCreatedAt,
          exhausted: listings.length < PAGE_SIZE,
        });
      };

      const filter: Record<string, unknown> = {
        kinds: [REPLACEABLE_KIND],
        '#t': [this.listingTag],
        '#L': [RELAY_LABEL],
        since: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,
        limit: PAGE_SIZE,
      };

      if (category) {
        filter['#c'] = [category];
      }

      if (until) {
        filter['until'] = until;
      }

      this.nostr.subscribe(subId, filter, (event: NostrEvent) => {
        if (!event.content) return;
        if (seen.has(event.id)) return;
        seen.add(event.id);

        if (event.created_at < oldestCreatedAt) {
          oldestCreatedAt = event.created_at;
        }

        try {
          const listing: Listing = JSON.parse(event.content);
          listing.pubkey = event.pubkey;
          listings.push(listing);
        } catch { /* malformed */ }
      }, done);

      setTimeout(done, FETCH_TIMEOUT_MS);
    });
  }

  private cacheKey(category?: string, until?: number): string {
    const cat = category ?? 'all';
    return until ? `online:${cat}:${until}` : `online:${cat}`;
  }

  private getOldestTimestamp(listings: Listing[]): number | null {
    if (listings.length === 0) return null;
    let oldest = Infinity;
    for (const l of listings) {
      const t = new Date(l.timestamp).getTime() / 1000;
      if (t < oldest) oldest = t;
    }
    return oldest === Infinity ? null : oldest;
  }
}
