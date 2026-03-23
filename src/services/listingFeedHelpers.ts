/**
 * Shared helpers for listing feeds (geohash and global).
 * Parse events, trim by age, build Nostr filters, run subscription lifecycle.
 */

import { type NostrService, type NostrEvent } from './nostrService';
import type {
  Listing,
  ListingVertical,
  SwarmMissionCardPayload,
  SwarmMissionLane,
  SwarmMissionState,
} from '../types';
import {
  LISTING_MAX_AGE_MS,
  LISTING_MAX_AGE_SECS,
  PAGE_SIZE,
  SWARM_MISSION_MAX_AGE_MS,
  SWARM_MISSION_MAX_AGE_SECS,
} from './listingConstants';
import { buildReplaceableFilter, runReliableSnapshot } from './relayOrchestrator';

function emptySwarmMissionState(): SwarmMissionState {
  return {
    links: { brainstorming: '', meetanddo: '', petition: '', crowdfunding: '' },
    success: { brainstorming: false, petition: false, crowdfunding: false },
  };
}

/** Normalize relay JSON for vertical swarmmission (mutates listing). */
export function normalizeSwarmListing(listing: Listing): void {
  if (listing.vertical !== 'swarmmission') return;
  const base = emptySwarmMissionState();
  const raw = listing.swarm;
  if (raw && typeof raw === 'object') {
    const lanes: SwarmMissionLane[] = ['brainstorming', 'meetanddo', 'petition', 'crowdfunding'];
    for (const lane of lanes) {
      const v = raw.links?.[lane];
      base.links[lane] = typeof v === 'string' ? v.trim() : '';
    }
    base.success.brainstorming = !!raw.success?.brainstorming;
    base.success.petition = !!raw.success?.petition;
    base.success.crowdfunding = !!raw.success?.crowdfunding;
  }
  if (!base.links.brainstorming.trim() && listing.contact?.trim()) {
    base.links.brainstorming = listing.contact.trim();
  }
  listing.swarm = base;
  listing.contact = base.links.brainstorming;
  listing.vertical = 'swarmmission';
}

export function laneOpenForParticipation(swarm: SwarmMissionState, lane: SwarmMissionLane): boolean {
  const link = swarm.links[lane]?.trim();
  if (!link) return false;
  if (lane === 'meetanddo') return true;
  if (lane === 'brainstorming') return !swarm.success.brainstorming;
  if (lane === 'petition') return !swarm.success.petition;
  return !swarm.success.crowdfunding;
}

export function missionPassesSwarmFilters(listing: Listing, filters: Set<SwarmMissionLane>): boolean {
  if (listing.vertical !== 'swarmmission' || filters.size === 0) return true;
  const swarm = listing.swarm;
  if (!swarm) return false;
  for (const lane of filters) {
    if (laneOpenForParticipation(swarm, lane)) return true;
  }
  return false;
}

export function listingToMissionCardPayload(listing: Listing): SwarmMissionCardPayload | null {
  if (listing.vertical !== 'swarmmission') return null;
  normalizeSwarmListing(listing);
  const swarm = listing.swarm!;
  return {
    id: listing.id,
    authorPubkey: listing.pubkey,
    title: listing.title ?? '',
    description: listing.description,
    address: listing.address,
    locationLat: listing.location != null ? String(listing.location.latitude) : '',
    locationLon: listing.location != null ? String(listing.location.longitude) : '',
    timestamp: listing.timestamp,
    swarm: {
      links: { ...swarm.links },
      success: { ...swarm.success },
    },
  };
}
import { logger } from '../utils/logger';

/** Parse a Nostr event into a Listing; optionally set vertical from #t tag or a fixed vertical. Returns null if malformed or verticalFromTag rejects. */
export function parseListingEvent(
  event: NostrEvent,
  options?: { vertical?: ListingVertical; verticalFromTag?: (tag: string) => ListingVertical | null }
): Listing | null {
  if (!event.content) return null;
  try {
    const listing: Listing = JSON.parse(event.content);
    listing.pubkey = event.pubkey;
    if (options?.vertical) {
      listing.vertical = options.vertical;
    } else if (options?.verticalFromTag) {
      const tag = event.tags?.find((t) => t[0] === 't')?.[1];
      const vertical = tag ? options.verticalFromTag(tag) : null;
      if (!vertical) return null;
      listing.vertical = vertical;
    }
    if (listing.vertical === 'swarmmission') {
      normalizeSwarmListing(listing);
    }
    return listing;
  } catch {
    return null;
  }
}

/** Filter listings to those with timestamp within maxAgeMs of now. */
export function trimByMaxAge(listings: Listing[], maxAgeMs: number): Listing[] {
  const cutoff = Date.now() - maxAgeMs;
  return listings.filter((l) => {
    const t = new Date(l.timestamp).getTime();
    return Number.isFinite(t) && t > cutoff;
  });
}

/** Trim by vertical: swarm missions 14d, other listings 7d. */
export function trimListingsByVerticalAge(listings: Listing[]): Listing[] {
  const now = Date.now();
  return listings.filter((l) => {
    const t = new Date(l.timestamp).getTime();
    if (!Number.isFinite(t)) return false;
    const maxMs = l.vertical === 'swarmmission' ? SWARM_MISSION_MAX_AGE_MS : LISTING_MAX_AGE_MS;
    return t > now - maxMs;
  });
}

export interface ListingFilterOptions {
  tags: string | string[];
  geohash?: string;
  category?: string;
  since?: number;
  until?: number;
  limit?: number;
}

/** Build a Nostr filter for listing events. */
export function buildListingFilter(opts: ListingFilterOptions): Record<string, unknown> {
  return buildReplaceableFilter({
    tTags: Array.isArray(opts.tags) ? opts.tags : [opts.tags],
    gTags: opts.geohash ? [opts.geohash] : undefined,
    cTags: opts.category ? [opts.category] : undefined,
    since: opts.since,
    until: opts.until,
    limit: opts.limit,
  });
}

/**
 * Subscribe to listing events, call onEvent for each, resolve on EOSE or timeout.
 * @returns true if EOSE was received, false if timeout
 */
export function runListingSubscription(
  nostr: NostrService,
  filter: Record<string, unknown>,
  onEvent: (event: NostrEvent) => void,
  opts: { subIdPrefix: string; metricName?: string }
): Promise<boolean> {
  return runReliableSnapshot(nostr, {
    filter,
    subIdPrefix: opts.subIdPrefix,
    minRelaysAfterSettle: 1,
    retries: 2,
    onMetrics: (meta) => {
      logger.info(
        `relay-metrics snapshot ${opts.metricName ?? opts.subIdPrefix} status=${meta.status} connected=${meta.connectedAtStart} eose=${meta.eoseReceived} retries=${meta.retriesUsed} timedOut=${meta.timedOut}`,
        { component: 'listingFeedHelpers', operation: 'runListingSubscription' },
      );
    },
    onEvent,
  }).then((result) => result.status === 'synced');
}

/** Default since for filters: far enough back to include longest listing TTL (swarm 14d). */
export function defaultSinceSec(): number {
  return Math.floor(Date.now() / 1000) - Math.max(LISTING_MAX_AGE_SECS, SWARM_MISSION_MAX_AGE_SECS);
}

// ─── Global feed primitives (fetchNewer / fetchOlder) ─────────

export interface FetchNewerResult {
  listings: Listing[];
  newest: number | null;
  resolvedByEose: boolean;
}

export interface FetchOlderResult {
  listings: Listing[];
  oldest: number | null;
}

/** Fetch one page of listings newer than since. Tracks newest event created_at. */
export async function fetchNewer(
  nostr: NostrService,
  opts: {
    tags: string[];
    since: number;
    limit?: number;
    verticalFromTag?: (tag: string) => ListingVertical | null;
  }
): Promise<FetchNewerResult> {
  const listings: Listing[] = [];
  const seen = new Set<string>();
  let newestCreatedAt = 0;
  const filter = buildListingFilter({
    tags: opts.tags,
    since: opts.since,
    limit: opts.limit ?? PAGE_SIZE,
  });
  const resolvedByEose = await runListingSubscription(nostr, filter, (event: NostrEvent) => {
    if (seen.has(event.id)) return;
    seen.add(event.id);
    if (event.created_at > newestCreatedAt) newestCreatedAt = event.created_at;
    const listing = parseListingEvent(event, opts.verticalFromTag ? { verticalFromTag: opts.verticalFromTag } : undefined);
    if (listing) listings.push(listing);
  }, { subIdPrefix: 'global-newer', metricName: 'global-newer' });
  return {
    listings,
    newest: newestCreatedAt === 0 ? null : newestCreatedAt,
    resolvedByEose,
  };
}

/** Fetch one page of listings older than until (or first page if no until). Tracks oldest event created_at. */
export async function fetchOlder(
  nostr: NostrService,
  opts: {
    tags: string | string[];
    until?: number;
    limit?: number;
    category?: string;
    verticalFromTag?: (tag: string) => ListingVertical | null;
  }
): Promise<FetchOlderResult> {
  const listings: Listing[] = [];
  const seen = new Set<string>();
  let oldestCreatedAt = Infinity;
  const filter = buildListingFilter({
    tags: opts.tags,
    category: opts.category,
    since: defaultSinceSec(),
    until: opts.until,
    limit: opts.limit ?? PAGE_SIZE,
  });
  await runListingSubscription(nostr, filter, (event: NostrEvent) => {
    if (seen.has(event.id)) return;
    seen.add(event.id);
    if (event.created_at < oldestCreatedAt) oldestCreatedAt = event.created_at;
    const listing = parseListingEvent(event, opts.verticalFromTag ? { verticalFromTag: opts.verticalFromTag } : undefined);
    if (listing) listings.push(listing);
  }, { subIdPrefix: 'global-older', metricName: 'global-older' });
  return {
    listings,
    oldest: oldestCreatedAt === Infinity ? null : oldestCreatedAt,
  };
}
