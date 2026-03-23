/**
 * Listing layers bootstrap: Ion key persistence, loading listings from IDB/Nostr,
 * and layer refresh. Runs on app start; LayersMenu shows state and calls these APIs on toggle.
 * activeMapLayers starts with global feed map verticals on (store init); only user toggles change it.
 */

import { get, writable } from 'svelte/store';
import { idb } from '../idb';
import { getSharedNostr } from './nostrPool';
import { GeohashListingFeed } from './geohashListingFeed';
import { runGlobalFeedMap } from './globalListingFeed';
import {
  activeMapLayers,
  layerListings,
  setLayerListings,
  layerRefresh,
  userIonAccessToken,
  userLiveLocation,
  enable3DTileset,
} from '../store';
import { encode as geohashEncode } from '../utils/geohash';
import {
  LISTING_VERTICALS,
  VERTICALS,
  GLOBAL_FEED_MAP_VERTICALS,
  type ListingVerticalConfig,
} from '../gig/verticals';
import type { Listing, ListingVertical } from '../types';
import { LAYER_CACHE_TTL_MS, GLOBAL_FEED_INTERVAL_MS } from './listingConstants';
import { trimListingsByVerticalAge } from './listingFeedHelpers';

function isGlobalVertical(v: ListingVertical): boolean {
  return (VERTICALS[v] as ListingVerticalConfig).fetchStrategy === 'global';
}

/** Apply global feed (map) result to layerListings: only update verticals still active; clear the rest. */
function applyGlobalFeedMapToLayerListings(
  listingsWithLocation: Listing[] | null,
  stillActive: Set<string>
): (all: Record<string, Listing[]>) => Record<string, Listing[]> {
  return (all) => {
    const next = { ...all };
    for (const v of GLOBAL_FEED_MAP_VERTICALS) {
      next[v] = stillActive.has(v)
        ? (listingsWithLocation ? listingsWithLocation.filter((l) => l.vertical === v) : all[v])
        : [];
    }
    return next;
  };
}

// ─── UI state (menu reads these) ─────────────────────────────

export const layerLoading = writable<Record<string, boolean>>({});
export const layerError = writable('');
export const ionKeyInput = writable('');
export const ionKeySaved = writable(false);

// ─── Internal state ─────────────────────────────────────────

const layerServices: Record<string, GeohashListingFeed | null> = {};
const layerCaches: Record<string, { listings: Listing[]; cachedAt: number }> = {};
const layerLoadingState: Record<string, boolean> = {};
let globalFeedTimeoutId: ReturnType<typeof setTimeout> | null = null;
let globalFeedFetchInFlight = false;
let lastRefreshSnapshot: Record<string, number> = {};

function setLayerError(message: string): void {
  layerError.set(message);
}

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

// ─── Global feed (map) ───────────────────────────────────────

export async function runGlobalFeedFetch(): Promise<void> {
  if (globalFeedFetchInFlight) return;
  globalFeedFetchInFlight = true;
  try {
    const currentActiveLayers = get(activeMapLayers);
    try {
      await idb.openDB();
      const cached = await idb.loadListingCache('global:map');
      if (cached) {
        const withLocation = trimListingsByVerticalAge(cached.listings).filter((l) => l.location);
        layerListings.update(applyGlobalFeedMapToLayerListings(withLocation, currentActiveLayers));
      }
    } catch {
      /* proceed to relay */
    }

    const nostr = await getSharedNostr();
    const active = GLOBAL_FEED_MAP_VERTICALS.filter((v) => currentActiveLayers.has(v));
    if (active.length === 0) {
      layerListings.update(applyGlobalFeedMapToLayerListings(null, currentActiveLayers));
    } else {
      const listings = await runGlobalFeedMap(nostr, active);
      const withLocation = listings.filter((l) => l.location);
      layerListings.update(applyGlobalFeedMapToLayerListings(withLocation, currentActiveLayers));
    }
  } catch {
    /* nostr unavailable or run failed */
  } finally {
    globalFeedFetchInFlight = false;
    globalFeedTimeoutId = setTimeout(runGlobalFeedFetch, GLOBAL_FEED_INTERVAL_MS);
  }
}

// ─── Geohash layer fetch ────────────────────────────────────

async function ensureLayerService(tag: string): Promise<GeohashListingFeed | null> {
  try {
    const nostr = await getSharedNostr();
    return new GeohashListingFeed(nostr, tag);
  } catch {
    setLayerError('Storage unavailable');
    return null;
  }
}

export async function fetchLayer(verticalId: ListingVertical, forceRefresh = false): Promise<void> {
  if (isGlobalVertical(verticalId)) return;
  if (layerLoadingState[verticalId]) return;
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
    const listings = await layerServices[verticalId]!.fetchListings(cell, forceRefresh, verticalId);
    if (!get(activeMapLayers).has(verticalId)) return;
    const filtered = listings.filter((l) => l.location);
    layerCaches[verticalId] = { listings: filtered, cachedAt: Date.now() };
    setLayerListings(verticalId, filtered);
  } finally {
    layerLoadingState[verticalId] = false;
    layerLoading.update((m) => ({ ...m, [verticalId]: false }));
  }
}

// ─── Toggle layer (called by menu) ────────────────────────────

export async function toggleLayer(verticalId: ListingVertical): Promise<void> {
  setLayerError('');
  const layers = new Set(get(activeMapLayers));
  const wasOn = layers.has(verticalId);

  if (wasOn) {
    layers.delete(verticalId);
    activeMapLayers.set(layers);
    setLayerListings(verticalId, []);
    return;
  }

  layers.add(verticalId);
  activeMapLayers.set(layers);

  if (isGlobalVertical(verticalId)) {
    runGlobalFeedFetch();
    return;
  }

  const cache = layerCaches[verticalId];
  if (cache && cache.listings.length > 0 && Date.now() - cache.cachedAt < LAYER_CACHE_TTL_MS) {
    setLayerListings(verticalId, cache.listings);
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
    setLayerError('Failed to save API key');
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
