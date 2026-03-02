/**
 * Swarm Governance Listing Service
 *
 * One combined global feed for brainstorming, meetanddo, petition, crowdfunding.
 * Fetches on start and every 30 min. Each run: fetch new (since newestTimestamp),
 * fetch one page older (until oldestTimestamp), merge, trim to 7 days, save both cursors.
 * On relay failure uses cache (listings < 7 days).
 */

import { type NostrService, REPLACEABLE_KIND, RELAY_LABEL, type NostrEvent } from './nostrService';
import { idb } from '../idb';
import { logger } from '../utils/logger';
import { fetchDeletions, applyDeletions } from './listingDeletionService';
import type { Listing, ListingVertical } from '../types';
import { VERTICALS, SWARM_GOVERNANCE_VERTICALS } from '../gig/verticals';
import type { ListingVerticalConfig } from '../gig/verticals';

const FETCH_TIMEOUT_MS = 8000;
const PAGE_SIZE = 50;
const LISTING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function listingTagToVertical(tag: string): ListingVertical | null {
  for (const v of SWARM_GOVERNANCE_VERTICALS) {
    const cfg = VERTICALS[v] as ListingVerticalConfig;
    if (cfg.listingTag === tag) return v;
  }
  return null;
}

export class SwarmGovernanceListingService {
  private nostr: NostrService;

  constructor(nostr: NostrService) {
    this.nostr = nostr;
  }

  /**
   * Run fetch: only for active verticals. Fetches new (since newest) + one page older (until oldest),
   * merges with cache, trims to 7 days, saves both cursors. On relay failure uses cache.
   */
  async run(activeVerticalIds: ListingVertical[]): Promise<Listing[]> {
    const active = activeVerticalIds.filter(v => SWARM_GOVERNANCE_VERTICALS.includes(v));
    if (active.length === 0) return [];

    const listingTags = active.map(v => (VERTICALS[v] as ListingVerticalConfig).listingTag);
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    try {
      const cached = await idb.loadSwarmGovernanceCache();
      const newPromise = this.fetchFromRelay(listingTags, {
        since: cached?.newestTimestamp ?? sevenDaysAgo,
      });
      const oldPromise =
        cached?.oldestTimestamp != null
          ? this.fetchFromRelay(listingTags, { until: cached.oldestTimestamp })
          : Promise.resolve({ listings: [], oldestTimestamp: null, resolvedByEose: true });

      const [newPage, oldPage, deletedSet] = await Promise.all([
        newPromise,
        oldPromise,
        fetchDeletions(this.nostr),
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

      const cutoff = Date.now() - LISTING_MAX_AGE_MS;
      const trimmed = merged.filter(l => new Date(l.timestamp).getTime() > cutoff);
      const timestamps = trimmed.map(l => Math.floor(new Date(l.timestamp).getTime() / 1000));
      const oldestTimestamp = timestamps.length === 0 ? null : Math.min(...timestamps);
      const newestTimestamp =
        newPage.resolvedByEose && timestamps.length > 0
          ? Math.max(...timestamps)
          : cached?.newestTimestamp ?? null;

      await idb.saveSwarmGovernanceCache(trimmed, Date.now(), oldestTimestamp, newestTimestamp);
      await applyDeletions(deletedSet);
      return trimmed;
    } catch (e) {
      logger.warn('Swarm Governance relay fetch failed', { component: 'SwarmGovernanceListingService', operation: 'run' });
      const cached = await idb.loadSwarmGovernanceCache();
      if (!cached) return [];
      const cutoff = Date.now() - LISTING_MAX_AGE_MS;
      return cached.listings.filter(l => new Date(l.timestamp).getTime() > cutoff);
    }
  }

  private fetchFromRelay(
    listingTags: string[],
    opts: { since?: number; until?: number } = {},
  ): Promise<{ listings: Listing[]; oldestTimestamp: number | null; resolvedByEose: boolean }> {
    return new Promise((resolve) => {
      const listings: Listing[] = [];
      const seen = new Set<string>();
      const subId = `sg-${Date.now()}`;
      let resolved = false;
      let oldestCreatedAt = Infinity;

      const done = (byEose: boolean) => {
        if (resolved) return;
        resolved = true;
        this.nostr.unsubscribe(subId);
        resolve({
          listings,
          oldestTimestamp: oldestCreatedAt === Infinity ? null : oldestCreatedAt,
          resolvedByEose: byEose,
        });
      };

      const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      const filter: Record<string, unknown> = {
        kinds: [REPLACEABLE_KIND],
        '#t': listingTags,
        '#L': [RELAY_LABEL],
        since: opts.since ?? sevenDaysAgo,
        limit: PAGE_SIZE,
      };
      if (opts.until != null) filter['until'] = opts.until;

      this.nostr.subscribe(subId, filter, (event: NostrEvent) => {
        if (!event.content) return;
        if (seen.has(event.id)) return;
        seen.add(event.id);
        if (event.created_at < oldestCreatedAt) oldestCreatedAt = event.created_at;

        const tag = event.tags?.find(t => t[0] === 't')?.[1];
        const vertical = tag ? listingTagToVertical(tag) : null;
        if (!vertical) return;

        try {
          const listing: Listing = JSON.parse(event.content);
          listing.pubkey = event.pubkey;
          listing.vertical = vertical;
          listings.push(listing);
        } catch { /* malformed */ }
      }, () => done(true));

      setTimeout(() => done(false), FETCH_TIMEOUT_MS);
    });
  }
}
