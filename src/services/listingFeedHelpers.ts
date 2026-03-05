/**
 * Shared helpers for listing feeds (geohash and global).
 * Parse events, trim by age, build Nostr filters, run subscription lifecycle.
 */

import { type NostrService, type NostrEvent, REPLACEABLE_KIND, RELAY_LABEL } from './nostrService';
import type { Listing, ListingVertical } from '../types';
import { LISTING_MAX_AGE_SECS, FETCH_TIMEOUT_MS, PAGE_SIZE } from './listingConstants';

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
  const filter: Record<string, unknown> = {
    kinds: [REPLACEABLE_KIND],
    '#t': Array.isArray(opts.tags) ? opts.tags : [opts.tags],
    '#L': [RELAY_LABEL],
  };
  if (opts.geohash != null) filter['#g'] = [opts.geohash];
  if (opts.category != null) filter['#c'] = [opts.category];
  if (opts.since != null) filter.since = opts.since;
  if (opts.until != null) filter.until = opts.until;
  if (opts.limit != null) filter.limit = opts.limit;
  return filter;
}

/**
 * Subscribe to listing events, call onEvent for each, resolve on EOSE or timeout.
 * @returns true if EOSE was received, false if timeout
 */
export function runListingSubscription(
  nostr: NostrService,
  filter: Record<string, unknown>,
  onEvent: (event: NostrEvent) => void,
  opts: { timeoutMs: number; subIdPrefix: string }
): Promise<boolean> {
  return new Promise((resolve) => {
    const subId = `${opts.subIdPrefix}-${Date.now()}`;
    let resolved = false;
    const done = (byEose: boolean) => {
      if (resolved) return;
      resolved = true;
      nostr.unsubscribe(subId);
      resolve(byEose);
    };
    nostr.subscribe(subId, filter, (event: NostrEvent) => onEvent(event), () => done(true));
    setTimeout(() => done(false), opts.timeoutMs);
  });
}

/** Default since (7 days ago) for filters that don't specify since. */
export function defaultSinceSec(): number {
  return Math.floor(Date.now() / 1000) - LISTING_MAX_AGE_SECS;
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
  }, { timeoutMs: FETCH_TIMEOUT_MS, subIdPrefix: 'global-newer' });
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
  }, { timeoutMs: FETCH_TIMEOUT_MS, subIdPrefix: 'global-older' });
  return {
    listings,
    oldest: oldestCreatedAt === Infinity ? null : oldestCreatedAt,
  };
}
