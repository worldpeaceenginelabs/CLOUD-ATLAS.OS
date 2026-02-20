/**
 * URL utility functions shared across the app.
 */

const PROTOCOL_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

/** Prepend https:// if the URL lacks a protocol. */
export function ensureProtocol(url: string): string {
  if (PROTOCOL_RE.test(url)) return url;
  return 'https://' + url;
}

/** Format lat/lon for display with configurable precision. */
export function formatLatLon(lat: number, lon: number, precision = 5): string {
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
}
