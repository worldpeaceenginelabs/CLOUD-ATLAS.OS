import type { ModelData, SceneData, Listing } from './types';

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private dbName = 'indexeddbstore';
  private version = 9;

  async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (db.objectStoreNames.contains('helpouts')) {
          db.deleteObjectStore('helpouts');
        }
        // v9: added 'scenes' store for multi-model scene compositions
        const stores = ['models:id', 'scenes:id', 'listings:cell', 'nostrkeys:id', 'settings:id'];
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

  // ─── Scenes ─────────────────────────────────────────────────

  async saveScene(scene: SceneData | any): Promise<void> {
    await this.req(this.store('scenes', 'readwrite').put(scene));
  }

  async loadScenes(): Promise<SceneData[]> {
    return this.req(this.store('scenes').getAll());
  }

  async deleteScene(sceneId: string): Promise<void> {
    await this.req(this.store('scenes', 'readwrite').delete(sceneId));
  }

  // ─── Listing Cache (unified: geohash + global feed) ────────

  /** Payload shape for any listing cache entry. Cursors used by global feed only. */
  async loadListingCache(key: string): Promise<{
    listings: Listing[];
    fetchedAt: number;
    oldest?: number | null;
    newest?: number | null;
  } | null> {
    const result = await this.req(this.store('listings').get(key));
    if (!result) return null;
    const out: { listings: Listing[]; fetchedAt: number; oldest?: number | null; newest?: number | null } = {
      listings: result.listings ?? [],
      fetchedAt: result.fetchedAt ?? 0,
    };
    if (result.oldest != null) out.oldest = result.oldest;
    if (result.newest != null) out.newest = result.newest;
    return out;
  }

  async saveListingCache(
    key: string,
    payload: {
      listings: Listing[];
      fetchedAt: number;
      oldest?: number | null;
      newest?: number | null;
    },
  ): Promise<void> {
    const row: Record<string, unknown> = { cell: key, listings: payload.listings, fetchedAt: payload.fetchedAt };
    if (payload.oldest !== undefined) row.oldest = payload.oldest;
    if (payload.newest !== undefined) row.newest = payload.newest;
    await this.req(this.store('listings', 'readwrite').put(row));
  }

  /** Last DELETE fetch cursor (unix s). Used for moving since. */
  async getLastDeleteFetchSince(): Promise<number> {
    const raw = await this.loadSetting('lastDeleteFetchSince');
    if (raw == null || raw === '') return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }

  async setLastDeleteFetchSince(unixSec: number): Promise<void> {
    await this.saveSetting('lastDeleteFetchSince', String(unixSec));
  }

  /**
   * Apply deletions to all listing cache entries (IDB).
   * deletedSet: Set of 'id:pubkey' strings. Removes any listing with matching id+pubkey.
   */
  async applyDeletionsToAllListings(deletedSet: Set<string>): Promise<void> {
    if (deletedSet.size === 0) return;
    const store = this.store('listings', 'readwrite');
    const all = await this.req(store.getAll()) as Array<{ cell: string; listings: Listing[]; fetchedAt: number; oldest?: number | null; newest?: number | null }>;
    for (const row of all) {
      const before = row.listings.length;
      const listings = row.listings.filter((l) => !deletedSet.has(`${l.id}:${l.pubkey}`));
      if (listings.length !== before) {
        const next: Record<string, unknown> = { cell: row.cell, listings, fetchedAt: row.fetchedAt };
        if (row.oldest !== undefined) next.oldest = row.oldest;
        if (row.newest !== undefined) next.newest = row.newest;
        await this.req(store.put(next));
      }
    }
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
