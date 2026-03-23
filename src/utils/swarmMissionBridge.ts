/**
 * Swarm mission: Listing JSON ↔ MissionCard payload, parse normalization, map participation filters.
 */

import type { Listing, SwarmMissionLane, SwarmMissionState } from '../types';
import { getCurrentTimeIso8601 } from './timeUtils';
import { encode as geohashEncode } from './geohash';
import { GEOHASH_PRECISION_LISTING } from '../gig/constants';
import type { NostrService } from '../services/nostrService';
import { ListingService } from '../services/listingService';
import { SWARM_MISSION_MAX_AGE_SECS } from '../services/listingConstants';
import { VERTICALS, type ListingVerticalConfig } from '../gig/verticals';

/** Same shape as MissionCard.svelte `MissionCardData` (kept here to avoid circular imports). */
export interface MissionCardPayload {
  id: string;
  authorPubkey: string;
  title: string;
  description: string;
  address?: string;
  locationLat?: string;
  locationLon?: string;
  timestamp?: string;
  swarm: SwarmMissionState;
}

export function emptySwarmMissionState(): SwarmMissionState {
  return {
    links: { brainstorming: '', meetanddo: '', petition: '', crowdfunding: '' },
    success: { brainstorming: false, petition: false, crowdfunding: false },
  };
}

export function normalizeSwarmListing(listing: Listing): void {
  if (listing.vertical !== 'swarmmission') return;
  const base = emptySwarmMissionState();
  const raw = listing.swarm;
  if (raw && typeof raw === 'object') {
    const lanes: SwarmMissionLane[] = ['brainstorming', 'meetanddo', 'petition', 'crowdfunding'];
    for (const lane of lanes) {
      const v = raw.links?.[lane];
      base.links[lane] = typeof v === 'string' ? v.trim() : '';
    }
    base.success.brainstorming = !!raw.success?.brainstorming;
    base.success.petition = !!raw.success?.petition;
    base.success.crowdfunding = !!raw.success?.crowdfunding;
  }
  if (!base.links.brainstorming.trim() && listing.contact?.trim()) {
    base.links.brainstorming = listing.contact.trim();
  }
  listing.swarm = base;
  listing.contact = base.links.brainstorming;
  listing.vertical = 'swarmmission';
}

export function laneOpenForParticipation(swarm: SwarmMissionState, lane: SwarmMissionLane): boolean {
  const link = swarm.links[lane]?.trim();
  if (!link) return false;
  if (lane === 'meetanddo') return true;
  if (lane === 'brainstorming') return !swarm.success.brainstorming;
  if (lane === 'petition') return !swarm.success.petition;
  return !swarm.success.crowdfunding;
}

export function missionPassesSwarmFilters(listing: Listing, filters: Set<SwarmMissionLane>): boolean {
  if (listing.vertical !== 'swarmmission' || filters.size === 0) return true;
  const swarm = listing.swarm;
  if (!swarm) return false;
  for (const lane of filters) {
    if (laneOpenForParticipation(swarm, lane)) return true;
  }
  return false;
}

export function listingToMissionCardPayload(listing: Listing): MissionCardPayload | null {
  if (listing.vertical !== 'swarmmission') return null;
  normalizeSwarmListing(listing);
  const swarm = listing.swarm!;
  return {
    id: listing.id,
    authorPubkey: listing.pubkey,
    title: listing.title ?? '',
    description: listing.description,
    address: listing.address,
    locationLat: listing.location != null ? String(listing.location.latitude) : '',
    locationLon: listing.location != null ? String(listing.location.longitude) : '',
    timestamp: listing.timestamp,
    swarm: {
      links: { ...swarm.links },
      success: { ...swarm.success },
    },
  };
}

/** Publish or update swarm mission (replaceable). Caller should bump layerRefresh for `swarmmission`. */
export async function publishSwarmMissionToRelays(
  nostr: NostrService,
  data: MissionCardPayload,
): Promise<Listing> {
  const cfg = VERTICALS.swarmmission as ListingVerticalConfig;
  const listing = missionCardPayloadToListing(data, nostr.pubkey);
  const svc = new ListingService(
    nostr,
    cfg.listingTag,
    { onRelayStatus: () => {} },
    SWARM_MISSION_MAX_AGE_SECS,
  );
  try {
    await svc.publishListing(listing);
    return listing;
  } finally {
    svc.stop();
  }
}

export function missionCardPayloadToListing(data: MissionCardPayload, authorPubkey: string): Listing {
  const lat = data.locationLat?.trim() ? parseFloat(data.locationLat) : NaN;
  const lon = data.locationLon?.trim() ? parseFloat(data.locationLon) : NaN;
  const hasLoc = Number.isFinite(lat) && Number.isFinite(lon);
  const location = hasLoc ? { latitude: lat, longitude: lon } : undefined;
  const geohash =
    location != null
      ? geohashEncode(location.latitude, location.longitude, GEOHASH_PRECISION_LISTING)
      : undefined;

  const swarm: SwarmMissionState = {
    links: {
      brainstorming: data.swarm.links.brainstorming.trim(),
      meetanddo: data.swarm.links.meetanddo.trim(),
      petition: data.swarm.links.petition.trim(),
      crowdfunding: data.swarm.links.crowdfunding.trim(),
    },
    success: { ...data.swarm.success },
  };

  const timestamp =
    data.timestamp?.trim() && data.timestamp.trim().length > 0 ? data.timestamp.trim() : getCurrentTimeIso8601();

  return {
    id: data.id,
    pubkey: authorPubkey,
    mode: 'both',
    category: '',
    title: data.title.trim(),
    description: data.description.trim(),
    contact: swarm.links.brainstorming,
    location,
    address: data.address?.trim() || undefined,
    timestamp,
    geohash,
    vertical: 'swarmmission',
    swarm,
  };
}
