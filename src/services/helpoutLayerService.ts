/**
 * Helpout Layer Service
 *
 * Fetches helpout listings from Nostr relays for a geohash-4 cell,
 * caches them in IndexedDB, and returns them for map rendering.
 *
 * Cache strategy: simple put/get keyed by geohash-4.
 * On layer toggle-on, always fetch fresh from relay and update cache.
 * Cache is used as fallback if relay fetch fails.
 */

import { NostrService, REPLACEABLE_KIND, type NostrEvent } from './nostrService';
import { idb } from '../idb';
import { logger } from '../utils/logger';
import type { HelpoutListing } from '../types';

/** How long to wait for relay events before resolving (ms). */
const FETCH_TIMEOUT_MS = 5000;

export class HelpoutLayerService {
  private nostr: NostrService | null = null;
  private sk: Uint8Array;

  constructor(sk: Uint8Array) {
    this.sk = sk;
  }

  /**
   * Fetch helpout listings for a geohash-4 cell.
   * Tries relay first, falls back to IDB cache.
   */
  async fetchListings(geohash4: string): Promise<HelpoutListing[]> {
    try {
      const listings = await this.fetchFromRelay(geohash4);
      // Cache the fresh results
      await idb.saveHelpouts(geohash4, listings);
      return listings;
    } catch (e) {
      logger.warn(`Relay fetch failed for cell ${geohash4}, trying cache`, {
        component: 'HelpoutLayerService',
        operation: 'fetchListings',
      });
      // Fall back to cache
      const cached = await idb.loadHelpouts(geohash4);
      return cached ?? [];
    }
  }

  /**
   * Connect to relays, subscribe to helpout listings in the cell,
   * collect events for up to FETCH_TIMEOUT_MS, then disconnect.
   */
  private fetchFromRelay(geohash4: string): Promise<HelpoutListing[]> {
    return new Promise((resolve) => {
      const listings: HelpoutListing[] = [];
      const seen = new Set<string>();

      this.nostr = new NostrService(this.sk);

      this.nostr.subscribe('helpout-layer', {
        kinds: [REPLACEABLE_KIND],
        '#g': [geohash4],
        '#t': ['listing-helpouts'],
        since: Math.floor(Date.now() / 1000) - 14 * 24 * 60 * 60,
      }, (event: NostrEvent) => {
        if (!event.content) return;
        if (seen.has(event.id)) return;
        seen.add(event.id);

        try {
          const listing: HelpoutListing = JSON.parse(event.content);
          listing.pubkey = event.pubkey;
          listings.push(listing);
        } catch {
          // Malformed event, skip
        }
      });

      this.nostr.connectInBackground();

      // Resolve after timeout with whatever we collected
      setTimeout(() => {
        this.disconnect();
        resolve(listings);
      }, FETCH_TIMEOUT_MS);
    });
  }

  /** Disconnect from relays. */
  disconnect(): void {
    if (this.nostr) {
      this.nostr.disconnect();
      this.nostr = null;
    }
  }
}
