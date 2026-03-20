import { writable } from 'svelte/store';

const STORAGE_KEY = 'missionProgress:v1';

type MissionProgressState = {
  mission2FirstOpened: boolean;
};

const defaultState: MissionProgressState = {
  mission2FirstOpened: false,
};

function loadInitial(): MissionProgressState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<MissionProgressState>;
    return { mission2FirstOpened: Boolean(parsed.mission2FirstOpened) };
  } catch {
    return defaultState;
  }
}

function createMissionProgress() {
  const state = writable<MissionProgressState>(loadInitial());

  if (typeof window !== 'undefined') {
    state.subscribe((value) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        // Ignore persistence failures.
      }
    });
  }

  return {
    subscribe: state.subscribe,
    recordMission2FirstOpened(): void {
      state.update((current) =>
        current.mission2FirstOpened ? current : { mission2FirstOpened: true },
      );
    },
  };
}

export const missionProgress = createMissionProgress();
