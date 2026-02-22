import { writable, type Writable } from 'svelte/store';
import type { Coordinates, ModelData, GigVertical, Listing } from './types';

// ─── Store registry ──────────────────────────────────────────
type ResetFn = () => void;
const registry: ResetFn[] = [];

function resettable<T>(initial: T): Writable<T> {
  const s = writable(initial);
  registry.push(() => s.set(typeof initial === 'object' && initial !== null
    ? structuredClone(initial)
    : initial));
  return s;
}

export function resetAllStores() {
  for (const reset of registry) reset();
}

// ─── UI State ────────────────────────────────────────────────
export const showPicture = resettable(true);
export const gridReady = resettable(false);
export const isVisible = resettable(false);
export const isEditorOpen = resettable(false);

// ─── 3D Scene State ──────────────────────────────────────────
export const cesiumReady = resettable(false);
export const viewer = resettable<any>(null);
export const currentHeight = resettable(0);
export const is3DTilesetActive = resettable(false);
export const isBasemapLoaded = resettable(false);
export const isTilesetLoaded = resettable(false);
export const enable3DTileset = resettable(false);
/** User-provided Cesium Ion access token (overrides the env default) */
export const userIonAccessToken = resettable('');

// ─── Progress ────────────────────────────────────────────────
export const basemapProgress = resettable(0);
export const tilesetProgress = resettable(0);
export const isInitialLoadComplete = resettable(false);

// ─── Data ────────────────────────────────────────────────────
export const coordinates: Writable<Coordinates> = resettable<Coordinates>({
  latitude: '',
  longitude: '',
  height: 0,
});
export const models: Writable<ModelData[]> = resettable<ModelData[]>([]);

// ─── Roaming State ───────────────────────────────────────────
export const isRoamingAreaMode = resettable(false);
export const roamingAreaBounds = resettable<{
  north: number; south: number; east: number; west: number;
} | null>(null);
/** Increment to signal Cesium to start roaming area painting */
export const roamingPaintSignal = resettable(0);
/** Increment to signal Cesium to cancel roaming area painting */
export const roamingCancelSignal = resettable(0);
/** Increment to signal Cesium to clear roaming area visuals */
export const roamingClearSignal = resettable(0);
/** Whether the roaming animation loop is currently active */
export const isRoamingActive = resettable(false);
/** Number of models currently in the roaming system */
export const roamingModelCount = resettable(0);

// ─── Preview Model State ─────────────────────────────────────
export const previewModel = resettable<ModelData | null>(null);
export const isPreviewMode = resettable(false);
export const editingModelId = resettable<string | null>(null);

// ─── Temporary Model State ───────────────────────────────────
export const temporaryModelId = resettable<string | null>(null);

// ─── User Live GPS Location ──────────────────────────────────
export const userLiveLocation = resettable<{ latitude: number; longitude: number } | null>(null);

// ─── Gig Economy ─────────────────────────────────────────────
export const userGigRole = resettable<'requester' | 'provider' | null>(null);
export const currentGeohash = resettable('');
/** Whether the gig economy panel can be closed via the X button */
export const gigCanClose = resettable(true);
/** Pre-selected vertical from the radial menu (auto-navigated on panel open) */
export const preselectedGigVertical = resettable<GigVertical | null>(null);
/** Signal Cesium to reopen the radial gig menu (set by back buttons) */
export const showRadialGigMenu = resettable(false);

// ─── Fly-to ──────────────────────────────────────────────────
export const flyToLocation = resettable<{ lat: number; lon: number } | null>(null);

// ─── Map Layers ──────────────────────────────────────────────
/** Set of currently active map layer IDs (e.g. 'helpouts', 'brainstorming') */
export const activeMapLayers = resettable<Set<string>>(new Set());
/** Per-vertical refresh counter — increment a key to force-refresh that layer */
export const layerRefresh = resettable<Record<string, number>>({});
/** Per-vertical listings to render on the map (written by LayersMenu, read by Cesium) */
export const layerListings = resettable<Record<string, Listing[]>>({});
