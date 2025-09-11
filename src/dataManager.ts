/**
 * Centralized Data Manager for Cloud Atlas OS
 * Implements Option 3: Hybrid with Clear Separation
 * 
 * Data Flow: UI → Store → IDB → Scene
 * - Store: UI state only
 * - IDB: Persistence layer
 * - Scene: Rendering layer
 */

import { idb, type ModelData, type PinData } from './idb';

export interface DataManagerCallbacks {
  addModelToScene: (modelData: ModelData) => void;
  removeModelFromScene: (modelId: string) => void;
  addPinToScene: (pinData: PinData) => void;
  removePinFromScene: (mapid: string) => void;
}

export class DataManager {
  public callbacks: DataManagerCallbacks;
  private isInitialized = false;

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
      // 1. Save to IDB (persistence layer)
      await idb.saveModel(modelData);
      
      // 2. Add to scene (rendering layer)
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
      
      // 2. Update in IDB
      await idb.saveModel(modelData);
      
      // 3. Add updated model to scene
      this.callbacks.addModelToScene(modelData);
      
      console.log('Model updated successfully:', modelData.name);
    } catch (error) {
      console.error('Error updating model:', error);
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
      // 1. Remove from IDB
      await idb.deleteModel(modelId);
      
      // 2. Remove from scene
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
