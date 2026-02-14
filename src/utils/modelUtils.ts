/**
 * Shared Model Management Utilities
 * Consolidates duplicate model CRUD operations across components
 */

import { dataManager } from '../dataManager';
import { models } from '../store';
import type { ModelData } from '../types';
import { CommonErrorContexts, logError } from './errorHandler';

/**
 * Add a new model to the system
 */
export async function addModel(modelData: ModelData): Promise<void> {
  try {
    await dataManager.addModel(modelData);
    models.update(currentModels => {
      const newModels = [...currentModels, modelData];
      return newModels;
    });
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
    models.update(currentModels => {
      const foundMatch = currentModels.some(m => m.id === modelData.id);
      
      let updatedModels;
      if (foundMatch) {
        // Model exists in store, update it
        updatedModels = currentModels.map(model => 
          model.id === modelData.id ? modelData : model
        );
      } else {
        // Model doesn't exist in store (edit mode with hidden original), add it
        updatedModels = [...currentModels, modelData];
      }
      return updatedModels;
    });
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
    modelData.roaming = {
      isEnabled: formData.isRoamingEnabled,
      area: formData.roamingArea,
      speed: formData.roamingSpeed || 1.0
    };
  }

  return modelData;
}

/**
 * Add a temporary model directly to the store for immediate rendering
 * This model will be persisted if user saves, or removed if user cancels
 */
export function addTemporaryModel(modelData: ModelData): string {
  // Add temporary prefix to ID to distinguish from persisted models
  const tempModelData = {
    ...modelData,
    id: 'temp_' + modelData.id
  };
  
  models.update(currentModels => {
    // Remove any existing temporary model first
    let filteredModels = currentModels.filter(m => !m.id.startsWith('temp_'));
    
    // In edit mode, also hide the original model being edited
    if (!modelData.id.startsWith('temp_')) {
      // This is edit mode - remove the original model from the scene
      filteredModels = filteredModels.filter(m => m.id !== modelData.id);
    }
    const newModels = [...filteredModels, tempModelData];
    return newModels;
  });
  
  return tempModelData.id;
}

/**
 * Remove a temporary model from the store
 */
export function removeTemporaryModel(tempModelId: string): void {
  // Extract the original model ID from the temporary model ID
  const originalModelId = tempModelId.replace('temp_', '');
  
  models.update(currentModels => {
    let filteredModels = currentModels.filter(m => m.id !== tempModelId);
    
    // If this was an edit mode temporary model, check if the original model exists
    const originalModelExists = currentModels.some(m => m.id === originalModelId);
    
    if (!originalModelExists && originalModelId !== tempModelId) {
      // This was edit mode and original model doesn't exist - we need to restore it from IDB
      // The original model will be restored by the reactive statement in Cesium.svelte
      // when the models store changes, so we don't need to do anything here
    }
    return filteredModels;
  });
}

/**
 * Persist a temporary model (convert from temporary to permanent)
 */
export async function persistTemporaryModel(tempModelId: string): Promise<void> {
  // Get the temporary model data
  let tempModelData: ModelData | null = null;
  models.update(currentModels => {
    const tempModel = currentModels.find(m => m.id === tempModelId);
    if (tempModel) {
      tempModelData = tempModel;
    }
    return currentModels;
  });
  
  if (!tempModelData) {
    throw new Error(`Temporary model not found: ${tempModelId}`);
  }
  
  // Create permanent model data with new ID
  const permanentModelData = {
    ...tempModelData,
    id: tempModelData.id.startsWith('temp_') 
      ? tempModelData.id.slice(5) 
      : `perm_${tempModelData.id}`
  };
  
  // Add to IDB and update store
  await addModel(permanentModelData);
  
  // Remove the temporary model
  removeTemporaryModel(tempModelId);
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
