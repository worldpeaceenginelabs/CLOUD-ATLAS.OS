/**
 * Shared constants for the gig economy layer.
 */

/** Geohash precision for matching (rider ↔ driver, ~1.2 km × 0.6 km cell). */
export const GEOHASH_PRECISION_MATCHING = 6;

/** Geohash precision for listing markers (helpouts / social, ~20 km × 20 km cell). */
export const GEOHASH_PRECISION_LISTING = 4;

/** NIP-40 expiration: seconds from now until matching events expire on relays. */
export const REQUEST_TTL_SECS = 60;

/** Expand radius when list is still empty (0 providers / 0 requests) after this many seconds. */
export const EXPAND_WHEN_EMPTY_SECS = 15;

/** Expand radius when still no match (no accept / not chosen as winner) after this many seconds. */
export const EXPAND_WHEN_NO_MATCH_SECS = 30;
