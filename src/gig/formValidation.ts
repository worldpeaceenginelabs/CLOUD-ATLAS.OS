/**
 * Shared form validation helpers for gig need/offer forms.
 */

import type { GigFormField } from './verticals';

/** Returns true when a single field's value is valid (empty counts as valid). */
export function fieldValid(field: GigFormField, value: string): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  if (field.pattern) return new RegExp(field.pattern).test(trimmed);
  return true;
}

/** Extract unique group names from a set of fields. */
export function getGroups(fields: GigFormField[]): string[] {
  return [...new Set(fields.map((f) => f.group).filter((g): g is string => !!g))];
}

/** True when every group has at least one filled, valid field. */
export function groupsSatisfied(
  fields: GigFormField[],
  fieldValues: Record<string, string>,
): boolean {
  const groups = getGroups(fields);
  return groups.every((g) => {
    const gf = fields.filter((f) => f.group === g);
    return gf.some((f) => {
      const val = fieldValues[f.key]?.trim();
      return val && fieldValid(f, val);
    });
  });
}

/** True when every non-empty field passes its pattern check. */
export function allPatternsValid(
  fields: GigFormField[],
  fieldValues: Record<string, string>,
): boolean {
  return fields.every((f) => fieldValid(f, fieldValues[f.key]));
}
