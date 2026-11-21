/**
 * coverage.ts — Which stretches of time have been loaded completely for a
 * search segment, and therefore which stretches are still GAPS.
 *
 * A segment is one question asked of the relays (model + categories +
 * area). A search loads the newest page; the result only vouches for the
 * time between its oldest event and the moment it asked. Everything older
 * is unknown until a further page proves otherwise. Pure integer-interval
 * math, no I/O: persistence lives in coverageStore.ts.
 *
 * All times are unix seconds; an interval [from, to] includes both ends.
 */

import type { PageRun } from './pagedQuery';

export type Interval = [number, number];

/** A stretch of time nobody has loaded completely: [lo, hi], both inclusive. */
export interface Gap {
  lo: number;
  hi: number;
}

/** Merges `[from, to]` into a sorted list of disjoint, non-adjacent intervals. */
export function addInterval(list: Interval[], from: number, to: number): Interval[] {
  if (from > to) return list;

  const all = [...list, [from, to] as Interval].sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];

  for (const [f, t] of all) {
    const last = merged[merged.length - 1];

    if (last && f <= last[1] + 1) {
      last[1] = Math.max(last[1], t);
    } else {
      merged.push([f, t]);
    }
  }

  return merged;
}

export function unionIntervals(a: Interval[], b: Interval[]): Interval[] {
  return b.reduce((acc, [f, t]) => addInterval(acc, f, t), a);
}

/** Drops what lies entirely before `horizon` and clips the rest to it — a listing older than that is expired anyway. */
export function pruneBefore(list: Interval[], horizon: number): Interval[] {
  return list
    .filter(([, t]) => t >= horizon)
    .map(([f, t]) => [Math.max(f, horizon), t] as Interval);
}

/**
 * The gaps inside the time the segment has been loaded for at all, newest
 * first: between two loaded stretches, and below the oldest one down to the
 * horizon. Nothing is a gap before the first load (there is nothing to
 * compare to) or above the newest load (nothing newer is known to exist).
 */
export function findGaps(list: Interval[], horizon: number): Gap[] {
  if (list.length === 0) return [];

  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  const gaps: Gap[] = [];

  if (sorted[0][0] > horizon) {
    gaps.push({ lo: horizon, hi: sorted[0][0] - 1 });
  }

  for (let i = 0; i + 1 < sorted.length; i++) {
    const lo = sorted[i][1] + 1;
    const hi = sorted[i + 1][0] - 1;

    if (lo <= hi) gaps.push({ lo: Math.max(lo, horizon), hi });
  }

  return gaps.sort((a, b) => b.hi - a.hi);
}

/**
 * What one relay's page run vouches for: the span from `from` up to `to`
 * has been delivered completely. Null if the relay did not answer fully.
 *
 * A run that stopped with events vouches down to its oldest event only —
 * the relay might hold more (its per-request cap is unknown). Only a run
 * that came back empty ("exhausted") vouches all the way down to `since`.
 */
export function claimFromRun(
  run: PageRun,
  since: number,
  until: number | undefined,
  fetchedAt: number,
): Interval | null {
  if (!run.complete) return null;

  const to = until ?? fetchedAt;
  const from = run.exhausted ? since : run.oldest;

  if (from === null || from > to) return null;

  return [from, to];
}

/**
 * Combines the claims of all relays that answered: the shallowest one
 * decides, so the result never promises more than every answering relay
 * delivered. Null if no relay answered fully.
 */
export function combineClaims(claims: (Interval | null)[]): Interval | null {
  const real = claims.filter((c): c is Interval => c !== null);

  if (real.length === 0) return null;

  const from = Math.max(...real.map((c) => c[0]));
  const to = Math.min(...real.map((c) => c[1]));

  return from <= to ? [from, to] : null;
}
