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
} from '../types';
import {
  LISTING_MAX_AGE_MS,
  LISTING_MAX_AGE_SECS,
  PAGE_SIZE,
  SWARM_MISSION_MAX_AGE_MS,
  SWARM_MISSION_MAX_AGE_SECS,
} from './listingConstants';
import { buildReplaceableFilter, runReliableSnapshot } from './relayOrchestrator';
import { createEmptySwarmMissionState } from '../utils/swarmMission';

/** Normalize relay JSON for vertical swarmmission (mutates listing). */
export function normalizeSwarmListing(listing: Listing): void {
  if (listing.vertical !== 'swarmmission') return;
  const base = createEmptySwarmMissionState();
  const raw = listing.swarm;
  if (raw && typeof raw === 'object') {
    const lanes: SwarmMissionLane[] = ['brainstorming', 'meetanddo', 'petition', 'crowdfunding'];
    for (const lane of lanes) {
      const v = raw.links?.[lane];
      base.links[lane] = typeof v === 'string' ? v.trim() : '';
    }
  }
  if (!base.links.brainstorming.trim() && listing.contact?.trim()) {
    base.links.brainstorming = listing.contact.trim();
  }
  listing.swarm = base;
  listing.contact = base.links.brainstorming;
  listing.vertical = 'swarmmission';
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

export interface CollectListingEventsOptions {
  filter: Record<string, unknown>;
  parseOptions?: { vertical?: ListingVertical; verticalFromTag?: (tag: string) => ListingVertical | null };
  subIdPrefix: string;
  metricName?: string;
}

export interface CollectListingEventsResult {
  listings: Listing[];
  oldestCreatedAt: number | null;
  newestCreatedAt: number | null;
  resolvedByEose: boolean;
}

export async function collectListingEvents(
  nostr: NostrService,
  opts: CollectListingEventsOptions,
): Promise<CollectListingEventsResult> {
  const listings: Listing[] = [];
  const seen = new Set<string>();
  let newestCreatedAt = 0;
  let oldestCreatedAt = Infinity;
  const resolvedByEose = await runListingSubscription(
    nostr,
    opts.filter,
    (event: NostrEvent) => {
      if (seen.has(event.id)) return;
      seen.add(event.id);
      if (event.created_at > newestCreatedAt) newestCreatedAt = event.created_at;
      if (event.created_at < oldestCreatedAt) oldestCreatedAt = event.created_at;
      const listing = parseListingEvent(event, opts.parseOptions);
      if (listing) listings.push(listing);
    },
    { subIdPrefix: opts.subIdPrefix, metricName: opts.metricName },
  );

  return {
    listings,
    oldestCreatedAt: oldestCreatedAt === Infinity ? null : oldestCreatedAt,
    newestCreatedAt: newestCreatedAt === 0 ? null : newestCreatedAt,
    resolvedByEose,
  };
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
  const filter = buildListingFilter({
    tags: opts.tags,
    since: opts.since,
    limit: opts.limit ?? PAGE_SIZE,
  });
  const result = await collectListingEvents(nostr, {
    filter,
    parseOptions: opts.verticalFromTag ? { verticalFromTag: opts.verticalFromTag } : undefined,
    subIdPrefix: 'global-newer',
    metricName: 'global-newer',
  });
  return {
    listings: result.listings,
    newest: result.newestCreatedAt,
    resolvedByEose: result.resolvedByEose,
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
  const filter = buildListingFilter({
    tags: opts.tags,
    category: opts.category,
    since: defaultSinceSec(),
    until: opts.until,
    limit: opts.limit ?? PAGE_SIZE,
  });
  const result = await collectListingEvents(nostr, {
    filter,
    parseOptions: opts.verticalFromTag ? { verticalFromTag: opts.verticalFromTag } : undefined,
    subIdPrefix: 'global-older',
    metricName: 'global-older',
  });
  return {
    listings: result.listings,
    oldest: result.oldestCreatedAt,
  };
}
