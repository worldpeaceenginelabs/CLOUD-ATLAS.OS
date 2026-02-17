/**
 * Nostr Connection Pool
 *
 * Shared NostrService singleton used by all gig economy services.
 * Connected lazily on first call, stays alive for the session.
 */

import { NostrService } from './nostrService';
import { getKeypair } from './keyManager';

let instance: NostrService | null = null;

/**
 * Get the shared NostrService instance.
 * Creates and connects on first call; returns cached instance thereafter.
 */
export async function getSharedNostr(): Promise<NostrService> {
  if (instance) return instance;

  const { sk } = await getKeypair();
  instance = new NostrService(sk);
  instance.connectInBackground();
  return instance;
}
