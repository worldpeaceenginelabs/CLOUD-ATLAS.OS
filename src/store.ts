import { writable, derived, type Writable } from 'svelte/store';
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


// Geological Timeline Store
export interface Epoch {
  age: number; // Million years ago
  label: string;
  filename: string;
}

export const epochs: Epoch[] = [
  { age: 0, label: 'Present Day', filename: '000present.jpg' },
  { age: 20, label: '20 Ma', filename: '020Marect.jpg' },
  { age: 35, label: '35 Ma', filename: '035Marect.jpg' },
  { age: 50, label: '50 Ma', filename: '050Marect.jpg' },
  { age: 65, label: '65 Ma', filename: '065Marect.jpg' },
  { age: 90, label: '90 Ma', filename: '090Marect.jpg' },
  { age: 105, label: '105 Ma', filename: '105Marect.jpg' },
  { age: 120, label: '120 Ma', filename: '120Marect.jpg' },
  { age: 150, label: '150 Ma', filename: '150Marect.jpg' },
  { age: 170, label: '170 Ma', filename: '170Marect.jpg' },
  { age: 200, label: '200 Ma', filename: '200Marect.jpg' },
  { age: 220, label: '220 Ma', filename: '220Marect.jpg' },
  { age: 240, label: '240 Ma', filename: '240Marect.jpg' },
  { age: 260, label: '260 Ma', filename: '260Marect.jpg' },
  { age: 280, label: '280 Ma', filename: '280Marect.jpg' },
  { age: 300, label: '300 Ma', filename: '300Marect.jpg' },
  { age: 340, label: '340 Ma', filename: '340Marect.jpg' },
  { age: 370, label: '370 Ma', filename: '370Marect.jpg' },
  { age: 400, label: '400 Ma', filename: '400Marect.jpg' },
  { age: 430, label: '430 Ma', filename: '430Marect.jpg' },
  { age: 450, label: '450 Ma', filename: '450Marect.jpg' },
  { age: 470, label: '470 Ma', filename: '470Marect.jpg' },
  { age: 500, label: '500 Ma', filename: '500Marect.jpg' },
  { age: 540, label: '540 Ma', filename: '540Marect.jpg' },
  { age: 560, label: '560 Ma', filename: '560Marect.jpg' },
  { age: 600, label: '600 Ma', filename: '600Marect.jpg' },
];

export const currentEpoch = writable<Epoch>(epochs[0]); // Default to Present Day