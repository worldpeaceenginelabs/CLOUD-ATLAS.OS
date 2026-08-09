/**
 * Shared Time Utilities
 * Consolidates duplicate time formatting functions across components
 */

/**
 * Get current time in ISO 8601 format
 */
export function getCurrentTimeIso8601(): string {
  const now = new Date();
  return now.toISOString();
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}
