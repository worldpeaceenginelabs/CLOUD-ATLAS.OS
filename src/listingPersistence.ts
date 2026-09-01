/**
 * listingPersistence.ts — The local persistence layer for LISTING mode
 * (orchestrator-prompt.md §3.5). Built on top of the generic idb.ts, this
 * module knows exactly one thing beyond "persist a JSON blob under a
 * key": the shape of the key (`${author}:${dTag}`) and that it stores
 * listing records. It does NOT know about Nostr events, relays, or
 * discovery — it never decides *what* gets persisted or *when*; that
 * decision belongs entirely to Orchestrator.svelte, which is the only
 * caller. This module exists only for LISTING; LIVE has no persistence
 * layer at all (see orchestrator-prompt.md §11).
 */

import { IdbDatabase } from './idb';
import type { ListingRecord } from './appStore';

const DB_NAME = 'app-listings';
const DB_VERSION = 1;
const STORE = 'listings';

let dbPromise: Promise<IdbDatabase> | null = null;

function getDb(): Promise<IdbDatabase> {
  if (!dbPromise) {
    dbPromise = IdbDatabase.open({
      name: DB_NAME,
      version: DB_VERSION,
      stores: [{ name: STORE }], // out-of-line keys — key passed explicitly on each call
    });
  }
  return dbPromise;
}

/** Persists (creates or overwrites) one listing record under its logical id. */
export async function saveListing(record: ListingRecord): Promise<void> {
  const db = await getDb();
  await db.set(STORE, record, record.id);
}

/** Removes one listing record, if present. No-op if it was never persisted. */
export async function deleteListing(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

/** Returns every currently persisted listing record — used once at startup to hydrate the store from local cache. */
export async function loadAllListings(): Promise<ListingRecord[]> {
  const db = await getDb();
  return db.getAll<ListingRecord>(STORE);
}
