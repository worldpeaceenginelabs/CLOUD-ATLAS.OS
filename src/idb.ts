/**
 * Shared IndexedDB utilities for Cloud Atlas OS
 * Centralized IndexedDB initialization and management
 */

import type { PinData, ModelData, HelpoutListing } from './types';

export class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private dbName = 'indexeddbstore';
  private version = 5; // Incremented to add helpouts store

  /**
   * Initialize IndexedDB connection
   */
  async openDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = request.result;
        console.log('IndexedDB upgrade needed, creating object stores...');

        // Create locationpins store
        if (!db.objectStoreNames.contains('locationpins')) {
          db.createObjectStore('locationpins', { keyPath: 'mapid' });
          console.log('Created object store: locationpins');
        }


        // Create models store
        if (!db.objectStoreNames.contains('models')) {
          db.createObjectStore('models', { keyPath: 'id' });
          console.log('Created object store: models');
        }

        // Create localpins store (for dapps)
        if (!db.objectStoreNames.contains('localpins')) {
          db.createObjectStore('localpins', { keyPath: 'mapid' });
          console.log('Created object store: localpins');
        }

        // Create helpouts cache store (keyed by geohash-4 cell)
        if (!db.objectStoreNames.contains('helpouts')) {
          db.createObjectStore('helpouts', { keyPath: 'cell' });
          console.log('Created object store: helpouts');
        }
      };

      request.onsuccess = (event: Event) => {
        this.db = request.result;
        console.log('IndexedDB opened successfully');
        resolve(this.db);
      };

      request.onerror = (event: Event) => {
        console.error('Error opening IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get the database instance
   */
  getDB(): IDBDatabase | null {
    return this.db;
  }

  /**
   * Wrap an IDBRequest in a proper Promise
   */
  private wrapRequest<T = void>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save pin to IndexedDB
   */
  async savePin(pinData: PinData): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.db.objectStoreNames.contains('locationpins')) {
      console.log('Locationpins object store not found, skipping pin save');
      return;
    }

    const transaction = this.db.transaction('locationpins', 'readwrite');
    const objectStore = transaction.objectStore('locationpins');
    await this.wrapRequest(objectStore.put(pinData));
    console.log('Pin saved to IndexedDB:', pinData.mapid);
  }

  /**
   * Load all pins from IndexedDB
   */
  async loadPins(): Promise<PinData[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.db.objectStoreNames.contains('locationpins')) {
      console.log('Locationpins object store not found, returning empty array');
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('locationpins', 'readonly');
      const objectStore = transaction.objectStore('locationpins');
      const request = objectStore.getAll();

      request.onsuccess = (event: Event) => {
        const pins = (event.target as IDBRequest).result;
        resolve(pins);
      };

      request.onerror = (event: Event) => {
        console.error('Error loading pins from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete pin from IndexedDB
   */
  async deletePin(mapid: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.db.objectStoreNames.contains('locationpins')) {
      console.log('Locationpins object store not found, skipping pin deletion');
      return;
    }

    const transaction = this.db.transaction('locationpins', 'readwrite');
    const objectStore = transaction.objectStore('locationpins');
    await this.wrapRequest(objectStore.delete(mapid));
    console.log('Pin deleted from IndexedDB:', mapid);
  }

  /**
   * Save model to IndexedDB
   */
  async saveModel(modelData: ModelData): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.db.objectStoreNames.contains('models')) {
      return;
    }

    const transaction = this.db.transaction('models', 'readwrite');
    const objectStore = transaction.objectStore('models');
    
    await this.wrapRequest(objectStore.put(modelData));
    
    console.log('Model saved to IndexedDB:', modelData.name);
  }

  /**
   * Load all models from IndexedDB
   */
  async loadModels(): Promise<ModelData[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.db.objectStoreNames.contains('models')) {
      console.log('Models object store not found, returning empty array');
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('models', 'readonly');
      const objectStore = transaction.objectStore('models');
      const request = objectStore.getAll();

      request.onsuccess = (event: Event) => {
        const models = (event.target as IDBRequest).result;
        resolve(models);
      };

      request.onerror = (event: Event) => {
        console.error('Error loading models from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete model from IndexedDB
   */
  async deleteModel(modelId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.db.objectStoreNames.contains('models')) {
      console.log('Models object store not found, skipping model deletion');
      return;
    }

    const transaction = this.db.transaction('models', 'readwrite');
    const objectStore = transaction.objectStore('models');
    await this.wrapRequest(objectStore.delete(modelId));
    console.log('Model deleted from IndexedDB:', modelId);
  }

  // ─── Helpout Cache ──────────────────────────────────────────

  /**
   * Save helpout listings for a geohash-4 cell
   */
  async saveHelpouts(cell: string, listings: HelpoutListing[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    if (!this.db.objectStoreNames.contains('helpouts')) return;

    const transaction = this.db.transaction('helpouts', 'readwrite');
    const store = transaction.objectStore('helpouts');
    await this.wrapRequest(store.put({ cell, listings }));
  }

  /**
   * Load cached helpout listings for a geohash-4 cell.
   * Returns null on cache miss.
   */
  async loadHelpouts(cell: string): Promise<HelpoutListing[] | null> {
    if (!this.db) throw new Error('Database not initialized');
    if (!this.db.objectStoreNames.contains('helpouts')) return null;

    const transaction = this.db.transaction('helpouts', 'readonly');
    const store = transaction.objectStore('helpouts');
    const result = await this.wrapRequest(store.get(cell));
    return result ? result.listings : null;
  }
}

// Create and export a singleton instance
export const idb = new IndexedDBManager();