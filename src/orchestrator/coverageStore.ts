/**
 * coverageStore.ts — Persists the per-segment coverage (see coverage.ts) in
 * localStorage, the same place the mission sync keeps its cursors. Small by
 * construction: a few intervals per segment, pruned to the listing lifetime
 * on every load and save.
 */

import { pruneBefore, type Interval } from './coverage';

const KEY = 'cloudatlas.listingCoverage';

export type CoverageBySegment = Record<string, Interval[]>;

function isInterval(v: unknown): v is Interval {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number'
  );
}

export function loadCoverage(horizon: number): CoverageBySegment {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null');

    if (!parsed || typeof parsed !== 'object') return {};

    const out: CoverageBySegment = {};

    for (const [segment, list] of Object.entries(parsed)) {
      if (!Array.isArray(list)) continue;

      const pruned = pruneBefore(list.filter(isInterval), horizon);

      if (pruned.length > 0) out[segment] = pruned;
    }

    return out;
  } catch {
    return {};
  }
}

export function saveCoverage(coverage: CoverageBySegment, horizon: number): void {
  try {
    const out: CoverageBySegment = {};

    for (const [segment, list] of Object.entries(coverage)) {
      const pruned = pruneBefore(list, horizon);

      if (pruned.length > 0) out[segment] = pruned;
    }

    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {}
}
