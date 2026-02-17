/**
 * Key Manager
 *
 * Single persistent Nostr keypair used across all gig economy verticals.
 * On first call, generates a keypair and stores it in IDB.
 * Subsequent calls return the cached keypair.
 */

import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { idb } from '../idb';

let cached: { sk: Uint8Array; pk: string } | null = null;

/**
 * Get the app's Nostr keypair.
 * Loads from IDB if available, otherwise generates and persists a new one.
 */
export async function getKeypair(): Promise<{ sk: Uint8Array; pk: string }> {
  if (cached) return cached;

  // Ensure IDB is open
  await idb.openDB();

  const stored = await idb.loadKeypair();
  if (stored) {
    cached = stored;
    return cached;
  }

  // First run — generate and persist
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  await idb.saveKeypair(sk, pk);

  cached = { sk, pk };
  return cached;
}
