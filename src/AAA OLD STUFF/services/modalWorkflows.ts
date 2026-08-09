import { get } from 'svelte/store';
import { hideModal, showModal, upsertModal } from '../utils/modalManager';
import type { SwarmMissionCardPayload } from '../types';
import type { NostrService } from './nostrService';
import { listingToMissionCardPayload } from './listingFeedHelpers';
import { missionCardPayloadToListing, publishSwarmMission } from './listingService';
import { takeDownListing } from '../gig/listingActions';
import { bumpLayerRefresh } from '../store';
import type { ListingVerticalConfig } from '../gig/verticals';
import { missionProgress } from '../utils/missionProgress';

export function openMission2Workflow(
  opts?: { seed?: SwarmMissionCardPayload | null; skipWelcomeStack?: boolean },
): void {
  const first = !get(missionProgress).mission2FirstOpened;
  if (first && !opts?.skipWelcomeStack) showModal('swarm-governance');
  const data =
    opts !== undefined ? { seed: opts.seed === undefined ? undefined : opts.seed } : undefined;
  upsertModal('mission-2', data);
  missionProgress.recordMission2FirstOpened();
}

export function openOmnipediaEditorWorkflow(): void {
  missionProgress.recordMission3FirstOpened();
  showModal('omnipedia-editor');
}

export async function publishMission2Workflow(
  nostr: NostrService,
  data: SwarmMissionCardPayload,
): Promise<SwarmMissionCardPayload | null> {
  const listing = await publishSwarmMission(nostr, data);
  bumpLayerRefresh('swarmmission');
  return listingToMissionCardPayload(listing);
}

export async function takeDownMission2Workflow(
  nostr: NostrService,
  mission: SwarmMissionCardPayload | null,
  missionId: string,
  swarmCfg: ListingVerticalConfig,
): Promise<void> {
  if (!mission || mission.id !== missionId) return;
  const listing = missionCardPayloadToListing(mission, nostr.pubkey);
  await takeDownListing(
    listing,
    swarmCfg.listingTag,
    () => bumpLayerRefresh('swarmmission'),
    () => hideModal('mission-2'),
    nostr,
  );
}
