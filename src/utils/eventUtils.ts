/**
 * Shared Event Handler Utilities
 * Consolidates common event handling patterns across components
 */

/**
 * Handle escape key press
 */
export function handleEscapeKey(event: KeyboardEvent, callback: () => void): void {
  if (event.key === 'Escape') {
    callback();
  }
}

/**
 * Handle enter or space key press
 */
export function handleEnterOrSpaceKey(event: KeyboardEvent, callback: () => void): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback();
  }
}

/**
 * Handle click with optional callback
 */
export function handleClick(event: Event, callback?: () => void): void {
  event.stopPropagation();
  if (callback) {
    callback();
  }
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeout!);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
