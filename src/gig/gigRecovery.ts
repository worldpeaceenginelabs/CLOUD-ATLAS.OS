/**
 * Gig session recovery: check relays for any active matching session.
 */

import { getSharedNostr } from '../services/nostrPool';
import { REPLACEABLE_KIND, RELAY_LABEL } from '../services/nostrService';
import { REQUEST_TTL_SECS } from './constants';
import { VERTICALS } from './verticals';

const MATCHING_TAGS: string[] = Object.values(VERTICALS)
  .filter(v => v.mode === 'matching')
  .flatMap(v => [`need-${v.id}`, `offer-${v.id}`]);

/**
 * Returns true if the current user has an active matching session
 * (a need/offer event published within the last REQUEST_TTL_SECS).
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
        '#L': [RELAY_LABEL],
        '#t': MATCHING_TAGS,
        since: Math.floor(Date.now() / 1000) - REQUEST_TTL_SECS,
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
