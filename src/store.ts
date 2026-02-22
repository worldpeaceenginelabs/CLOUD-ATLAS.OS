import { writable, type Writable } from 'svelte/store';
import type { Coordinates, ModelData, GigVertical, Listing } from './types';

export type { Coordinates, ModelData };

// UI State Stores
export const showPicture = writable(true);
export const gridReady = writable(false);
export const isVisible = writable(false);
export const isEditorOpen = writable(false);

// Modal State Stores - now handled by modalManager

// 3D Scene State Stores
export const cesiumReady = writable(false);
export const viewer = writable<any>(null);
export const currentHeight = writable(0);
export const is3DTilesetActive = writable(false);
export const isBasemapLoaded = writable(false);
export const isTilesetLoaded = writable(false);
export const enable3DTileset: Writable<boolean> = writable(false);
/** User-provided Cesium Ion access token (overrides the env default) */
export const userIonAccessToken: Writable<string> = writable('');

// Progress Stores
export const basemapProgress = writable(0);
export const tilesetProgress = writable(0);
export const isInitialLoadComplete = writable(false);

export const coordinates: Writable<Coordinates> = writable({
  latitude: '',
  longitude: '',
  height: 0
});

export const models: Writable<ModelData[]> = writable([]);

// selectedModel moved to modalManager

// Roaming state
export const isRoamingAreaMode: Writable<boolean> = writable(false);
export const roamingAreaBounds: Writable<{
  north: number;
  south: number;
  east: number;
  west: number;
} | null> = writable(null);
/** Increment to signal Cesium to start roaming area painting */
export const roamingPaintSignal: Writable<number> = writable(0);
/** Increment to signal Cesium to cancel roaming area painting */
export const roamingCancelSignal: Writable<number> = writable(0);
/** Increment to signal Cesium to clear roaming area visuals */
export const roamingClearSignal: Writable<number> = writable(0);

// Preview Model State
export const previewModel: Writable<ModelData | null> = writable(null);
export const isPreviewMode: Writable<boolean> = writable(false);
export const editingModelId: Writable<string | null> = writable(null);

// Temporary Model State
export const temporaryModelId: Writable<string | null> = writable(null);

// User Live GPS Location (updated via watchPosition)
export const userLiveLocation: Writable<{ latitude: number; longitude: number } | null> = writable(null);

// Gig Economy Stores
export const userGigRole: Writable<'requester' | 'provider' | null> = writable(null);
export const currentGeohash: Writable<string> = writable('');
/** Whether the gig economy panel can be closed via the X button */
export const gigCanClose: Writable<boolean> = writable(true);
/** Pre-selected vertical from the radial menu (auto-navigated on panel open) */
export const preselectedGigVertical: Writable<GigVertical | null> = writable(null);
/** Signal Cesium to reopen the radial gig menu (set by back buttons) */
export const showRadialGigMenu: Writable<boolean> = writable(false);

// Fly-to store: set to trigger Cesium camera fly to a location (e.g. from address search)
export const flyToLocation: Writable<{ lat: number; lon: number } | null> = writable(null);

// Map Layer Stores
/** Set of currently active map layer IDs (e.g. 'helpouts') */
export const activeMapLayers: Writable<Set<string>> = writable(new Set());
/** Increment to trigger a force-refresh of the helpouts map layer */
export const helpoutLayerRefresh: Writable<number> = writable(0);
/** Increment to trigger a force-refresh of the social map layer */
export const socialLayerRefresh: Writable<number> = writable(0);
/** Current helpout listings to render on the map (written by AddButton, read by Cesium) */
export const helpoutLayerListings: Writable<Listing[]> = writable([]);
/** Current social listings to render on the map (written by AddButton, read by Cesium) */
export const socialLayerListings: Writable<Listing[]> = writable([]);

// Store cleanup functions
export function resetAllStores() {
  // UI State
  showPicture.set(true);
  gridReady.set(false);
  isVisible.set(false);
  isEditorOpen.set(false);
  
  // Modal State - now handled by modalManager
  
  // 3D Scene State
  cesiumReady.set(false);
  viewer.set(null);
  currentHeight.set(0);
  is3DTilesetActive.set(false);
  isBasemapLoaded.set(false);
  isTilesetLoaded.set(false);
  
  // Progress State
  basemapProgress.set(0);
  tilesetProgress.set(0);
  isInitialLoadComplete.set(false);
  
  // Data State
  coordinates.set({
    latitude: '',
    longitude: '',
    height: 0
  });
  models.set([]);
  
  // Roaming state
  isRoamingAreaMode.set(false);
  roamingAreaBounds.set(null);
  roamingPaintSignal.set(0);
  roamingCancelSignal.set(0);
  roamingClearSignal.set(0);
  
  // Preview state
  previewModel.set(null);
  isPreviewMode.set(false);
  editingModelId.set(null);
  
  // Temporary model state
  temporaryModelId.set(null);
  
  // Live location
  userLiveLocation.set(null);
  
  // Gig Economy state
  userGigRole.set(null);
  currentGeohash.set('');
  gigCanClose.set(true);
  preselectedGigVertical.set(null);
  showRadialGigMenu.set(false);
  
  // Fly-to
  flyToLocation.set(null);
  
  // Map Layers
  activeMapLayers.set(new Set());
  helpoutLayerRefresh.set(0);
  socialLayerRefresh.set(0);
  helpoutLayerListings.set([]);
  socialLayerListings.set([]);
  
}
