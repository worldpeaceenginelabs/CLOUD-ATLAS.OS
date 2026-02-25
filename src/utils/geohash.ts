/**
 * Geohash Utility
 * Encodes latitude/longitude to geohash strings for spatial bucketing.
 * Used by the Gig Economy feature for cell-based peer discovery.
 *
 * Precision 6 ≈ 1.2 km × 0.6 km cells.
 * Precision 5 (G5) ≈ 4–5 km × 4–5 km.
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

/**
 * Decode a geohash to center lat/lon and cell size (deltas).
 * Useful for computing neighbor cells.
 */
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

const PRECISION_G6 = 6;

/** Direction offsets (dy, dx) for lat, lon. N=+lat, E=+lon. */
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

/**
 * Return the 8 neighboring G6 cells (same precision as the input).
 */
export function neighbors(geohash: string): string[] {
  const precision = geohash.length;
  const { lat, lon, latDelta, lonDelta } = decode(geohash);
  const out: string[] = [];
  for (const [dy, dx] of NEIGHBOR_OFFSETS) {
    const latN = Math.max(-90, Math.min(90, lat + dy * latDelta));
    const lonN = lon + dx * lonDelta;
    const lonWrapped = lonN <= 180 ? (lonN >= -180 ? lonN : lonN + 360) : lonN - 360;
    out.push(encode(latN, lonWrapped, precision));
  }
  return out;
}

/**
 * Center cell plus 8 neighbors: 9 G6 cells (~3×3, ~9 km²).
 */
export function cells3x3(geohash: string): string[] {
  const prec = geohash.length;
  const list = [geohash, ...neighbors(geohash)];
  return [...new Set(list)].filter((h) => h.length === prec);
}

/**
 * 16 G6 cells in a 4×4 block around the given cell (~16 km²).
 * Uses neighbor steps: from center go up to 2 steps N/S and E/W.
 */
export function cells4x4(geohash: string): string[] {
  const prec = geohash.length;
  const { lat, lon, latDelta, lonDelta } = decode(geohash);
  const set = new Set<string>();
  for (let dy = -2; dy <= 1; dy++) {
    for (let dx = -2; dx <= 1; dx++) {
      const latN = Math.max(-90, Math.min(90, lat + dy * latDelta));
      const lonN = lon + dx * lonDelta;
      const lonWrapped = lonN <= 180 ? (lonN >= -180 ? lonN : lonN + 360) : lonN - 360;
      set.add(encode(latN, lonWrapped, prec));
    }
  }
  return [...set];
}

/**
 * All 32 G6 cells that share the same G5 prefix (~25 km²).
 * Input should be at least length 5 (G5); typically pass a G6 geohash.
 */
export function cellsInG5(geohash: string): string[] {
  const parent = geohash.slice(0, 5);
  return BASE32.split('').map((c) => parent + c);
}

