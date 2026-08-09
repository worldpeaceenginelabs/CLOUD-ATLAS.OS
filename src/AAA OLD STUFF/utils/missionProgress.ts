import { writable } from 'svelte/store';
import { loadPersistedState, persistStoreState } from './persistedState';

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
  return loadPersistedState(STORAGE_KEY, defaultState, (value) => {
    const parsed = value as Partial<MissionProgressState>;
    return {
      mission2FirstOpened: Boolean(parsed.mission2FirstOpened),
      mission3FirstOpened: Boolean(parsed.mission3FirstOpened),
    };
  });
}

function createMissionProgress() {
  const state = writable<MissionProgressState>(loadInitial());
  persistStoreState(state, STORAGE_KEY);

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
