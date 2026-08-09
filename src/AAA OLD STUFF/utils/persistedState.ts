import type { Readable } from 'svelte/store';

export function loadPersistedState<T>(
  key: string,
  fallback: T,
  sanitize: (parsed: unknown) => T,
): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return sanitize(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

export function persistStoreState<T>(store: Readable<T>, key: string): void {
  if (typeof window === 'undefined') return;
  store.subscribe((value) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore persistence failures.
    }
  });
}
