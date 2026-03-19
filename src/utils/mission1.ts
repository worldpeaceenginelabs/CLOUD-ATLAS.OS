import { derived, get, readable, writable } from 'svelte/store';

export type Mission1Status = 'ready' | 'locked' | 'completed';

type Mission1State = {
  stars: number;
  lastStarAt: number | null;
};

type Mission1View = {
  stars: number;
  status: Mission1Status;
  remainingMs: number;
  countdownLabel: string;
  countdownActive: boolean;
};

const STORAGE_KEY = 'mission1:v1';
const ONE_DAY_MS = 24* 60 * 60 * 1000;

const defaultState: Mission1State = {
  stars: 0,
  lastStarAt: null,
};

function clampStars(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(3, Math.floor(value)));
}

function loadInitialState(): Mission1State {
  if (typeof window === 'undefined') return defaultState;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<Mission1State>;
    const stars = clampStars(parsed.stars);
    const lastStarAt = typeof parsed.lastStarAt === 'number' ? parsed.lastStarAt : null;
    return { stars, lastStarAt };
  } catch {
    return defaultState;
  }
}

const now = readable<number>(Date.now(), (set) => {
  if (typeof window === 'undefined') return () => {};
  const id = window.setInterval(() => set(Date.now()), 1000);
  return () => window.clearInterval(id);
});

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  if (ms <= 60_000) {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  }
  const totalMinutes = Math.floor(ms / 1000 / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

function createMission1() {
  const state = writable<Mission1State>(loadInitialState());

  if (typeof window !== 'undefined') {
    state.subscribe((value) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        // Ignore persistence failures.
      }
    });
  }

  const remainingMs = derived([state, now], ([$state, $now]) => {
    if ($state.stars >= 3 || !$state.lastStarAt) return 0;
    const elapsed = $now - $state.lastStarAt;
    return Math.max(0, ONE_DAY_MS - elapsed);
  });

  const status = derived([state, remainingMs], ([$state, $remainingMs]): Mission1Status => {
    if ($state.stars >= 3) return 'completed';
    if ($state.stars > 0 && $remainingMs > 0) return 'locked';
    return 'ready';
  });

  const view = derived([state, status, remainingMs], ([$state, $status, $remainingMs]): Mission1View => ({
    stars: $state.stars,
    status: $status,
    remainingMs: $remainingMs,
    countdownLabel: formatCountdown($remainingMs),
    countdownActive: $status === 'locked' && $remainingMs > 0,
  }));

  function earnStar(): void {
    if (get(status) !== 'ready') return;

    state.update((current) => {
      if (current.stars >= 3) return current;
      const nextStars = current.stars + 1;
      return {
        stars: nextStars,
        lastStarAt: nextStars >= 3 ? null : Date.now(),
      };
    });
  }

  function reset(): void {
    state.set(defaultState);
  }

  return {
    subscribe: view.subscribe,
    earnStar,
    reset,
  };
}

export const mission1 = createMission1();
