/**
 * Shared IndexedDB utilities for Cloud Atlas OS
 * Centralized IndexedDB initialization and management
 */


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

export interface LocalPinData {
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

export class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private dbName = 'indexeddbstore';
  private version = 4; // Incremented to ensure localpins store is created

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
      };

      request.onsuccess = (event: Event) => {
        this.db = request.result;
        console.log('IndexedDB opened successfully');
        
        // Ensure all required object stores exist (fallback for existing databases)
        this.ensureObjectStoresExist(this.db);
        
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
   * Ensure all required object stores exist
   * Note: This can only create stores during database upgrade, not in existing databases
   */
  ensureObjectStoresExist(db: IDBDatabase): void {
    const requiredStores = [
      { name: 'locationpins', keyPath: 'mapid' },
      { name: 'models', keyPath: 'id' },
      { name: 'localpins', keyPath: 'mapid' }
    ];

    for (const store of requiredStores) {
      if (!db.objectStoreNames.contains(store.name)) {
        console.log(`Missing object store: ${store.name} - will be created on next database upgrade`);
        // Note: We can't create object stores here as we're not in an upgrade transaction
        // The store will be created when the database version is incremented
      } else {
        console.log(`Object store exists: ${store.name}`);
      }
    }
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
    await objectStore.put(pinData);
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
    await objectStore.delete(mapid);
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
      console.log('Models object store not found, skipping model save');
      return;
    }

    const transaction = this.db.transaction('models', 'readwrite');
    const objectStore = transaction.objectStore('models');
    await objectStore.put(modelData);
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
    await objectStore.delete(modelId);
    console.log('Model deleted from IndexedDB:', modelId);
  }


  /**
   * Save local pin to IndexedDB (for dapps)
   */
  async saveLocalPin(pinData: LocalPinData): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.db.objectStoreNames.contains('localpins')) {
      console.log('Localpins object store not found, skipping local pin save');
      return;
    }

    const transaction = this.db.transaction('localpins', 'readwrite');
    const objectStore = transaction.objectStore('localpins');
    await objectStore.put(pinData);
    console.log('Local pin saved to IndexedDB:', pinData.mapid);
  }

  /**
   * Load all local pins from IndexedDB
   */
  async loadLocalPins(): Promise<LocalPinData[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.db.objectStoreNames.contains('localpins')) {
      console.log('Localpins object store not found, returning empty array');
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('localpins', 'readonly');
      const objectStore = transaction.objectStore('localpins');
      const request = objectStore.getAll();

      request.onsuccess = (event: Event) => {
        const pins = (event.target as IDBRequest).result;
        resolve(pins);
      };

      request.onerror = (event: Event) => {
        console.error('Error loading local pins from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete local pin from IndexedDB
   */
  async deleteLocalPin(mapid: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.db.objectStoreNames.contains('localpins')) {
      console.log('Localpins object store not found, skipping local pin deletion');
      return;
    }

    const transaction = this.db.transaction('localpins', 'readwrite');
    const objectStore = transaction.objectStore('localpins');
    await objectStore.delete(mapid);
    console.log('Local pin deleted from IndexedDB:', mapid);
  }

  /**
   * Get count of records in a specific object store
   */
  async getRecordCount(storeName: string): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.db.objectStoreNames.contains(storeName)) {
      console.log(`${storeName} object store not found, returning 0`);
      return 0;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.count();

      request.onsuccess = (event: Event) => {
        const count = (event.target as IDBRequest).result;
        resolve(count);
      };

      request.onerror = (event: Event) => {
        console.error(`Error counting records in ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete old records from locationpins store based on age
   * @param maxAgeInDays - Maximum age of records to keep (default: 30 days)
   */
  async deleteOldRecords(maxAgeInDays: number = 30): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.db.objectStoreNames.contains('locationpins')) {
      console.log('Locationpins object store not found, skipping old record deletion');
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('locationpins', 'readwrite');
      const objectStore = transaction.objectStore('locationpins');
      const request = objectStore.getAll();

      request.onsuccess = (event: Event) => {
        const records = (event.target as IDBRequest).result;
        const recordsToDelete = records.filter((record: PinData) => 
          record.timestamp && record.timestamp < cutoffTimestamp
        );

        if (recordsToDelete.length === 0) {
          console.log('No old records found to delete from locationpins');
          resolve(0);
          return;
        }

        let deletedCount = 0;
        const deletePromises = recordsToDelete.map((record: PinData) => 
          new Promise<void>((resolveDelete, rejectDelete) => {
            const deleteRequest = objectStore.delete(record.mapid);
            deleteRequest.onsuccess = () => {
              deletedCount++;
              resolveDelete();
            };
            deleteRequest.onerror = () => {
              console.error(`Error deleting record ${record.mapid}:`, deleteRequest.error);
              rejectDelete(deleteRequest.error);
            };
          })
        );

        Promise.all(deletePromises)
          .then(() => {
            console.log(`Deleted ${deletedCount} old records from locationpins`);
            resolve(deletedCount);
          })
          .catch((error) => {
            console.error('Error deleting old records from locationpins:', error);
            reject(error);
          });
      };

      request.onerror = (event: Event) => {
        console.error('Error loading records for deletion from locationpins:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete old records from localpins store based on age
   * @param maxAgeInDays - Maximum age of records to keep (default: 30 days)
   */
  async deleteOldLocalRecords(maxAgeInDays: number = 30): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.db.objectStoreNames.contains('localpins')) {
      console.log('Localpins object store not found, skipping old local record deletion');
      console.log('This is normal if the database hasn\'t been upgraded yet. The store will be created on next database upgrade.');
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('localpins', 'readwrite');
      const objectStore = transaction.objectStore('localpins');
      const request = objectStore.getAll();

      request.onsuccess = (event: Event) => {
        const records = (event.target as IDBRequest).result;
        const recordsToDelete = records.filter((record: LocalPinData) => 
          record.timestamp && record.timestamp < cutoffTimestamp
        );

        if (recordsToDelete.length === 0) {
          console.log('No old records found to delete from localpins');
          resolve(0);
          return;
        }

        let deletedCount = 0;
        const deletePromises = recordsToDelete.map((record: LocalPinData) => 
          new Promise<void>((resolveDelete, rejectDelete) => {
            const deleteRequest = objectStore.delete(record.mapid);
            deleteRequest.onsuccess = () => {
              deletedCount++;
              resolveDelete();
            };
            deleteRequest.onerror = () => {
              console.error(`Error deleting local record ${record.mapid}:`, deleteRequest.error);
              rejectDelete(deleteRequest.error);
            };
          })
        );

        Promise.all(deletePromises)
          .then(() => {
            console.log(`Deleted ${deletedCount} old records from localpins`);
            resolve(deletedCount);
          })
          .catch((error) => {
            console.error('Error deleting old records from localpins:', error);
            reject(error);
          });
      };

      request.onerror = (event: Event) => {
        console.error('Error loading records for deletion from localpins:', request.error);
        reject(request.error);
      };
    });
  }
}

// Create and export a singleton instance
export const idb = new IndexedDBManager();
