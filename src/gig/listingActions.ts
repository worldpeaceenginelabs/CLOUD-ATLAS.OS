/**
 * Shared listing actions (e.g. take-down) used by HelpoutDetail and SocialDetail.
 */

import type { Listing } from '../types';
import { getSharedNostr } from '../services/nostrPool';

/**
 * Take down a listing by publishing a replacement event with a 1-second TTL.
 * Works for any listing vertical by passing the appropriate tag prefix.
 */
export async function takeDownListing(
  listing: Listing,
  tagPrefix: string,
  onTakenDown?: (listingId: string) => void,
  onClose?: () => void,
): Promise<void> {
  const nostr = await getSharedNostr();

  const expiration = String(Math.floor(Date.now() / 1000) + 1);
  const tags: string[][] = [
    ['t', tagPrefix],
    ['expiration', expiration],
  ];
  if (listing.geohash) tags.push(['g', listing.geohash]);

  nostr.publishReplaceable(listing.id, tags, JSON.stringify(listing));

  onTakenDown?.(listing.id);
  onClose?.();
}
