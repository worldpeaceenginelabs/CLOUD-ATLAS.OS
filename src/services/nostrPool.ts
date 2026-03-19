/**
 * Nostr Connection Pool
 *
 * Shared NostrService singleton used by all gig economy services.
 * Connected lazily on first call, stays alive for the session.
 */

import { NostrService } from './nostrService';
import { getKeypair } from './keyManager';

let instance: NostrService | null = null;
let instancePromise: Promise<NostrService> | null = null;

/**
 * Get the shared NostrService instance.
 * Creates and connects on first call; returns cached instance thereafter.
 */
export async function getSharedNostr(): Promise<NostrService> {
  if (instance) return instance;
  if (instancePromise) return instancePromise;

  instancePromise = (async () => {
    try {
      const { sk } = await getKeypair();
      const created = new NostrService(sk);
      created.connectInBackground();
      instance = created;
      return created;
    } finally {
      // Keep singleton in `instance`; clear in-flight lock for future attempts.
      instancePromise = null;
    }
  })();

  return instancePromise;
}
