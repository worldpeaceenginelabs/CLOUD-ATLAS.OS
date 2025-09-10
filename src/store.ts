import { writable, type Writable } from 'svelte/store';

interface Coordinates {
  latitude: string;
  longitude: string;
  height: number;
}

export interface ModelData {
  id: string;
  name: string;
  description: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  transform: {
    scale: number;
    height: number;
    heading: number;
    pitch: number;
    roll: number;
    heightOffset: number;
  };
  source: 'file' | 'url';
  url?: string;
  file?: File;
  timestamp: string;
}

export interface PinData {
  mapid: string;
  latitude: string;
  longitude: string;
  category: string;
  title: string;
  text: string;
  link: string;
  timestamp: string;
  height: number;
}

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

// Store cleanup functions
export function resetAllStores() {
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