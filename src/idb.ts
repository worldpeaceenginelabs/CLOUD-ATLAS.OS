import type { ModelData, Listing } from './types';

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private dbName = 'indexeddbstore';
  private version = 8;

  async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = () => {
        const db = request.result;
        // v8: renamed 'helpouts' → 'listings' (generic cache for all verticals)
        if (db.objectStoreNames.contains('helpouts')) {
          db.deleteObjectStore('helpouts');
        }
        const stores = ['models:id', 'listings:cell', 'nostrkeys:id', 'settings:id'];
        for (const entry of stores) {
          const [name, key] = entry.split(':');
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: key });
          }
        }
      };

      request.onsuccess = () => { this.db = request.result; resolve(this.db); };
      request.onerror = () => reject(request.error);
    });
  }

  private req<T = void>(r: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  private store(name: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.transaction(name, mode).objectStore(name);
  }

  // ─── Models ────────────────────────────────────────────────

  async saveModel(modelData: ModelData | any): Promise<void> {
    await this.req(this.store('models', 'readwrite').put(modelData));
  }

  async loadModels(): Promise<ModelData[]> {
    return this.req(this.store('models').getAll());
  }

  async deleteModel(modelId: string): Promise<void> {
    await this.req(this.store('models', 'readwrite').delete(modelId));
  }

  // ─── Listing Cache ─────────────────────────────────────────

  async saveListings(type: string, cell: string, listings: Listing[], fetchedAt: number): Promise<void> {
    const key = `${type}:${cell}`;
    await this.req(this.store('listings', 'readwrite').put({ cell: key, listings, fetchedAt }));
  }

  async loadListings(type: string, cell: string): Promise<{ listings: Listing[]; fetchedAt: number } | null> {
    const key = `${type}:${cell}`;
    const result = await this.req(this.store('listings').get(key));
    return result ? { listings: result.listings, fetchedAt: result.fetchedAt ?? 0 } : null;
  }

  // ─── Nostr Keypair ─────────────────────────────────────────

  async saveKeypair(sk: Uint8Array, pk: string): Promise<void> {
    await this.req(this.store('nostrkeys', 'readwrite').put({ id: 'primary', sk: Array.from(sk), pk }));
  }

  async loadKeypair(): Promise<{ sk: Uint8Array; pk: string } | null> {
    const result = await this.req(this.store('nostrkeys').get('primary'));
    return result ? { sk: new Uint8Array(result.sk), pk: result.pk } : null;
  }

  // ─── Settings ───────────────────────────────────────────────

  async saveSetting(id: string, value: string): Promise<void> {
    await this.req(this.store('settings', 'readwrite').put({ id, value }));
  }

  async loadSetting(id: string): Promise<string | null> {
    const result = await this.req(this.store('settings').get(id));
    return result ? result.value : null;
  }
}

export const idb = new IndexedDBManager();
