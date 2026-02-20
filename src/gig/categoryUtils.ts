/**
 * Shared category lookup helpers.
 */

import type { ListingCategory } from '../types';

/** Find a category name by id; falls back to the raw id. */
export function getCategoryName(
  categories: ListingCategory[],
  id: string,
): string {
  return categories.find((c) => c.id === id)?.name ?? id;
}
