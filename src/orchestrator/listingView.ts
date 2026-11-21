/**
 * listingView.ts — Turns cached listing records and the gaps of the current
 * search segment into the rows the list component renders. Pure.
 */

import type { ListingRecord, ListingViewRow } from './appStore';
import type { Gap } from './coverage';
import { categoryLabel, type InteractionMode } from '../hexmenu/domains';

/** The category ids a listing/search payload carries — `categoryIds` (multi-select models) or the single `categoryId`. Empty if it carries none. */
export function categoryIdsOf(content: Record<string, any>): string[] {
  if (Array.isArray(content.categoryIds) && content.categoryIds.length) {
    return content.categoryIds.filter(
      (id: unknown): id is string => typeof id === 'string' && id.length > 0,
    );
  }

  if (typeof content.categoryId === 'string' && content.categoryId) {
    return [content.categoryId];
  }

  return [];
}

function toRow(record: ListingRecord): ListingViewRow {
  const title = typeof record.content.title === 'string' ? record.content.title : '';

  return {
    type: 'listing',
    id: record.id,
    title,
    category: categoryIdsOf(record.content)
      .map((id) => categoryLabel(record.model, id))
      .join(', '),
    expiresAt: record.expiresAt,
    interactionMode: record.content.interactionMode as InteractionMode,
  };
}

/**
 * Newest first. A gap's bar sits above the first listing published inside
 * or below the gap, i.e. between "loaded" and "not necessarily loaded".
 */
export function buildListingRows(records: ListingRecord[], gaps: Gap[]): ListingViewRow[] {
  const sorted = [...records].sort(
    (a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id),
  );
  const orderedGaps = [...gaps].sort((a, b) => b.hi - a.hi);
  const rows: ListingViewRow[] = [];
  let next = 0;

  for (const gap of orderedGaps) {
    while (next < sorted.length && sorted[next].createdAt > gap.hi) {
      rows.push(toRow(sorted[next++]));
    }

    rows.push({ type: 'gap', key: `${gap.lo}-${gap.hi}`, lo: gap.lo, hi: gap.hi });
  }

  while (next < sorted.length) {
    rows.push(toRow(sorted[next++]));
  }

  return rows;
}
