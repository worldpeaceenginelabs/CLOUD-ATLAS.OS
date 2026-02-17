/**
 * Helpout Layer Service
 *
 * Fetches helpout listings from Nostr relays for a geohash-4 cell,
 * caches them in IndexedDB, and returns them for map rendering.
 *
 * Cache strategy:
 *   - First fetch: relay → IDB (with timestamp)
 *   - Subsequent fetches within 30 min: return from IDB
 *   - After 30 min or forceRefresh: relay → IDB
 *   - On relay failure: fall back to IDB cache regardless of age
 */

import { NostrService, REPLACEABLE_KIND, type NostrEvent } from './nostrService';
import { idb } from '../idb';
import { logger } from '../utils/logger';
import type { HelpoutListing } from '../types';

/** How long to wait for relay events before resolving (ms). */
const FETCH_TIMEOUT_MS = 5000;

/** Cache is considered fresh for 30 minutes. */
const CACHE_TTL_MS = 30 * 60 * 1000;

export class HelpoutLayerService {
  private nostr: NostrService | null = null;
  private sk: Uint8Array;

  constructor(sk: Uint8Array) {
    this.sk = sk;
  }

  /**
   * Fetch helpout listings for a geohash-4 cell.
   * Uses IDB cache if fresh (< 30 min), otherwise fetches from relay.
   * Pass forceRefresh=true to bypass staleness check (e.g. after publishing).
   */
  async fetchListings(geohash4: string, forceRefresh = false): Promise<HelpoutListing[]> {
    // Check cache first (unless forced)
    if (!forceRefresh) {
      try {
        const cached = await idb.loadHelpouts(geohash4);
        if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
          return cached.listings;
        }
      } catch {
        // IDB read failed, proceed to relay
      }
    }

    // Fetch from relay
    try {
      const listings = await this.fetchFromRelay(geohash4);
      await idb.saveHelpouts(geohash4, listings, Date.now());
      return listings;
    } catch (e) {
      logger.warn(`Relay fetch failed for cell ${geohash4}, trying cache`, {
        component: 'HelpoutLayerService',
        operation: 'fetchListings',
      });
      // Fall back to cache regardless of age
      try {
        const cached = await idb.loadHelpouts(geohash4);
        return cached?.listings ?? [];
      } catch {
        return [];
      }
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
