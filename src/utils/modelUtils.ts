import { idb } from '../idb';
import { models } from '../store';
import type { ModelData } from '../types';
import { logError, CommonErrorContexts } from './errorHandler';

export interface SceneCallbacks {
  addModelToScene: (modelData: ModelData) => void;
  removeModelFromScene: (modelId: string) => void;
}

let _sceneCallbacks: SceneCallbacks | null = null;

export function setSceneCallbacks(callbacks: SceneCallbacks): void {
  _sceneCallbacks = callbacks;
}

export async function addModel(modelData: ModelData): Promise<void> {
  try {
    const serializable = serializeModelData(modelData);
    await idb.saveModel(serializable);
    _sceneCallbacks?.addModelToScene(modelData);
    models.update(list => [...list, modelData]);
  } catch (error) {
    logError(error, CommonErrorContexts.dataManager.addModel(modelData.name));
    throw new Error(`Failed to add model: ${modelData.name}`);
  }
}

export async function updateModel(modelData: ModelData): Promise<void> {
  try {
    _sceneCallbacks?.removeModelFromScene(modelData.id);
    const serializable = serializeModelData(modelData);
    await idb.saveModel(serializable);
    _sceneCallbacks?.addModelToScene(modelData);
    models.update(list => {
      const exists = list.some(m => m.id === modelData.id);
      return exists
        ? list.map(m => m.id === modelData.id ? modelData : m)
        : [...list, modelData];
    });
  } catch (error) {
    logError(error, CommonErrorContexts.dataManager.updateModel(modelData.id));
    throw new Error(`Failed to update model: ${modelData.id}`);
  }
}

export async function removeModel(modelId: string): Promise<void> {
  try {
    await idb.deleteModel(modelId);
    _sceneCallbacks?.removeModelFromScene(modelId);
    models.update(list => list.filter(m => m.id !== modelId));
  } catch (error) {
    logError(error, CommonErrorContexts.dataManager.removeModel(modelId));
    throw new Error(`Failed to remove model: ${modelId}`);
  }
}

function serializeModelData(modelData: ModelData): any {
  const { file, ...rest } = modelData;
  if (file) {
    return { ...rest, file: URL.createObjectURL(file) };
  }
  return rest;
}

export function createFinalModelData(
  coordinates: { latitude: string; longitude: string; height: number },
  formData: {
    selectedSource: string;
    gltfFile: File | null;
    gltfUrl: string;
    modelName: string;
    modelDescription: string;
    scale: number;
    height: number;
    heightOffset: number;
    heading: number;
    pitch: number;
    roll: number;
    isRoamingEnabled?: boolean;
    roamingSpeed?: number;
    roamingArea?: { north: number; south: number; east: number; west: number } | null;
  },
  isEditMode = false,
  editingModelId = ''
): ModelData {
  const modelData: ModelData = {
    id: isEditMode ? editingModelId : 'model_' + Date.now(),
    name: formData.modelName.trim(),
    description: formData.modelDescription.trim(),
    source: formData.selectedSource as 'file' | 'url',
    file: formData.gltfFile,
    url: formData.gltfUrl.trim(),
    coordinates: {
      latitude: parseFloat(coordinates.latitude),
      longitude: parseFloat(coordinates.longitude)
    },
    transform: {
      scale: formData.scale,
      height: formData.height,
      heightOffset: formData.heightOffset,
      heading: formData.heading,
      pitch: formData.pitch,
      roll: formData.roll
    },
    timestamp: new Date().toISOString()
  };

  if (formData.isRoamingEnabled && formData.roamingArea) {
    modelData.roaming = {
      isEnabled: formData.isRoamingEnabled,
      area: formData.roamingArea,
      speed: formData.roamingSpeed || 1.0
    };
  }

  return modelData;
}

export function addTemporaryModel(modelData: ModelData): string {
  const tempModelData = { ...modelData, id: 'temp_' + modelData.id };
  models.update(list => {
    let filtered = list.filter(m => !m.id.startsWith('temp_'));
    if (!modelData.id.startsWith('temp_')) {
      filtered = filtered.filter(m => m.id !== modelData.id);
    }
    return [...filtered, tempModelData];
  });
  return tempModelData.id;
}

export function removeTemporaryModel(tempModelId: string): void {
  models.update(list => list.filter(m => m.id !== tempModelId));
}

export async function persistTemporaryModel(tempModelId: string): Promise<void> {
  let tempModelData: ModelData | null = null;
  models.update(list => {
    tempModelData = list.find(m => m.id === tempModelId) ?? null;
    return list;
  });

  if (!tempModelData) throw new Error(`Temporary model not found: ${tempModelId}`);

  const permanentData = {
    ...tempModelData,
    id: (tempModelData as ModelData).id.startsWith('temp_')
      ? (tempModelData as ModelData).id.slice(5)
      : `perm_${(tempModelData as ModelData).id}`
  };

  await addModel(permanentData);
  removeTemporaryModel(tempModelId);
}

export function validateModelForm(
  modelName: string,
  coordinates: { latitude: string; longitude: string },
  selectedSource: string,
  gltfFile: File | null,
  gltfUrl: string
): { isValid: boolean; errorMessage: string } {
  if (!modelName.trim()) return { isValid: false, errorMessage: 'Please enter a model name' };
  if (!coordinates.latitude || !coordinates.longitude) return { isValid: false, errorMessage: 'Please select coordinates on the map' };
  if (selectedSource === 'file' && !gltfFile) return { isValid: false, errorMessage: 'Please select a file' };
  if (selectedSource === 'url' && !gltfUrl.trim()) return { isValid: false, errorMessage: 'Please enter a URL' };
  return { isValid: true, errorMessage: '' };
}
