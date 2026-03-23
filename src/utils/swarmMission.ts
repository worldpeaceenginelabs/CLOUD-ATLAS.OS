import type { SwarmMissionLane, SwarmMissionState } from '../types';

export function createEmptySwarmMissionState(): SwarmMissionState {
  return {
    links: { brainstorming: '', meetanddo: '', petition: '', crowdfunding: '' },
    success: { brainstorming: false, petition: false, crowdfunding: false },
  };
}

export function isSwarmLaneOpenForParticipation(
  swarm: SwarmMissionState,
  lane: SwarmMissionLane,
): boolean {
  const link = swarm.links[lane]?.trim();
  if (!link) return false;
  if (lane === 'meetanddo') return true;
  if (lane === 'brainstorming') return !swarm.success.brainstorming;
  if (lane === 'petition') return !swarm.success.petition;
  return !swarm.success.crowdfunding;
}

export function isSwarmLaneSuccessVisible(
  swarm: SwarmMissionState,
  lane: SwarmMissionLane,
): boolean {
  if (lane === 'brainstorming') return swarm.success.brainstorming;
  if (lane === 'petition') return swarm.success.petition;
  if (lane === 'crowdfunding') return swarm.success.crowdfunding;
  return false;
}
