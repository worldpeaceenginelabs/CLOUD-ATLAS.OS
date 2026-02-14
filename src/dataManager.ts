/**
 * Centralized Data Manager for Cloud Atlas OS
 * Implements Option 3: Hybrid with Clear Separation
 * 
 * Data Flow: UI → Store → IDB → Scene
 * - Store: UI state only
 * - IDB: Persistence layer
 * - Scene: Rendering layer
 */

import { idb } from './idb';
import type { ModelData, PinData } from './types';

export interface DataManagerCallbacks {
  addModelToScene: (modelData: ModelData) => void;
  removeModelFromScene: (modelId: string) => void;
  addPinToScene: (pinData: PinData) => void;
  removePinFromScene: (mapid: string) => void;
}

export class DataManager {
  public callbacks: DataManagerCallbacks;
  private isInitialized = false;
  private objectUrls: Map<string, string> = new Map(); // Track object URLs for cleanup

  constructor(callbacks: DataManagerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Initialize the data manager
   */
  async initialize(): Promise<void> {
    try {
      await idb.openDB();
      this.isInitialized = true;
      console.log('DataManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DataManager:', error);
      throw error;
    }
  }

  /**
   * Create a serializable version of model data for IndexedDB storage
   * Removes File objects which cannot be serialized
   */
  private createSerializableModelData(modelData: ModelData): Omit<ModelData, 'file'> & { file?: string } {
    const { file, ...serializableData } = modelData;
    
    // Convert File to URL if it exists
    if (file) {
      // Revoke any previous object URL for this model to prevent leaks
      const existingUrl = this.objectUrls.get(serializableData.id);
      if (existingUrl) {
        URL.revokeObjectURL(existingUrl);
      }
      const fileUrl = URL.createObjectURL(file);
      this.objectUrls.set(serializableData.id, fileUrl);
      return {
        ...serializableData,
        file: fileUrl
      };
    }
    
    return serializableData;
  }

  /**
   * Load all data from IDB and populate scene
   */
  async loadAllData(): Promise<{ models: ModelData[]; pins: PinData[] }> {
    if (!this.isInitialized) {
      throw new Error('DataManager not initialized');
    }

    try {
      const [models, pins] = await Promise.all([
        idb.loadModels(),
        idb.loadPins()
      ]);

      // Add all data to scene
      models.forEach(model => this.callbacks.addModelToScene(model));
      pins.forEach(pin => this.callbacks.addPinToScene(pin));

      console.log(`Loaded ${models.length} models and ${pins.length} pins from IDB`);
      return { models, pins };
    } catch (error) {
      console.error('Error loading data from IDB:', error);
      throw error;
    }
  }

  /**
   * Add a new model: Store → IDB → Scene
   */
  async addModel(modelData: ModelData): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('DataManager not initialized');
    }

    try {
      // 1. Create serializable version for IDB (remove File objects)
      const serializableModelData = this.createSerializableModelData(modelData);
      
      // 2. Save to IDB (persistence layer)
      await idb.saveModel(serializableModelData);
      
      // 3. Add to scene (rendering layer)
      this.callbacks.addModelToScene(modelData);
      
      console.log('Model added successfully:', modelData.name);
    } catch (error) {
      console.error('Error adding model:', error);
      throw error;
    }
  }

  /**
   * Update an existing model: Store → IDB → Scene
   */
  async updateModel(modelData: ModelData): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('DataManager not initialized');
    }

    try {
      // 1. Remove from scene
      this.callbacks.removeModelFromScene(modelData.id);
      
      // 2. Create serializable version for IDB (remove File objects)
      const serializableModelData = this.createSerializableModelData(modelData);
      
      // 3. Update in IDB
      await idb.saveModel(serializableModelData);
      
      // 4. Add updated model to scene
      this.callbacks.addModelToScene(modelData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove a model: Store → IDB → Scene
   */
  async removeModel(modelId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('DataManager not initialized');
    }

    try {
      // 1. Revoke any object URL for this model
      const objectUrl = this.objectUrls.get(modelId);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        this.objectUrls.delete(modelId);
      }

      // 2. Remove from IDB
      await idb.deleteModel(modelId);
      
      // 3. Remove from scene
      this.callbacks.removeModelFromScene(modelId);
      
      console.log('Model removed successfully:', modelId);
    } catch (error) {
      console.error('Error removing model:', error);
      throw error;
    }
  }

  /**
   * Add a new pin: Store → IDB → Scene
   */
  async addPin(pinData: PinData): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('DataManager not initialized');
    }

    try {
      // 1. Save to IDB
      await idb.savePin(pinData);
      
      // 2. Add to scene
      this.callbacks.addPinToScene(pinData);
      
      console.log('Pin added successfully:', pinData.title);
    } catch (error) {
      console.error('Error adding pin:', error);
      throw error;
    }
  }

  /**
   * Remove a pin: Store → IDB → Scene
   */
  async removePin(mapid: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('DataManager not initialized');
    }

    try {
      // 1. Remove from IDB
      await idb.deletePin(mapid);
      
      // 2. Remove from scene
      this.callbacks.removePinFromScene(mapid);
      
      console.log('Pin removed successfully:', mapid);
    } catch (error) {
      console.error('Error removing pin:', error);
      throw error;
    }
  }

  /**
   * Get all models from IDB (for store initialization)
   */
  async getModels(): Promise<ModelData[]> {
    if (!this.isInitialized) {
      throw new Error('DataManager not initialized');
    }

    try {
      return await idb.loadModels();
    } catch (error) {
      console.error('Error loading models:', error);
      throw error;
    }
  }

  /**
   * Get all pins from IDB (for store initialization)
   */
  async getPins(): Promise<PinData[]> {
    if (!this.isInitialized) {
      throw new Error('DataManager not initialized');
    }

    try {
      return await idb.loadPins();
    } catch (error) {
      console.error('Error loading pins:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const dataManager = new DataManager({
  addModelToScene: () => {}, // Will be set by Cesium component
  removeModelFromScene: () => {},
  addPinToScene: () => {},
  removePinFromScene: () => {}
});