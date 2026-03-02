/**
 * Shared listing actions (e.g. take-down) used by ListingDetail.
 *
 * Take-down publishes a replaceable event with t=DELETE and expiration set to
 * the leftover time since the listing was published (so it expires when the
 * original would have). No #g or #c; who deleted = event.pubkey.
 */

import type { Listing } from '../types';
import { getSharedNostr } from '../services/nostrPool';

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

  nostr.publishReplaceable(listing.id, tags, '');

  onTakenDown?.(listing.id);
  onClose?.();
}
