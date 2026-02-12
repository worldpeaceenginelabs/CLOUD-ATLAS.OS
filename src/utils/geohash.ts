/**
 * Geohash Utility
 * Encodes latitude/longitude to geohash strings for spatial bucketing.
 * Used by the Gig Economy feature for cell-based peer discovery.
 *
 * Precision 6 ≈ 1.2 km × 0.6 km cells.
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

/**
 * Decode a geohash into its bounding box.
 * Returns { minLat, maxLat, minLon, maxLon }.
 */
export function decodeBbox(hash: string): {
  minLat: number; maxLat: number;
  minLon: number; maxLon: number;
} {
  let latRange: [number, number] = [-90, 90];
  let lonRange: [number, number] = [-180, 180];
  let isLon = true;

  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    if (idx === -1) continue;
    for (let bit = 4; bit >= 0; bit--) {
      const range = isLon ? lonRange : latRange;
      const mid = (range[0] + range[1]) / 2;
      if (idx & (1 << bit)) {
        range[0] = mid;
      } else {
        range[1] = mid;
      }
      isLon = !isLon;
    }
  }

  return {
    minLat: latRange[0], maxLat: latRange[1],
    minLon: lonRange[0], maxLon: lonRange[1],
  };
}

/**
 * Decode a geohash to its center point { latitude, longitude }.
 */
export function decode(hash: string): { latitude: number; longitude: number } {
  const { minLat, maxLat, minLon, maxLon } = decodeBbox(hash);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
  };
}
