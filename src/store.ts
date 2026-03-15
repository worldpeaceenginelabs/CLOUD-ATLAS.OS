import { writable, type Writable } from 'svelte/store';
import type { Coordinates, ModelData, SceneData, LatLon, GigVertical, Listing } from './types';
import { GLOBAL_FEED_MAP_VERTICALS } from './gig/verticals';

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

// ─── Roaming Area Painting State ─────────────────────────────
export const isRoamingAreaMode = resettable(false);
export const roamingAreaBounds = resettable<{
  north: number; south: number; east: number; west: number;
} | null>(null);
export const roamingPaintSignal = resettable(0);
export const roamingCancelSignal = resettable(0);
export const roamingClearSignal = resettable(0);

// ─── Path Drawing State ──────────────────────────────────────
export const isPathDrawingMode = resettable(false);
export const pathWaypoints = resettable<LatLon[]>([]);
/** Increment to signal Cesium to enter path-drawing mode */
export const pathPaintSignal = resettable(0);
/** Increment to signal Cesium to cancel path drawing */
export const pathCancelSignal = resettable(0);
/** Increment to signal Cesium to clear path visuals */
export const pathClearSignal = resettable(0);

// ─── Simulation State ────────────────────────────────────────
export const isSimulationRunning = resettable(false);
export const simulationSpeed = resettable(1.0);
/** Number of entities in the simulation system (models + herd members) */
export const simulationEntityCount = resettable(0);

// ─── Scene State ─────────────────────────────────────────────
export const scenes: Writable<SceneData[]> = resettable<SceneData[]>([]);

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
export type LocationOptions = {
  openRadial?: boolean;
  radialOrigin?: 'picked-point' | 'user-location';
  /** Whether to update the coordinates store (defaults to true). */
  updateCoordinates?: boolean;
  /** Whether to create/move the green picked-point marker (defaults to true). */
  createPickedMarker?: boolean;
};

export type FlyToLocationPayload = {
  lat: number;
  lon: number;
  options?: LocationOptions;
};

export const flyToLocation = resettable<FlyToLocationPayload | null>(null);

// ─── Map Layers ──────────────────────────────────────────────
/** Set of currently active map layer IDs (e.g. 'helpouts', 'brainstorming'). Starts with SG verticals on, helpouts/social off. */
export const activeMapLayers = resettable<Set<string>>(new Set(GLOBAL_FEED_MAP_VERTICALS));
/** Per-vertical refresh counter — increment a key to force-refresh that layer */
export const layerRefresh = resettable<Record<string, number>>({});
/** Per-vertical listings to render on the map (written by LayersMenu, read by Cesium) */
export const layerListings = resettable<Record<string, Listing[]>>({});

// Remember where the gig radial menu was opened from (user location vs picked point)
export const gigRadialOrigin = resettable<'user-location' | 'picked-point' | null>(null);

/** Remove listings that match deletedSet (entries are 'id:pubkey'). Used after applying DELETEs from relay. */
export function applyDeletionsToLayerListings(deletedSet: Set<string>): void {
  if (deletedSet.size === 0) return;
  layerListings.update((all) => {
    const next: Record<string, Listing[]> = {};
    for (const k of Object.keys(all)) {
      next[k] = all[k].filter((l) => !deletedSet.has(`${l.id}:${l.pubkey}`));
    }
    return next;
  });
}

// ─── Online Listings ─────────────────────────────────────────
/** Whether the online listings panel is open */
export const onlinePanelOpen = resettable(false);
