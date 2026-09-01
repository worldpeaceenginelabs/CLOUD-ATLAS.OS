/**
 * geohash.ts — Generic geospatial cell-indexing utility.
 *
 * Pure math: encode a lat/lon pair into a geohash string, decode it back
 * to a center point + cell size, and compute neighboring/expanded cell
 * sets around a given cell. No knowledge of Nostr, listings, LIVE/LISTING,
 * or any other application concept lives here — this is the same kind of
 * generic infrastructure as idb.ts or store.ts, just for geospatial
 * bucketing instead of persistence or reactivity.
 *
 * Precision reference (approximate cell size):
 *   4 → ~20 km × 20 km       5 → ~5 km × 5 km
 *   6 → ~1.2 km × 0.6 km
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode a lat/lon pair into a geohash string.
 * @param latitude  – WGS-84 latitude  (−90 … 90)
 * @param longitude – WGS-84 longitude (−180 … 180)
 * @param precision – number of characters (default 6)
 */
export function encode(latitude: number, longitude: number, precision = 6): string {
  let latRange: [number, number] = [-90, 90];
  let lonRange: [number, number] = [-180, 180];
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLon = true; // longitude first

  while (hash.length < precision) {
    const range = isLon ? lonRange : latRange;
    const val = isLon ? longitude : latitude;
    const mid = (range[0] + range[1]) / 2;

    if (val >= mid) {
      ch |= 1 << (4 - bit);
      range[0] = mid;
    } else {
      range[1] = mid;
    }

    if (bit < 4) {
      bit++;
    } else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
    isLon = !isLon;
  }
  return hash;
}

export interface GeohashDecode {
  lat: number;
  lon: number;
  latDelta: number;
  lonDelta: number;
}

/** Decode a geohash to its center lat/lon and cell size (deltas). Useful for computing neighbor cells. */
export function decode(geohash: string): GeohashDecode {
  let latRange: [number, number] = [-90, 90];
  let lonRange: [number, number] = [-180, 180];
  let isLon = true;

  for (const ch of geohash) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) continue;
    for (let bit = 4; bit >= 0; bit--) {
      const range = isLon ? lonRange : latRange;
      const mid = (range[0] + range[1]) / 2;
      if (idx & (1 << bit)) range[0] = mid;
      else range[1] = mid;
      isLon = !isLon;
    }
  }

  const lat = (latRange[0] + latRange[1]) / 2;
  const lon = (lonRange[0] + lonRange[1]) / 2;
  const latDelta = latRange[1] - latRange[0];
  const lonDelta = lonRange[1] - lonRange[0];
  return { lat, lon, latDelta, lonDelta };
}

/** Direction offsets (dLat, dLon) in cell units. N=+lat, E=+lon. */
const NEIGHBOR_OFFSETS: [number, number][] = [
  [1, 0],   // N
  [1, 1],   // NE
  [0, 1],   // E
  [-1, 1],  // SE
  [-1, 0],  // S
  [-1, -1], // SW
  [0, -1],  // W
  [1, -1],  // NW
];

function wrapLon(lon: number): number {
  if (lon > 180) return lon - 360;
  if (lon < -180) return lon + 360;
  return lon;
}

/** Return the 8 neighboring cells at the same precision as the input. */
export function neighbors(geohash: string): string[] {
  const precision = geohash.length;
  const { lat, lon, latDelta, lonDelta } = decode(geohash);
  const out: string[] = [];
  for (const [dLat, dLon] of NEIGHBOR_OFFSETS) {
    const latN = Math.max(-90, Math.min(90, lat + dLat * latDelta));
    const lonN = wrapLon(lon + dLon * lonDelta);
    out.push(encode(latN, lonN, precision));
  }
  return out;
}

/** Center cell plus its 8 neighbors: a 3×3 block (9 cells) at the input's precision. */
export function cells3x3(geohash: string): string[] {
  const prec = geohash.length;
  const list = [geohash, ...neighbors(geohash)];
  return [...new Set(list)].filter((h) => h.length === prec);
}

/** A 4×4 block of cells (16 cells) around the given cell, same precision as the input. */
export function cells4x4(geohash: string): string[] {
  const prec = geohash.length;
  const { lat, lon, latDelta, lonDelta } = decode(geohash);
  const set = new Set<string>();
  for (let dLat = -2; dLat <= 1; dLat++) {
    for (let dLon = -2; dLon <= 1; dLon++) {
      const latN = Math.max(-90, Math.min(90, lat + dLat * latDelta));
      const lonN = wrapLon(lon + dLon * lonDelta);
      set.add(encode(latN, lonN, prec));
    }
  }
  return [...set];
}

/**
 * All cells that share the same one-character-shorter (coarser) prefix as
 * the input — the entire parent region (32 cells). Input should be at
 * least 2 characters long.
 */
export function cellsInParent(geohash: string): string[] {
  const parent = geohash.slice(0, -1);
  return BASE32.split('').map((c) => parent + c);
}