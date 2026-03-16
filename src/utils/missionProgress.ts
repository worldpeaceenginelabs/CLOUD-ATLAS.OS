import { writable } from 'svelte/store';

type MissionProgress = {
  missionsSeen: boolean;
  missionDetailSeen: boolean;
};

const STORAGE_KEY = 'missionProgress:v1';

const defaultValue: MissionProgress = {
  missionsSeen: false,
  missionDetailSeen: false,
};

function loadInitialValue(): MissionProgress {
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultValue;

  try {
    const parsed = JSON.parse(raw) as Partial<MissionProgress>;
    return {
      missionsSeen: !!parsed.missionsSeen,
      missionDetailSeen: !!parsed.missionDetailSeen,
    };
  } catch {
    return defaultValue;
  }
}

function createMissionProgress() {
  const { subscribe, update, set } = writable<MissionProgress>(loadInitialValue());

  if (typeof window !== 'undefined') {
    subscribe((value) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        // ignore storage errors
      }
    });
  }

  return {
    subscribe,
    markMissionsSeen: () =>
      update((v) => ({
        ...v,
        missionsSeen: true,
      })),
    markMissionDetailSeen: () =>
      update((v) => ({
        ...v,
        missionsSeen: true,
        missionDetailSeen: true,
      })),
    reset: () => set(defaultValue),
  };
}

export const missionProgress = createMissionProgress();

