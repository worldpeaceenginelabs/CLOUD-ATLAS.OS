/**
 * Listing Deletion Service
 *
 * Fetches DELETE events from the relay (moving since cursor) and applies them
 * to all listing cache (IDB + in-memory layerListings). Run after every listing
 * fetch that wrote to cache: write listing result first, then fetch DELETEs and apply.
 */

import { type NostrService, REPLACEABLE_KIND, RELAY_LABEL, type NostrEvent } from './nostrService';
import { idb } from '../idb';
import { applyDeletionsToLayerListings } from '../store';

const DELETE_FETCH_TIMEOUT_MS = 5000;
const LISTING_WINDOW_SECS = 7 * 24 * 60 * 60;

/**
 * Fetch new DELETE events from the relay. Uses lastDeleteFetchSince so we only
 * get events we haven't applied yet. Returns Set of 'id:pubkey'.
 */
export async function fetchDeletions(nostr: NostrService): Promise<Set<string>> {
  await idb.openDB();
  const lastSince = await idb.getLastDeleteFetchSince();
  const nowSec = Math.floor(Date.now() / 1000);
  const since = Math.max(nowSec - LISTING_WINDOW_SECS, lastSince);

  return new Promise((resolve) => {
    const deletedSet = new Set<string>();
    const subId = `del-${Date.now()}`;
    let resolved = false;

    const done = () => {
      if (resolved) return;
      resolved = true;
      nostr.unsubscribe(subId);
      resolve(deletedSet);
    };

    nostr.subscribe(
      subId,
      {
        kinds: [REPLACEABLE_KIND],
        '#t': ['DELETE'],
        '#L': [RELAY_LABEL],
        since,
      },
      (event: NostrEvent) => {
        const dTag = event.tags?.find((t) => t[0] === 'd')?.[1];
        if (dTag && event.pubkey) {
          deletedSet.add(`${dTag}:${event.pubkey}`);
        }
      },
      done
    );

    setTimeout(done, DELETE_FETCH_TIMEOUT_MS);
  });
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
