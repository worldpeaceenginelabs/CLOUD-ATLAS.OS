/**
 * keyManager.ts — Single persistent Nostr keypair for this app.
 *
 * Rebuilt on top of the generic idb.ts (the old version depended on a
 * bespoke `../idb` module with its own openDB()/loadKeypair()/
 * saveKeypair() surface — that module is gone; this one talks to
 * idb.ts's declarative IdbDatabase.open()/get()/set() directly).
 *
 * On first call, generates a keypair and stores it in IndexedDB.
 * Subsequent calls (this session or a later one) return the cached/
 * persisted keypair. Secret keys aren't natively structured-clone-safe
 * across every environment, so they're stored hex-encoded and decoded
 * back into a Uint8Array on read.
 *
 * Importing a key (parseSecretKey + saveSecretKey) replaces the stored
 * one. The running NostrClient keeps using the key it was created with —
 * the app has to be reloaded for the new key to take effect.
 */

import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { decode, nsecEncode } from 'nostr-tools/nip19';
import { IdbDatabase } from '../idb';

const DB_NAME = 'app-identity';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const KEYPAIR_KEY = 'nostr-keypair';

interface StoredKeypair {
  /** Secret key, hex-encoded. */
  sk: string;
  /** Public key, hex (as returned by nostr-tools' getPublicKey). */
  pk: string;
}

let cached: { sk: Uint8Array; pk: string } | null = null;
let dbPromise: Promise<IdbDatabase> | null = null;

function getDb(): Promise<IdbDatabase> {
  if (!dbPromise) {
    dbPromise = IdbDatabase.open({
      name: DB_NAME,
      version: DB_VERSION,
      stores: [{ name: STORE_NAME }], // out-of-line key (KEYPAIR_KEY, passed explicitly)
    });
  }
  return dbPromise;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Get the app's Nostr keypair. Loads from IndexedDB if available,
 * otherwise generates and persists a new one. Cached in memory after
 * the first call within a session.
 */
export async function getKeypair(): Promise<{ sk: Uint8Array; pk: string }> {
  if (cached) return cached;

  const db = await getDb();
  const stored = await db.get<StoredKeypair>(STORE_NAME, KEYPAIR_KEY);

  if (stored) {
    cached = { sk: fromHex(stored.sk), pk: stored.pk };
    return cached;
  }

  // First run — generate and persist.
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  await db.set<StoredKeypair>(STORE_NAME, { sk: toHex(sk), pk }, KEYPAIR_KEY);

  cached = { sk, pk };
  return cached;
}

/** Reads a secret key from what a person pastes: an `nsec…` or 64 hex characters. Null if it is neither. */
export function parseSecretKey(input: string): Uint8Array | null {
  const value = input.trim();

  if (/^[0-9a-fA-F]{64}$/.test(value)) return fromHex(value.toLowerCase());

  try {
    const decoded = decode(value);
    return decoded.type === 'nsec' ? decoded.data : null;
  } catch {
    return null;
  }
}

/** Replaces the stored keypair with the one for `sk`. */
export async function saveSecretKey(sk: Uint8Array): Promise<void> {
  const db = await getDb();
  const pk = getPublicKey(sk);
  await db.set<StoredKeypair>(STORE_NAME, { sk: toHex(sk), pk }, KEYPAIR_KEY);
  cached = { sk, pk };
}

/** The current secret key as `nsec…`, for backing it up. */
export async function exportNsec(): Promise<string> {
  const { sk } = await getKeypair();
  return nsecEncode(sk);
}
