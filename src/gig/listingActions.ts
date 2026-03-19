/**
 * Shared listing actions (e.g. take-down) used by ListingDetail.
 *
 * Take-down publishes a replaceable event with t=DELETE and expiration set to
 * the leftover time since the listing was published (so it expires when the
 * original would have). No #g or #c; who deleted = event.pubkey.
 */

import type { Listing } from '../types';
import { getSharedNostr } from '../services/nostrPool';
import { publishVerifiedReplaceable } from '../services/relayOrchestrator';
import { logger } from '../utils/logger';

const LISTING_TTL_SECS = 7 * 24 * 60 * 60;

/**
 * Take down a listing by publishing a replaceable event with t=DELETE and
 * expiration = leftover from publish (listing.timestamp + 7 days).
 */
export async function takeDownListing(
  listing: Listing,
  _tagPrefix: string,
  onTakenDown?: (listingId: string) => void,
  onClose?: () => void,
): Promise<void> {
  const nostr = await getSharedNostr();

  const publishedAt = Math.floor(new Date(listing.timestamp).getTime() / 1000);
  const expiration = String(publishedAt + LISTING_TTL_SECS);
  const tags: string[][] = [
    ['t', 'DELETE'],
    ['expiration', expiration],
  ];

  const result = await publishVerifiedReplaceable(nostr, {
    dTag: listing.id,
    extraTags: tags,
    content: '',
    verifyTTags: ['DELETE'],
    minRelaysAfterSettle: 1,
    retries: 2,
    onMetrics: (meta) => {
      logger.info(
        `relay-metrics publish delete status=${meta.status} outcome=${meta.outcome} verified=${meta.verified} connected=${meta.connectedAtStart} eose=${meta.eoseReceived} retries=${meta.retriesUsed} timedOut=${meta.timedOut}`,
        { component: 'listingActions', operation: 'takeDownListing' },
      );
    },
  });

  if (result.outcome !== 'verified_synced' && result.outcome !== 'verified_partial') {
    throw new Error('Delete publish verification failed');
  }

  onTakenDown?.(listing.id);
  onClose?.();
}
