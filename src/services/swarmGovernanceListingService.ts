/**
 * Swarm Governance Listing Service
 *
 * One combined global feed for brainstorming, meetanddo, petition, crowdfunding.
 * Fetches on start and every 30 min; only requests verticals that are currently on.
 * Append-on-refetch with until cursor; on relay failure uses cache (listings < 14 days).
 */

import { type NostrService, REPLACEABLE_KIND, RELAY_LABEL, type NostrEvent } from './nostrService';
import { idb } from '../idb';
import { logger } from '../utils/logger';
import type { Listing, ListingVertical } from '../types';
import { VERTICALS, SWARM_GOVERNANCE_VERTICALS } from '../gig/verticals';
import type { ListingVerticalConfig } from '../gig/verticals';

const FETCH_TIMEOUT_MS = 8000;
const PAGE_SIZE = 50;
const LISTING_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

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
   * Run fetch: only for active verticals. First page or append via until.
   * On relay failure returns cached listings < 14 days old.
   */
  async run(activeVerticalIds: ListingVertical[]): Promise<Listing[]> {
    const active = activeVerticalIds.filter(v => SWARM_GOVERNANCE_VERTICALS.includes(v));
    if (active.length === 0) return [];

    const listingTags = active.map(v => (VERTICALS[v] as ListingVerticalConfig).listingTag);

    try {
      const cached = await idb.loadSwarmGovernanceCache();
      const until = cached?.oldestTimestamp ?? undefined;

      const page = await this.fetchFromRelay(listingTags, until);
      const merged = cached?.listings ?? [];
      const seen = new Set(merged.map(l => l.id));
      for (const l of page.listings) {
        if (!seen.has(l.id)) {
          seen.add(l.id);
          merged.push(l);
        }
      }
      await idb.saveSwarmGovernanceCache(merged, Date.now(), page.oldestTimestamp ?? cached?.oldestTimestamp ?? null);
      return merged;
    } catch (e) {
      logger.warn('Swarm Governance relay fetch failed', { component: 'SwarmGovernanceListingService', operation: 'run' });
      const cached = await idb.loadSwarmGovernanceCache();
      if (!cached) return [];
      const cutoff = Date.now() - LISTING_MAX_AGE_MS;
      return cached.listings.filter(l => new Date(l.timestamp).getTime() > cutoff);
    }
  }

  private fetchFromRelay(listingTags: string[], until?: number): Promise<{ listings: Listing[]; oldestTimestamp: number | null }> {
    return new Promise((resolve) => {
      const listings: Listing[] = [];
      const seen = new Set<string>();
      const subId = `sg-${Date.now()}`;
      let resolved = false;
      let oldestCreatedAt = Infinity;

      const done = () => {
        if (resolved) return;
        resolved = true;
        this.nostr.unsubscribe(subId);
        resolve({
          listings,
          oldestTimestamp: oldestCreatedAt === Infinity ? null : oldestCreatedAt,
        });
      };

      const filter: Record<string, unknown> = {
        kinds: [REPLACEABLE_KIND],
        '#t': listingTags,
        '#L': [RELAY_LABEL],
        since: Math.floor(Date.now() / 1000) - 14 * 24 * 60 * 60,
        limit: PAGE_SIZE,
      };
      if (until != null) filter['until'] = until;

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
      }, done);

      setTimeout(done, FETCH_TIMEOUT_MS);
    });
  }
}
