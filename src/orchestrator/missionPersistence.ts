/**
 * missionPersistence.ts — The local persistence layer for Missions,
 * structured exactly like listingPersistence.ts (orchestrator-prompt.md
 * §3.5's pattern, applied to the separate Mission Store slice). Built on
 * the same generic idb.ts. Knows only that it stores mission records
 * under their logical id — no Nostr, no relays, no discovery, no
 * decision about *when* to persist (that's Orchestrator.svelte's job,
 * the only caller). A separate IndexedDB database from listings, since
 * missions are a logically separate concept (orchestrator-prompt-mission.md
 * §9/§10) — not a second parallel persistence *mechanism*, just its own
 * data.
 */

import { IdbDatabase } from '../idb';
import type { MissionRecord } from './appStore';

const DB_NAME = 'app-missions';
const DB_VERSION = 1;
const STORE = 'missions';

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

/** Persists (creates or overwrites) one mission record under its logical id. */
export async function saveMission(record: MissionRecord): Promise<void> {
  const db = await getDb();
  await db.set(STORE, record, record.id);
}

/** Removes one mission record, if present. No-op if it was never persisted. */
export async function deleteMission(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

/** Returns every currently persisted mission record — used once at startup to hydrate the store from local cache. */
export async function loadAllMissions(): Promise<MissionRecord[]> {
  const db = await getDb();
  return db.getAll<MissionRecord>(STORE);
}
