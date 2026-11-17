/**
 * formatExpiry.ts — Human-readable expiry of a listing or mission, shared by
 * every view that shows one: the absolute date plus how long is left, e.g.
 * "Dec 3, 2026, 4:30 PM · in 4 days".
 */

function remaining(secsLeft: number): string {
  if (secsLeft <= 0) return 'expired';

  const minutes = Math.round(secsLeft / 60);
  if (minutes < 60) return `in ${Math.max(1, minutes)} min`;

  const hours = Math.round(secsLeft / 3600);
  if (hours < 48) return `in ${hours} h`;

  return `in ${Math.round(secsLeft / 86400)} days`;
}

/** `expiresAt` is unix seconds (the event's NIP-40 `expiration`). */
export function formatExpiry(expiresAt: number, nowMs: number = Date.now()): string {
  const date = new Date(expiresAt * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return `${date} · ${remaining(expiresAt - Math.floor(nowMs / 1000))}`;
}
