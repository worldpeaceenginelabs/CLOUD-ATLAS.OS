import { writable, type Writable } from 'svelte/store';
import type { Coordinates, ModelData, PinData } from './types';

export type { Coordinates, ModelData, PinData };

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

// Progress Stores
export const basemapProgress = writable(0);
export const tilesetProgress = writable(0);
export const isInitialLoadComplete = writable(false);

// Cesium Action Interface
export interface CesiumActions {
  addModelToScene: ((modelData: ModelData) => void) | null;
  removeModelFromScene: ((modelId: string) => void) | null;
  addPinToScene: ((pinData: PinData) => void) | null;
  removePinFromScene: ((mapid: string) => void) | null;
  addPreviewModelToScene: ((modelData: ModelData) => void) | null;
  removePreviewModelFromScene: (() => void) | null;
  updatePreviewModelInScene: ((modelData: ModelData) => void) | null;
  hideOriginalModel: ((modelId: string) => void) | null;
  showOriginalModel: ((modelId: string) => void) | null;
  flyTo: ((destination: any) => void) | null;
  setCamera: ((position: any) => void) | null;
}

// Cesium Actions Store
export const cesiumActions = writable<CesiumActions>({
  addModelToScene: null,
  removeModelFromScene: null,
  addPinToScene: null,
  removePinFromScene: null,
  addPreviewModelToScene: null,
  removePreviewModelFromScene: null,
  updatePreviewModelInScene: null,
  hideOriginalModel: null,
  showOriginalModel: null,
  flyTo: null,
  setCamera: null
});

export const coordinates: Writable<Coordinates> = writable({
  latitude: '',
  longitude: '',
  height: 0
});

export const models: Writable<ModelData[]> = writable([]);

// selectedModel moved to modalManager

export const pins: Writable<PinData[]> = writable([]);

export const isZoomModalVisible: Writable<boolean> = writable(false);

export const lastTriggeredModal: Writable<'zoom' | 'pick' | null> = writable(null);

// Roaming state
export const isRoamingAreaMode: Writable<boolean> = writable(false);
export const roamingAreaBounds: Writable<{
  north: number;
  south: number;
  east: number;
  west: number;
} | null> = writable(null);

// Preview Model State
export const previewModel: Writable<ModelData | null> = writable(null);
export const isPreviewMode: Writable<boolean> = writable(false);
export const editingModelId: Writable<string | null> = writable(null);

// Temporary Model State
export const temporaryModelId: Writable<string | null> = writable(null);

// User Live GPS Location (updated via watchPosition)
export const userLiveLocation: Writable<{ latitude: number; longitude: number } | null> = writable(null);

// Gig Economy Stores
export const userGigRole: Writable<'rider' | 'driver' | null> = writable(null);
export const isGigPickingDestination: Writable<boolean> = writable(false);
export const currentGeohash: Writable<string> = writable('');

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
  pins.set([]);
  isZoomModalVisible.set(false);
  lastTriggeredModal.set(null);
  
  // Roaming state
  isRoamingAreaMode.set(false);
  roamingAreaBounds.set(null);
  
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
  isGigPickingDestination.set(false);
  currentGeohash.set('');
  
  // Cesium Actions
  cesiumActions.set({
    addModelToScene: null,
    removeModelFromScene: null,
    addPinToScene: null,
    removePinFromScene: null,
    addPreviewModelToScene: null,
    removePreviewModelFromScene: null,
    updatePreviewModelInScene: null,
    hideOriginalModel: null,
    showOriginalModel: null,
    flyTo: null,
    setCamera: null
  });
}

// Individual store cleanup functions
export function resetCoordinates() {
  coordinates.set({
    latitude: '',
    longitude: '',
    height: 0
  });
}

export function resetModels() {
  models.set([]);
}

// resetSelectedModel moved to modalManager

export function resetPins() {
  pins.set([]);
}

export function resetZoomModal() {
  isZoomModalVisible.set(false);
}

export function resetLastTriggeredModal() {
  lastTriggeredModal.set(null);
}