/**
 * Gig session recovery: check relays for any active gig session.
 */

import { getSharedNostr } from '../services/nostrPool';
import { REPLACEABLE_KIND } from '../services/nostrService';

/**
 * Returns true if the current user has an active gig session
 * (a replaceable event published within the last 120 seconds).
 */
export async function hasActiveGigSession(): Promise<boolean> {
  const nostr = await getSharedNostr();
  const subId = `gig-recovery-${Date.now()}`;

  return new Promise((resolve) => {
    let found = false;
    nostr.subscribe(
      subId,
      {
        kinds: [REPLACEABLE_KIND],
        authors: [nostr.pubkey],
        since: Math.floor(Date.now() / 1000) - 120,
      },
      () => {
        if (!found) {
          found = true;
          resolve(true);
        }
      },
      () => {
        nostr.unsubscribe(subId);
        if (!found) resolve(false);
      },
    );
  });
}
