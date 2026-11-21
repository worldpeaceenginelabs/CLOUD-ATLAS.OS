/**
 * tombstoneCheck.ts — Builds the filters that ask relays "were THESE
 * listings deleted?". A tombstone replaces its listing on the relay and
 * carries nothing about the listing's segment, so it cannot be found by
 * model/category/area — but it shares author and `d` tag with the listing,
 * and we know those for every listing we show. Pure.
 */

import type { NostrFilter } from '../nostr';

export interface ListingKey {
  author: string;
  dTag: string;
}

/** Splits `keys` into filters of at most `blockSize` listings each. */
export function tombstoneFilters(
  keys: ListingKey[],
  options: { kind: number; deletionTag: string; blockSize: number },
): NostrFilter[] {
  const filters: NostrFilter[] = [];

  for (let i = 0; i < keys.length; i += options.blockSize) {
    const block = keys.slice(i, i + options.blockSize);

    filters.push({
      kinds: [options.kind],
      authors: [...new Set(block.map((k) => k.author))],
      '#d': [...new Set(block.map((k) => k.dTag))],
      '#t': [options.deletionTag],
    });
  }

  return filters;
}
