/**
 * Shared Form Utilities
 * Form validation and record creation for the pin drop UI.
 */

import { LINK_PATTERNS } from '../types';

/**
 * Generic record interface for form operations
 */
export interface FormRecord {
  mapid: string;
  timestamp: string;
  title: string;
  text: string;
  link: string;
  longitude: string;
  latitude: string;
  category: string;
  height: number;
}

/**
 * Create an empty record with the specified category
 */
export function createEmptyRecord(category: string): FormRecord {
  return {
    mapid: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    title: '',
    text: '',
    link: '',
    longitude: '',
    latitude: '',
    category: category,
    height: 0,
  };
}

/**
 * Validate a record based on its category
 */
export function recordIsValid(rec: FormRecord): boolean {
  const isTitleValid = rec.title.trim() !== '';
  const linkPattern = LINK_PATTERNS[rec.category as keyof typeof LINK_PATTERNS];
  const isLinkValid = linkPattern.test(rec.link.trim());
  
  return isTitleValid && isLinkValid;
}
