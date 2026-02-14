/**
 * Shared Form Utilities
 * Consolidates duplicate form validation and record creation functions across components
 */

import type { PinData } from '../types';
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
  [key: string]: any; // For Trystero compatibility
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

/**
 * Convert FormRecord to PinData for compatibility
 */
export function formRecordToPinData(record: FormRecord): PinData {
  return {
    mapid: record.mapid,
    timestamp: record.timestamp,
    title: record.title,
    text: record.text,
    link: record.link,
    longitude: record.longitude,
    latitude: record.latitude,
    category: record.category as any,
    height: record.height,
  };
}
