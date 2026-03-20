import { writable } from 'svelte/store';

const STORAGE_KEY = 'missionProgress:v1';

type MissionProgressState = {
  mission2FirstOpened: boolean;
  mission3FirstOpened: boolean;
};

const defaultState: MissionProgressState = {
  mission2FirstOpened: false,
  mission3FirstOpened: false,
};

function loadInitial(): MissionProgressState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<MissionProgressState>;
    return {
      mission2FirstOpened: Boolean(parsed.mission2FirstOpened),
      mission3FirstOpened: Boolean(parsed.mission3FirstOpened),
    };
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
        current.mission2FirstOpened ? current : { ...current, mission2FirstOpened: true },
      );
    },
    recordMission3FirstOpened(): void {
      state.update((current) =>
        current.mission3FirstOpened ? current : { ...current, mission3FirstOpened: true },
      );
    },
  };
}

export const missionProgress = createMissionProgress();
