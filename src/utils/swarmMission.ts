import type { SwarmMissionLane, SwarmMissionState } from '../types';

export function createEmptySwarmMissionState(): SwarmMissionState {
  return {
    links: { brainstorming: '', meetanddo: '', petition: '', crowdfunding: '' },
  };
}
