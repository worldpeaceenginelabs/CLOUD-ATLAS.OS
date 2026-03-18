import { writable, derived, get } from 'svelte/store';
import { missionProgress } from './missionProgress';

type MissionShareStreakState = {
  stars: number;
  lastStarAt: number | null;
};

export type MissionShareStreakStatus =
  | 'idle'
  | 'available'
  | 'cooldown'
  | 'completed';

const STORAGE_KEY = 'mission-share-streak:v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const defaultState: MissionShareStreakState = {
  stars: 0,
  lastStarAt: null,
};

function loadInitialState(): MissionShareStreakState {
  if (typeof window === 'undefined') {
    return defaultState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<MissionShareStreakState>;

    return {
      stars: typeof parsed.stars === 'number' ? parsed.stars : 0,
      lastStarAt: typeof parsed.lastStarAt === 'number' ? parsed.lastStarAt : null,
    };
  } catch {
    return defaultState;
  }
}

function createMissionShareStreak() {
  const store = writable<MissionShareStreakState>(loadInitialState());

  if (typeof window !== 'undefined') {
    store.subscribe((state) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore storage issues
      }
    });
  }

  function canEarnNextStar(): boolean {
    const state = get(store);
    if (state.stars >= 3) return false;
    if (!state.lastStarAt) return true;
    return Date.now() - state.lastStarAt >= ONE_DAY_MS;
  }

  function earnStar(): void {
    if (!canEarnNextStar()) return;

    store.update((state) => {
      if (state.stars >= 3) {
        return state;
      }

      const now = Date.now();
      const nextStars = state.stars + 1;
      const nextState: MissionShareStreakState = {
        stars: nextStars,
        lastStarAt: now,
      };

      if (nextStars === 3) {
        missionProgress.markMissionCompleted();
      }

      return nextState;
    });
  }

  function reset(): void {
    store.set(defaultState);
  }

  return {
    subscribe: store.subscribe,
    earnStar,
    canEarnNextStar,
    reset,
  };
}

const base = createMissionShareStreak();

const status = derived(base, ($state): MissionShareStreakStatus => {
  if ($state.stars >= 3) return 'completed';
  if (!base.canEarnNextStar()) return 'cooldown';
  if ($state.stars === 0) return 'idle';
  return 'available';
});

export const missionShareStreak = {
  ...base,
  status,
};


