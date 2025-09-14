/**
 * Shared Model Management Utilities
 * Consolidates duplicate model CRUD operations across components
 */

import { dataManager } from '../dataManager';
import { models } from '../store';
import type { ModelData } from '../types';
import { handleAsyncOperation, CommonErrorContexts, logError } from './errorHandler';

/**
 * Add a new model to the system
 */
export async function addModel(modelData: ModelData): Promise<void> {
  try {
    await dataManager.addModel(modelData);
    models.update(currentModels => [...currentModels, modelData]);
  } catch (error) {
    logError(error, CommonErrorContexts.dataManager.addModel(modelData.name));
    throw new Error(`Failed to add model: ${modelData.name}`);
  }
}

/**
 * Update an existing model
 */
export async function updateModel(modelData: ModelData): Promise<void> {
  try {
    await dataManager.updateModel(modelData);
    models.update(currentModels => 
      currentModels.map(model => 
        model.id === modelData.id ? modelData : model
      )
    );
  } catch (error) {
    logError(error, CommonErrorContexts.dataManager.updateModel(modelData.id));
    throw new Error(`Failed to update model: ${modelData.id}`);
  }
}

/**
 * Remove a model from the system
 */
export async function removeModel(modelId: string): Promise<void> {
  try {
    await dataManager.removeModel(modelId);
    models.update(currentModels => currentModels.filter(m => m.id !== modelId));
  } catch (error) {
    logError(error, CommonErrorContexts.dataManager.removeModel(modelId));
    throw new Error(`Failed to remove model: ${modelId}`);
  }
}

/**
 * Create a preview model data object
 */
export function createPreviewModelData(
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
  }
): ModelData {
  return {
    id: 'preview_' + Date.now(),
    name: formData.modelName || (formData.gltfFile?.name || 'Preview Model'),
    description: formData.modelDescription || '',
    source: formData.selectedSource as 'file' | 'url',
    file: formData.gltfFile,
    url: formData.gltfUrl,
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
}

/**
 * Create a final model data object for saving
 */
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
    roamingArea?: {
      north: number;
      south: number;
      east: number;
      west: number;
    } | null;
  },
  isEditMode: boolean = false,
  editingModelId: string = ''
): ModelData {
  const modelData: ModelData = {
    id: isEditMode ? editingModelId : 'model_' + Date.now(),
    name: formData.modelName.trim(),
    description: formData.modelDescription.trim(),
    source: formData.selectedSource as 'file' | 'url',
    file: formData.gltfFile, // This will be handled separately for serialization
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

  // Add roaming data if enabled
  if (formData.isRoamingEnabled && formData.roamingArea) {
    console.log('🎯 [MODEL UTILS] Adding roaming data to model:', {
      name: modelData.name,
      isEnabled: formData.isRoamingEnabled,
      area: formData.roamingArea,
      speed: formData.roamingSpeed || 1.0
    });
    
    modelData.roaming = {
      isEnabled: formData.isRoamingEnabled,
      area: formData.roamingArea,
      speed: formData.roamingSpeed || 1.0
    };
  } else {
    console.log('🎯 [MODEL UTILS] No roaming data added:', {
      name: modelData.name,
      isEnabled: formData.isRoamingEnabled,
      hasArea: !!formData.roamingArea
    });
  }

  return modelData;
}

/**
 * Validate model form data
 */
export function validateModelForm(
  modelName: string,
  coordinates: { latitude: string; longitude: string },
  selectedSource: string,
  gltfFile: File | null,
  gltfUrl: string
): { isValid: boolean; errorMessage: string } {
  if (!modelName.trim()) {
    return { isValid: false, errorMessage: 'Please enter a model name' };
  }

  if (!coordinates.latitude || !coordinates.longitude) {
    return { isValid: false, errorMessage: 'Please select coordinates on the map' };
  }

  if (selectedSource === 'file' && !gltfFile) {
    return { isValid: false, errorMessage: 'Please select a file' };
  }

  if (selectedSource === 'url' && !gltfUrl.trim()) {
    return { isValid: false, errorMessage: 'Please enter a URL' };
  }

  return { isValid: true, errorMessage: '' };
}
