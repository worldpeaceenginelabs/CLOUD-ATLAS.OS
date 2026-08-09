/**
 * Nominatim Geocoding Service
 * Wraps OpenStreetMap's Nominatim API for forward geocoding, reverse geocoding,
 * and autocomplete suggestions. Respects the 1 req/sec usage policy.
 */

const BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'CloudAtlasOS/1.0';

export interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  boundingbox: [string, string, string, string];
  type: string;
  importance: number;
}

export interface BoundingBox {
  west: number;
  north: number;
  east: number;
  south: number;
}

// Rate limiter: max 1 request per second per Nominatim usage policy
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1100;

async function throttledFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
}

// Simple LRU cache
const cache = new Map<string, { data: NominatimResult[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 100;

function getCached(key: string): NominatimResult[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: NominatimResult[]) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Forward geocoding: address/place name -> coordinates
 */
export async function search(query: string, limit = 5): Promise<NominatimResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `search:${trimmed}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      q: trimmed,
      format: 'json',
      addressdetails: '1',
      limit: String(limit),
    });
    const response = await throttledFetch(`${BASE_URL}/search?${params}`);
    if (!response.ok) return [];
    const results: NominatimResult[] = await response.json();
    setCache(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

/**
 * Reverse geocoding: coordinates -> human-readable address
 */
export async function reverse(lat: number, lon: number): Promise<NominatimResult | null> {
  const cacheKey = `reverse:${lat.toFixed(6)}:${lon.toFixed(6)}`;
  const cached = getCached(cacheKey);
  if (cached && cached.length > 0) return cached[0];

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'json',
      addressdetails: '1',
    });
    const response = await throttledFetch(`${BASE_URL}/reverse?${params}`);
    if (!response.ok) return null;
    const result: NominatimResult = await response.json();
    if (result && result.place_id) {
      setCache(cacheKey, [result]);
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Autocomplete: partial query -> suggestions, optionally biased to a viewbox.
 * Caller should debounce this at ~300-500ms.
 */
export async function autocomplete(
  query: string,
  viewbox?: BoundingBox,
  limit = 5,
): Promise<NominatimResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const vbKey = viewbox ? `${viewbox.west},${viewbox.north},${viewbox.east},${viewbox.south}` : '';
  const cacheKey = `auto:${trimmed}:${limit}:${vbKey}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      q: trimmed,
      format: 'json',
      addressdetails: '1',
      limit: String(limit),
    });
    if (viewbox) {
      params.set('viewbox', `${viewbox.west},${viewbox.north},${viewbox.east},${viewbox.south}`);
      params.set('bounded', '0');
    }
    const response = await throttledFetch(`${BASE_URL}/search?${params}`);
    if (!response.ok) return [];
    const results: NominatimResult[] = await response.json();
    setCache(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

/**
 * Format a NominatimResult into a short, readable label.
 * Prefers structured address parts over the full display_name.
 */
export function formatShortAddress(result: NominatimResult): string {
  const a = result.address;
  if (!a) return result.display_name;

  const parts: string[] = [];
  if (a.house_number && a.road) {
    parts.push(`${a.road} ${a.house_number}`);
  } else if (a.road) {
    parts.push(a.road);
  }
  const locality = a.city || a.town || a.village;
  if (locality) parts.push(locality);
  if (a.country) parts.push(a.country);

  return parts.length > 0 ? parts.join(', ') : result.display_name;
}
