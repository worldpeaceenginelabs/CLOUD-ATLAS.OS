/**
 * Shared Time Utilities
 * Consolidates duplicate time formatting functions across components
 */

/**
 * Get current time formatted as HH:MM:SS
 */
export function getCurrentTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

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
