/**
 * Listing Deletion Service
 *
 * Fetches DELETE events from the relay (moving since cursor) and applies them
 * to all listing cache (IDB + in-memory layerListings). Run after every listing
 * fetch that wrote to cache: write listing result first, then fetch DELETEs and apply.
 */

import { type NostrService, type NostrEvent } from './nostrService';
import { idb } from '../idb';
import { applyDeletionsToLayerListings } from '../store';
import { LISTING_MAX_AGE_SECS } from './listingConstants';
import { buildReplaceableFilter, runReliableSnapshot } from './relayOrchestrator';

/**
 * Fetch new DELETE events from the relay. Uses lastDeleteFetchSince so we only
 * get events we haven't applied yet. Returns Set of 'id:pubkey'.
 */
export async function fetchDeletions(nostr: NostrService): Promise<Set<string>> {
  await idb.openDB();
  const lastSince = await idb.getLastDeleteFetchSince();
  const nowSec = Math.floor(Date.now() / 1000);
  const since = Math.max(nowSec - LISTING_MAX_AGE_SECS, lastSince);
  const deletedSet = new Set<string>();
  await runReliableSnapshot(nostr, {
    filter: buildReplaceableFilter({ tTags: ['DELETE'], since }),
    subIdPrefix: 'del',
    minRelaysAfterSettle: 1,
    retries: 2,
    onEvent: (event: NostrEvent) => {
      const dTag = event.tags?.find((t) => t[0] === 'd')?.[1];
      if (dTag && event.pubkey) {
        deletedSet.add(`${dTag}:${event.pubkey}`);
      }
    },
  });
  return deletedSet;
}

/**
 * Apply deleted set to all cache (IDB + layerListings). Persist lastDeleteFetchSince
 * after apply so we don't re-fetch the same DELETEs.
 */
export async function applyDeletions(deletedSet: Set<string>): Promise<void> {
  if (deletedSet.size === 0) return;
  await idb.openDB();
  await idb.applyDeletionsToAllListings(deletedSet);
  await idb.setLastDeleteFetchSince(Math.floor(Date.now() / 1000));
  applyDeletionsToLayerListings(deletedSet);
}
