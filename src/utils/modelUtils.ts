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
  console.log('🎯 [DEBUG] addModel called - Starting model addition workflow', {
    modelId: modelData.id,
    modelName: modelData.name,
    source: modelData.source,
    coordinates: modelData.coordinates,
    transform: modelData.transform,
    roaming: modelData.roaming
  });
  
  try {
    console.log('🎯 [DEBUG] addModel - Calling dataManager.addModel');
    await dataManager.addModel(modelData);
    console.log('🎯 [DEBUG] addModel - DataManager.addModel completed successfully');
    
    console.log('🎯 [DEBUG] addModel - Updating models store');
    models.update(currentModels => {
      const newModels = [...currentModels, modelData];
      console.log('🎯 [DEBUG] addModel - Models store updated:', {
        previousCount: currentModels.length,
        newCount: newModels.length,
        addedModel: modelData.name
      });
      return newModels;
    });
    
    console.log('🎯 [DEBUG] addModel - Model added successfully');
  } catch (error) {
    console.error('🎯 [DEBUG] addModel - Error adding model:', error);
    logError(error, CommonErrorContexts.dataManager.addModel(modelData.name));
    throw new Error(`Failed to add model: ${modelData.name}`);
  }
}

/**
 * Update an existing model
 */
export async function updateModel(modelData: ModelData): Promise<void> {
  console.log('🎯 [DEBUG] updateModel called - Starting model update workflow', {
    modelId: modelData.id,
    modelName: modelData.name,
    source: modelData.source,
    coordinates: modelData.coordinates,
    transform: modelData.transform,
    roaming: modelData.roaming
  });
  
  try {
    console.log('🎯 [DEBUG] updateModel - Calling dataManager.updateModel');
    await dataManager.updateModel(modelData);
    console.log('🎯 [DEBUG] updateModel - DataManager.updateModel completed successfully');
    
    console.log('🎯 [DEBUG] updateModel - Updating models store');
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
      
      console.log('🎯 [DEBUG] updateModel - Models store updated:', {
        totalModels: currentModels.length,
        updatedModel: modelData.name,
        foundMatch,
        action: foundMatch ? 'updated' : 'added'
      });
      return updatedModels;
    });
    
    console.log('🎯 [DEBUG] updateModel - Model updated successfully');
  } catch (error) {
    console.error('🎯 [DEBUG] updateModel - Error updating model:', error);
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
  console.log('🎯 [DEBUG] createFinalModelData called - Creating final model data', {
    isEditMode,
    editingModelId,
    coordinates,
    formData: {
      selectedSource: formData.selectedSource,
      modelName: formData.modelName,
      scale: formData.scale,
      height: formData.height,
      isRoamingEnabled: formData.isRoamingEnabled,
      hasRoamingArea: !!formData.roamingArea
    }
  });

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

  console.log('🎯 [DEBUG] createFinalModelData - Base model data created:', {
    id: modelData.id,
    name: modelData.name,
    source: modelData.source,
    coordinates: modelData.coordinates,
    transform: modelData.transform
  });

  // Add roaming data if enabled
  if (formData.isRoamingEnabled && formData.roamingArea) {
    console.log('🎯 [DEBUG] createFinalModelData - Adding roaming data to model:', {
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
    console.log('🎯 [DEBUG] createFinalModelData - No roaming data added:', {
      name: modelData.name,
      isEnabled: formData.isRoamingEnabled,
      hasArea: !!formData.roamingArea
    });
  }

  console.log('🎯 [DEBUG] createFinalModelData - Final model data created:', {
    id: modelData.id,
    name: modelData.name,
    hasRoaming: !!modelData.roaming,
    roamingEnabled: modelData.roaming?.isEnabled
  });

  return modelData;
}

/**
 * Add a temporary model directly to the store for immediate rendering
 * This model will be persisted if user saves, or removed if user cancels
 */
export function addTemporaryModel(modelData: ModelData): string {
  console.log('🎯 [DEBUG] addTemporaryModel called - Adding temporary model to store for immediate rendering:', {
    modelId: modelData.id,
    modelName: modelData.name,
    source: modelData.source,
    coordinates: modelData.coordinates
  });
  
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
      console.log('🎯 [DEBUG] addTemporaryModel - Edit mode: hiding original model:', modelData.id);
    }
    
    const newModels = [...filteredModels, tempModelData];
    console.log('🎯 [DEBUG] addTemporaryModel - Temporary model added to store:', {
      tempId: tempModelData.id,
      originalId: modelData.id,
      totalModels: newModels.length,
      tempModelName: tempModelData.name,
      isEditMode: !modelData.id.startsWith('temp_')
    });
    return newModels;
  });
  
  return tempModelData.id;
}

/**
 * Remove a temporary model from the store
 */
export function removeTemporaryModel(tempModelId: string): void {
  console.log('🎯 [DEBUG] removeTemporaryModel called - Removing temporary model from store:', tempModelId);
  
  // Extract the original model ID from the temporary model ID
  const originalModelId = tempModelId.replace('temp_', '');
  
  models.update(currentModels => {
    let filteredModels = currentModels.filter(m => m.id !== tempModelId);
    
    // If this was an edit mode temporary model, check if the original model exists
    const originalModelExists = currentModels.some(m => m.id === originalModelId);
    
    if (!originalModelExists && originalModelId !== tempModelId) {
      // This was edit mode and original model doesn't exist - we need to restore it from IDB
      console.log('🎯 [DEBUG] removeTemporaryModel - Edit mode detected, need to restore original model:', originalModelId);
      // The original model will be restored by the reactive statement in Cesium.svelte
      // when the models store changes, so we don't need to do anything here
    } else if (originalModelExists) {
      // Original model exists (it was updated and added back to store), so we just need to remove the temporary model
      console.log('🎯 [DEBUG] removeTemporaryModel - Original model exists (was updated and added back), just removing temporary model');
    }
    
    console.log('🎯 [DEBUG] removeTemporaryModel - Temporary model removed from store:', {
      removedId: tempModelId,
      originalId: originalModelId,
      remainingModels: filteredModels.length,
      originalModelExists
    });
    return filteredModels;
  });
}

/**
 * Persist a temporary model (convert from temporary to permanent)
 */
export async function persistTemporaryModel(tempModelId: string): Promise<void> {
  console.log('🎯 [DEBUG] persistTemporaryModel called - Converting temporary model to permanent:', tempModelId);
  
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
    id: tempModelData.id.replace('temp_', '') // Remove temp prefix
  };
  
  // Add to IDB and update store
  await addModel(permanentModelData);
  
  // Remove the temporary model
  removeTemporaryModel(tempModelId);
  
  console.log('🎯 [DEBUG] persistTemporaryModel - Temporary model persisted successfully:', {
    tempId: tempModelId,
    permanentId: permanentModelData.id,
    modelName: permanentModelData.name
  });
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
  console.log('🎯 [DEBUG] validateModelForm called with:', {
    modelName,
    coordinates,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    selectedSource,
    hasFile: !!gltfFile,
    hasUrl: !!gltfUrl
  });

  if (!modelName.trim()) {
    return { isValid: false, errorMessage: 'Please enter a model name' };
  }

  if (!coordinates.latitude || !coordinates.longitude) {
    console.log('🎯 [DEBUG] Validation failed - missing coordinates:', {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      latitudeEmpty: !coordinates.latitude,
      longitudeEmpty: !coordinates.longitude
    });
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
