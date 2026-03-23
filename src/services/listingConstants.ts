/**
 * Shared constants for listing feeds (geohash and global).
 * Single source for time windows, timeouts, and page size.
 */

/** Maximum age for listings we render/keep (7 days). */
export const LISTING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Same window in seconds (for Nostr since/until). */
export const LISTING_MAX_AGE_SECS = 7 * 24 * 60 * 60;

/** Swarm mission unified listings (14 days). */
export const SWARM_MISSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export const SWARM_MISSION_MAX_AGE_SECS = 14 * 24 * 60 * 60;

/** Page size for global feed requests. */
export const PAGE_SIZE = 50;

/** Geohash layer in-memory cache TTL (30 min). */
export const LAYER_CACHE_TTL_MS = 30 * 60 * 1000;

/** Interval between global feed (map) refetches (30 min). */
export const GLOBAL_FEED_INTERVAL_MS = 30 * 60 * 1000;
