/**
 * tombstoneCheck.ts — Builds the filters that ask relays "were THESE
 * listings deleted?". A tombstone replaces its listing on the relay and
 * carries nothing about the listing's segment, so it cannot be found by
 * model/category/area — but it shares author and `d` tag with the listing,
 * and we know those for every listing we show. Each filter comes with the
 * listings it asks about, so the caller can tell which of them were
 * answered. Pure.
 */

import type { NostrFilter } from '../nostr';

export interface ListingKey {
  author: string;
  dTag: string;
}

export interface TombstoneBlock<T extends ListingKey> {
  /** The listings this block's filter asks about. */
  keys: T[];
  filter: NostrFilter;
}

/** Splits `keys` into blocks of at most `blockSize` listings, one filter each. */
export function tombstoneBlocks<T extends ListingKey>(
  keys: T[],
  options: { kind: number; deletionTag: string; blockSize: number },
): TombstoneBlock<T>[] {
  const blocks: TombstoneBlock<T>[] = [];

  for (let i = 0; i < keys.length; i += options.blockSize) {
    const block = keys.slice(i, i + options.blockSize);

    blocks.push({
      keys: block,
      filter: {
        kinds: [options.kind],
        authors: [...new Set(block.map((k) => k.author))],
        '#d': [...new Set(block.map((k) => k.dTag))],
        '#t': [options.deletionTag],
      },
    });
  }

  return blocks;
}
