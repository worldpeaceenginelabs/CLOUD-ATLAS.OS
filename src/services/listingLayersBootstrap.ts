/**
 * Listing layers bootstrap: Ion key persistence, loading listings from IDB/Nostr,
 * and layer refresh. Runs on app start; LayersMenu shows state and calls these APIs on toggle.
 * activeMapLayers starts with SG verticals on (store init); only user toggles change it.
 */

import { get, writable } from 'svelte/store';
import { idb } from '../idb';
import { getSharedNostr } from './nostrPool';
import { ListingLayerService } from './listingLayerService';
import { SwarmGovernanceListingService } from './swarmGovernanceListingService';
import {
  activeMapLayers,
  layerListings,
  layerRefresh,
  userIonAccessToken,
  userLiveLocation,
  enable3DTileset,
} from '../store';
import { encode as geohashEncode } from '../utils/geohash';
import {
  LISTING_VERTICALS,
  VERTICALS,
  SWARM_GOVERNANCE_VERTICALS,
  type ListingVerticalConfig,
} from '../gig/verticals';
import type { Listing, ListingVertical } from '../types';

const CACHE_TTL_MS = 30 * 60 * 1000;
const GLOBAL_FEED_INTERVAL_MS = 30 * 60 * 1000;
const LISTING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isGlobalVertical(v: ListingVertical): boolean {
  return (VERTICALS[v] as ListingVerticalConfig).fetchStrategy === 'global';
}

// ─── UI state (menu reads these) ─────────────────────────────

export const layerLoading = writable<Record<string, boolean>>({});
export const layerError = writable('');
export const ionKeyInput = writable('');
export const ionKeySaved = writable(false);

// ─── Internal state ─────────────────────────────────────────

const layerServices: Record<string, ListingLayerService | null> = {};
const layerCaches: Record<string, { listings: Listing[]; cachedAt: number }> = {};
const layerLoadingState: Record<string, boolean> = {};
let globalFeedTimeoutId: ReturnType<typeof setTimeout> | null = null;
let globalFeedFetchInFlight = false;
let lastRefreshSnapshot: Record<string, number> = {};

// ─── Ion key load ───────────────────────────────────────────

export async function loadIonKey(): Promise<void> {
  try {
    await idb.openDB();
    const stored = await idb.loadSetting('ionAccessToken');
    if (stored) {
      ionKeyInput.set(stored);
      userIonAccessToken.set(stored);
      ionKeySaved.set(true);
    }
  } catch {
    /* ignore */
  }
}

// ─── Global swarm feed ──────────────────────────────────────

export async function runGlobalFeedFetch(): Promise<void> {
  if (globalFeedFetchInFlight) return;
  globalFeedFetchInFlight = true;
  try {
    try {
      await idb.openDB();
      const cached = await idb.loadSwarmGovernanceCache();
      if (cached) {
        const cutoff = Date.now() - LISTING_MAX_AGE_MS;
        const withLocation = cached.listings.filter((l) => {
          if (!l.location) return false;
          const t = new Date(l.timestamp).getTime();
          return Number.isFinite(t) && t > cutoff;
        });
        layerListings.update((all) => {
          const next = { ...all };
          for (const v of SWARM_GOVERNANCE_VERTICALS) {
            next[v] = withLocation.filter((l) => l.vertical === v);
          }
          return next;
        });
      }
    } catch {
      /* proceed to relay */
    }

    const nostr = await getSharedNostr();
    const svc = new SwarmGovernanceListingService(nostr);
    const active = SWARM_GOVERNANCE_VERTICALS.filter((v) => get(activeMapLayers).has(v));
    if (active.length === 0) {
      layerListings.update((all) => {
        const next = { ...all };
        for (const v of SWARM_GOVERNANCE_VERTICALS) next[v] = [];
        return next;
      });
    } else {
      const listings = await svc.run(active);
      const withLocation = listings.filter((l) => l.location);
      layerListings.update((all) => {
        const next = { ...all };
        for (const v of SWARM_GOVERNANCE_VERTICALS) {
          next[v] = withLocation.filter((l) => l.vertical === v);
        }
        return next;
      });
    }
  } catch {
    /* nostr unavailable or run failed */
  } finally {
    globalFeedFetchInFlight = false;
    globalFeedTimeoutId = setTimeout(runGlobalFeedFetch, GLOBAL_FEED_INTERVAL_MS);
  }
}

// ─── Geohash layer fetch ────────────────────────────────────

async function ensureLayerService(tag: string): Promise<ListingLayerService | null> {
  try {
    const nostr = await getSharedNostr();
    return new ListingLayerService(nostr, tag);
  } catch {
    layerError.set('Storage unavailable');
    return null;
  }
}

export async function fetchLayer(verticalId: ListingVertical, forceRefresh = false): Promise<void> {
  if (isGlobalVertical(verticalId)) return;
  const cfg = VERTICALS[verticalId] as ListingVerticalConfig;
  const loc = get(userLiveLocation);
  if (!loc) return;

  if (!layerServices[verticalId]) {
    layerServices[verticalId] = await ensureLayerService(cfg.listingTag);
    if (!layerServices[verticalId]) return;
  }

  layerLoadingState[verticalId] = true;
  layerLoading.update((m) => ({ ...m, [verticalId]: true }));

  try {
    const cell = geohashEncode(loc.latitude, loc.longitude, 4);
    const listings = await layerServices[verticalId]!.fetchListings(cell, forceRefresh);
    const filtered = listings.filter((l) => l.location);
    layerCaches[verticalId] = { listings: filtered, cachedAt: Date.now() };
    layerListings.update((all) => ({ ...all, [verticalId]: filtered }));
  } finally {
    layerLoadingState[verticalId] = false;
    layerLoading.update((m) => ({ ...m, [verticalId]: false }));
  }
}

// ─── Toggle layer (called by menu) ────────────────────────────

export async function toggleLayer(verticalId: ListingVertical): Promise<void> {
  layerError.set('');
  const layers = new Set(get(activeMapLayers));
  const wasOn = layers.has(verticalId);

  if (wasOn) {
    layers.delete(verticalId);
    activeMapLayers.set(layers);
    layerListings.update((all) => ({ ...all, [verticalId]: [] }));
    return;
  }

  layers.add(verticalId);
  activeMapLayers.set(layers);

  if (isGlobalVertical(verticalId)) {
    runGlobalFeedFetch();
    return;
  }

  const cache = layerCaches[verticalId];
  if (cache && cache.listings.length > 0 && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    layerListings.update((all) => ({ ...all, [verticalId]: cache.listings }));
  }
  await fetchLayer(verticalId);
}

// ─── Ion key (called by menu) ─────────────────────────────────

export async function saveIonKey(value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) return;
  try {
    await idb.openDB();
    await idb.saveSetting('ionAccessToken', trimmed);
    userIonAccessToken.set(trimmed);
    ionKeySaved.set(true);
  } catch {
    layerError.set('Failed to save API key');
  }
}

export async function clearIonKey(): Promise<void> {
  ionKeyInput.set('');
  ionKeySaved.set(false);
  try {
    await idb.openDB();
    await idb.saveSetting('ionAccessToken', '');
    userIonAccessToken.set('');
    enable3DTileset.set(false);
  } catch {
    /* ignore */
  }
}

// ─── Layer refresh watch (react to layerRefresh store) ────────

function startLayerRefreshWatch(): void {
  layerRefresh.subscribe((current) => {
    let needGlobalFetch = false;
    for (const v of LISTING_VERTICALS) {
      const cur = current[v] ?? 0;
      const last = lastRefreshSnapshot[v] ?? 0;
      if (cur !== last && get(activeMapLayers).has(v)) {
        if (isGlobalVertical(v)) needGlobalFetch = true;
        else if (layerServices[v]) fetchLayer(v, true);
      }
    }
    if (needGlobalFetch) runGlobalFeedFetch();
    lastRefreshSnapshot = { ...current };
  });
}

// ─── App start ──────────────────────────────────────────────

export async function initListingLayers(): Promise<void> {
  await loadIonKey();
  await runGlobalFeedFetch();
  startLayerRefreshWatch();
}
