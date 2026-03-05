/**
 * Global listing feed: one implementation for map mode and online mode.
 * Time-based (since/until), no geohash. Map mode = multi-vertical, cache key global:map.
 * Online mode = single vertical, cache key global:online:{vertical}:{category}.
 */

import { type NostrService } from './nostrService';
import { idb } from '../idb';
import { logger } from '../utils/logger';
import { fetchDeletions, applyDeletions } from './listingDeletionService';
import { LISTING_MAX_AGE_MS, PAGE_SIZE } from './listingConstants';
import { trimByMaxAge, fetchNewer, fetchOlder, defaultSinceSec } from './listingFeedHelpers';
import type { Listing, ListingVertical } from '../types';
import { VERTICALS, GLOBAL_FEED_MAP_VERTICALS } from '../gig/verticals';
import type { ListingVerticalConfig } from '../gig/verticals';

const GLOBAL_MAP_CACHE_KEY = 'global:map';

function listingTagToVertical(tag: string): ListingVertical | null {
  for (const v of GLOBAL_FEED_MAP_VERTICALS) {
    const cfg = VERTICALS[v] as ListingVerticalConfig;
    if (cfg.listingTag === tag) return v;
  }
  return null;
}

/**
 * Run global feed for map: fetch newer + older, merge with cache, trim, save, apply deletions.
 * Returns trimmed listings (only for verticals in activeVerticalIds).
 */
export async function runGlobalFeedMap(
  nostr: NostrService,
  activeVerticalIds: ListingVertical[]
): Promise<Listing[]> {
  const active = activeVerticalIds.filter((v) => GLOBAL_FEED_MAP_VERTICALS.includes(v));
  if (active.length === 0) return [];

  const listingTags = active.map((v) => (VERTICALS[v] as ListingVerticalConfig).listingTag);
  const sevenDaysAgo = defaultSinceSec();

  try {
    const cached = await idb.loadListingCache(GLOBAL_MAP_CACHE_KEY);
    const [newPage, oldPage, deletedSet] = await Promise.all([
      fetchNewer(nostr, {
        tags: listingTags,
        since: cached?.newest ?? sevenDaysAgo,
        limit: PAGE_SIZE,
        verticalFromTag: listingTagToVertical,
      }),
      cached?.oldest != null
        ? fetchOlder(nostr, {
            tags: listingTags,
            until: cached.oldest,
            limit: PAGE_SIZE,
            verticalFromTag: listingTagToVertical,
          })
        : Promise.resolve({ listings: [], oldest: null }),
      fetchDeletions(nostr),
    ]);

    const seen = new Set<string>();
    const merged: Listing[] = [];
    for (const l of newPage.listings) {
      if (!seen.has(l.id)) {
        seen.add(l.id);
        merged.push(l);
      }
    }
    for (const l of oldPage.listings) {
      if (!seen.has(l.id)) {
        seen.add(l.id);
        merged.push(l);
      }
    }
    for (const l of cached?.listings ?? []) {
      if (!seen.has(l.id)) {
        seen.add(l.id);
        merged.push(l);
      }
    }

    const trimmed = trimByMaxAge(merged, LISTING_MAX_AGE_MS);
    const timestamps = trimmed.map((l) => Math.floor(new Date(l.timestamp).getTime() / 1000));
    const oldest = timestamps.length === 0 ? null : Math.min(...timestamps);
    const newest =
      newPage.resolvedByEose && timestamps.length > 0 ? Math.max(...timestamps) : cached?.newest ?? null;

    await idb.saveListingCache(GLOBAL_MAP_CACHE_KEY, {
      listings: trimmed,
      fetchedAt: Date.now(),
      oldest,
      newest,
    });
    await applyDeletions(deletedSet);
    return trimmed;
  } catch (e) {
    logger.warn('Global feed (map) relay fetch failed', { component: 'globalListingFeed', operation: 'runGlobalFeedMap' });
    const cached = await idb.loadListingCache(GLOBAL_MAP_CACHE_KEY);
    if (!cached) return [];
    return trimByMaxAge(cached.listings, LISTING_MAX_AGE_MS);
  }
}

export interface GlobalFeedOnlinePage {
  listings: Listing[];
  oldestTimestamp: number | null;
  exhausted: boolean;
}

/**
 * Fetch one page of global feed for online list (single vertical, optional category).
 */
export async function fetchGlobalFeedOnlinePage(
  nostr: NostrService,
  verticalId: ListingVertical,
  opts: { category?: string; until?: number; forceRefresh?: boolean } = {}
): Promise<GlobalFeedOnlinePage> {
  const cfg = VERTICALS[verticalId] as ListingVerticalConfig;
  const listingTag = cfg.listingTag;
  const category = opts.category ?? 'all';
  const cacheKey = opts.until ? `global:online:${verticalId}:${category}:${opts.until}` : `global:online:${verticalId}:${category}`;

  if (!opts.forceRefresh) {
    try {
      const cached = await idb.loadListingCache(cacheKey);
      if (cached) {
        const recent = trimByMaxAge(cached.listings, LISTING_MAX_AGE_MS);
        if (recent.length > 0) {
          return {
            listings: recent,
            oldestTimestamp: getOldestTimestamp(recent),
            exhausted: recent.length < PAGE_SIZE,
          };
        }
      }
    } catch {
      /* proceed to relay */
    }
  }

  try {
    const [page, deletedSet] = await Promise.all([
      fetchOlder(nostr, {
        tags: listingTag,
        category: opts.category,
        until: opts.until,
        limit: PAGE_SIZE,
      }),
      fetchDeletions(nostr),
    ]);
    const trimmed = trimByMaxAge(page.listings, LISTING_MAX_AGE_MS);
    const online = trimmed.filter((l) => l.mode === 'online' || l.mode === 'both');
    await idb.saveListingCache(cacheKey, { listings: online, fetchedAt: Date.now() });
    await applyDeletions(deletedSet);
    return {
      listings: online,
      oldestTimestamp: page.oldest,
      exhausted: page.listings.length < PAGE_SIZE,
    };
  } catch (e) {
    logger.warn(`Global feed (online) fetch failed (${verticalId}, cat=${category})`, {
      component: 'globalListingFeed',
      operation: 'fetchGlobalFeedOnlinePage',
    });
    try {
      const cached = await idb.loadListingCache(cacheKey);
      if (cached) {
        const effective = trimByMaxAge(cached.listings, LISTING_MAX_AGE_MS);
        return {
          listings: effective,
          oldestTimestamp: getOldestTimestamp(effective),
          exhausted: effective.length < PAGE_SIZE,
        };
      }
    } catch {
      /* no cache */
    }
    return { listings: [], oldestTimestamp: null, exhausted: true };
  }
}

function getOldestTimestamp(listings: Listing[]): number | null {
  if (listings.length === 0) return null;
  let oldest = Infinity;
  for (const l of listings) {
    const t = new Date(l.timestamp).getTime() / 1000;
    if (t < oldest) oldest = t;
  }
  return oldest === Infinity ? null : oldest;
}
