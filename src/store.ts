import { writable, derived, type Writable } from 'svelte/store';
import type { Coordinates, ModelData, PinData } from './types';

export type { Coordinates, ModelData, PinData };

// UI State Stores
export const showPicture = writable(true);
export const gridReady = writable(false);
export const isVisible = writable(false);

// Modal State Stores
export const isRecordModalVisible = writable(false);
export const isModelModalVisible = writable(false);
export const selectedRecord = writable<{ mapid: string; latitude: string; longitude: string; category: string; title: string; text: string; link: string; timestamp: string } | null>(null);
export const recordButtonText = writable('');

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
  flyTo: null,
  setCamera: null
});

export const coordinates: Writable<Coordinates> = writable({
  latitude: '',
  longitude: '',
  height: 0
});

export const models: Writable<ModelData[]> = writable([]);

export const selectedModel: Writable<ModelData | null> = writable(null);

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

// Derived Stores
export const currentCoords = derived(coordinates, $coords => ({
  latitude: $coords.latitude || '',
  longitude: $coords.longitude || '',
  height: $coords.height || 0
}));

// Store cleanup functions
export function resetAllStores() {
  // UI State
  showPicture.set(true);
  gridReady.set(false);
  isVisible.set(false);
  
  // Modal State
  isRecordModalVisible.set(false);
  isModelModalVisible.set(false);
  selectedRecord.set(null);
  recordButtonText.set('');
  
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
  selectedModel.set(null);
  pins.set([]);
  isZoomModalVisible.set(false);
  lastTriggeredModal.set(null);
  
  // Roaming state
  isRoamingAreaMode.set(false);
  roamingAreaBounds.set(null);
  
  // Cesium Actions
  cesiumActions.set({
    addModelToScene: null,
    removeModelFromScene: null,
    addPinToScene: null,
    removePinFromScene: null,
    addPreviewModelToScene: null,
    removePreviewModelFromScene: null,
    updatePreviewModelInScene: null,
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

export function resetSelectedModel() {
  selectedModel.set(null);
}

export function resetPins() {
  pins.set([]);
}

export function resetZoomModal() {
  isZoomModalVisible.set(false);
}

export function resetLastTriggeredModal() {
  lastTriggeredModal.set(null);
}