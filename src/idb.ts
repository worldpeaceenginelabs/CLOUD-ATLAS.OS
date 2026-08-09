/**
 * idb.ts — Generic IndexedDB persistence layer.
 *
 * ARCHITECTURAL BOUNDARY
 * -----------------------------------------------------------------------
 * This module is the lowest-level persistence primitive in the app. It
 * knows nothing about:
 *   - what data is being stored, or why
 *   - Nostr, events, or any other domain/business model
 *   - Svelte, stores, or UI/application state
 *   - caching policy, subscriptions, or migrations tailored to one app
 *
 * It exposes only reusable IndexedDB plumbing: open a database, define
 * object stores declaratively, and perform get/set/delete/getAll/
 * getAllKeys/clear/has plus raw transactions. Callers supply the schema
 * (store names, key paths, indexes) and the values to store; this module
 * does not interpret either.
 *
 * Higher-level modules (e.g. a future `nostr.ts`, `store.ts`, or an
 * orchestrating `Nostr.svelte`) are responsible for deciding what gets
 * persisted, when, and how it's shaped. This module just persists it.
 *
 * Intended usage:
 *
 *   const db = await IdbDatabase.open({
 *     name: 'my-app',
 *     version: 1,
 *     stores: [
 *       { name: 'kv', keyPath: undefined }, // out-of-line keys
 *       { name: 'records', keyPath: 'id', indexes: [{ name: 'byCreatedAt', keyPath: 'createdAt' }] },
 *     ],
 *   });
 *
 *   await db.set('kv', someValue, 'my-key');
 *   const value = await db.get('kv', 'my-key');
 * -----------------------------------------------------------------------
 */

/** Any value IndexedDB natively accepts as a key. */
export type IdbKey = IDBValidKey;

/** Declarative description of a single index on an object store. */
export interface IdbIndexConfig {
  /** Name of the index. */
  name: string;
  /** Property path(s) the index is built from. */
  keyPath: string | string[];
  /** Whether the index enforces uniqueness. Defaults to false. */
  unique?: boolean;
  /** Whether the index is multi-entry (for array-valued keyPaths). Defaults to false. */
  multiEntry?: boolean;
}

/** Declarative description of a single object store. */
export interface IdbStoreConfig {
  /** Name of the object store. */
  name: string;
  /**
   * Property path used as the in-line key, e.g. `'id'`. Omit for
   * out-of-line keys (key supplied explicitly to get/set/delete).
   */
  keyPath?: string | string[];
  /** Whether to auto-generate keys for records without one. Defaults to false. */
  autoIncrement?: boolean;
  /** Indexes to create on this store. */
  indexes?: IdbIndexConfig[];
}

/** Declarative description of an entire database: name, version, stores. */
export interface IdbSchema {
  /** IndexedDB database name. */
  name: string;
  /** Schema version. Bump this whenever `stores` changes. */
  version: number;
  /** Object stores that must exist in this database. */
  stores: IdbStoreConfig[];
}

/** Options for a bounded range read (getAll / getAllKeys). */
export interface IdbRangeOptions {
  /** Restrict results to this key range. */
  query?: IDBValidKey | IDBKeyRange;
  /** Maximum number of results to return. */
  count?: number;
}

/**
 * Wraps a raw DOMException/Event-based IndexedDB error in a real Error so
 * failures propagate with a useful message and stack trace instead of
 * being silently dropped or surfaced as an opaque Event.
 */
export class IdbError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'IdbError';
  }
}

function requestToPromise<T>(request: IDBRequest<T>, errorContext: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(new IdbError(`${errorContext}: ${request.error?.message ?? 'unknown error'}`, request.error));
    };
  });
}

/** Resolves when a transaction completes; rejects on error or abort. */
function transactionDone(tx: IDBTransaction, errorContext: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      reject(new IdbError(`${errorContext}: ${tx.error?.message ?? 'unknown error'}`, tx.error));
    };
    tx.onabort = () => {
      reject(new IdbError(`${errorContext}: transaction aborted`, tx.error));
    };
  });
}

// Concurrent-open guard: keyed by "name@version" so callers that race to
// open the same database (e.g. two components mounting at once) share a
// single underlying `indexedDB.open` call instead of racing separate
// connections against each other.
const pendingOpens = new Map<string, Promise<IDBDatabase>>();

function applySchema(db: IDBDatabase, tx: IDBTransaction, schema: IdbSchema): void {
  for (const storeConfig of schema.stores) {
    let store: IDBObjectStore;
    if (db.objectStoreNames.contains(storeConfig.name)) {
      store = tx.objectStore(storeConfig.name);
    } else {
      store = db.createObjectStore(storeConfig.name, {
        keyPath: storeConfig.keyPath,
        autoIncrement: storeConfig.autoIncrement ?? false,
      });
    }

    for (const indexConfig of storeConfig.indexes ?? []) {
      if (!store.indexNames.contains(indexConfig.name)) {
        store.createIndex(indexConfig.name, indexConfig.keyPath, {
          unique: indexConfig.unique ?? false,
          multiEntry: indexConfig.multiEntry ?? false,
        });
      }
    }
  }
}

/**
 * Thin, promise-based wrapper around a single open IndexedDB connection.
 *
 * Instances are created via `IdbDatabase.open(schema)`, never directly.
 * All methods operate on store names declared in the schema the database
 * was opened with; this class does not know or care what's stored inside
 * them.
 */
export class IdbDatabase {
  private closed = false;

  private constructor(private readonly db: IDBDatabase) {
    // If the underlying connection is closed elsewhere (e.g. by the
    // browser during storage pressure), reflect that so subsequent calls
    // fail clearly instead of hanging.
    this.db.onclose = () => {
      this.closed = true;
    };
  }

  /**
   * Opens (or reuses) a connection to the database described by `schema`.
   * Concurrent calls for the same name+version share one underlying
   * `indexedDB.open` call.
   */
  static open(schema: IdbSchema): Promise<IdbDatabase> {
    const cacheKey = `${schema.name}@${schema.version}`;
    let pending = pendingOpens.get(cacheKey);
    if (!pending) {
      pending = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(schema.name, schema.version);

        request.onupgradeneeded = () => {
          const db = request.result;
          const tx = request.transaction;
          if (!tx) {
            reject(new IdbError('onupgradeneeded fired without an active transaction'));
            return;
          }
          try {
            applySchema(db, tx, schema);
          } catch (err) {
            reject(new IdbError('Failed to apply schema during upgrade', err));
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          // Another connection (e.g. a newer tab) requesting a version
          // upgrade will fire 'versionchange' here; close so it can proceed.
          db.onversionchange = () => {
            db.close();
          };
          resolve(db);
        };

        request.onerror = () => {
          reject(new IdbError(`Failed to open database "${schema.name}": ${request.error?.message ?? 'unknown error'}`, request.error));
        };

        request.onblocked = () => {
          reject(new IdbError(`Open of database "${schema.name}" is blocked by another open connection`));
        };
      }).finally(() => {
        pendingOpens.delete(cacheKey);
      });
      pendingOpens.set(cacheKey, pending);
    }
    return pending.then((db) => new IdbDatabase(db));
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new IdbError('Database connection is closed');
    }
  }

  /** Retrieves the value stored under `key` in `storeName`, or `undefined` if absent. */
  async get<T>(storeName: string, key: IdbKey): Promise<T | undefined> {
    this.assertOpen();
    const tx = this.db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const result = await requestToPromise<T | undefined>(store.get(key) as IDBRequest<T | undefined>, `get() on "${storeName}"`);
    await transactionDone(tx, `get() on "${storeName}"`);
    return result;
  }

  /**
   * Writes `value` into `storeName`, creating or overwriting the record.
   * Pass `key` explicitly for stores with out-of-line keys; omit it for
   * stores whose `keyPath`/`autoIncrement` supplies the key.
   * Resolves with the key the record was stored under.
   */
  async set<T>(storeName: string, value: T, key?: IdbKey): Promise<IdbKey> {
    this.assertOpen();
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = key === undefined ? store.put(value) : store.put(value, key);
    const resultKey = await requestToPromise(request, `set() on "${storeName}"`);
    await transactionDone(tx, `set() on "${storeName}"`);
    return resultKey;
  }

  /** Deletes the record stored under `key` in `storeName`, if present. */
  async delete(storeName: string, key: IdbKey): Promise<void> {
    this.assertOpen();
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    await requestToPromise(store.delete(key), `delete() on "${storeName}"`);
    await transactionDone(tx, `delete() on "${storeName}"`);
  }

  /** Returns all values in `storeName`, optionally bounded by a key range and/or count. */
  async getAll<T>(storeName: string, options?: IdbRangeOptions): Promise<T[]> {
    this.assertOpen();
    const tx = this.db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll(options?.query, options?.count) as IDBRequest<T[]>;
    const result = await requestToPromise(request, `getAll() on "${storeName}"`);
    await transactionDone(tx, `getAll() on "${storeName}"`);
    return result;
  }

  /** Returns all keys in `storeName`, optionally bounded by a key range and/or count. */
  async getAllKeys(storeName: string, options?: IdbRangeOptions): Promise<IdbKey[]> {
    this.assertOpen();
    const tx = this.db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAllKeys(options?.query, options?.count);
    const result = await requestToPromise(request, `getAllKeys() on "${storeName}"`);
    await transactionDone(tx, `getAllKeys() on "${storeName}"`);
    return result;
  }

  /** Removes every record from `storeName`. */
  async clear(storeName: string): Promise<void> {
    this.assertOpen();
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    await requestToPromise(store.clear(), `clear() on "${storeName}"`);
    await transactionDone(tx, `clear() on "${storeName}"`);
  }

  /** Returns whether a record exists under `key` in `storeName`. */
  async has(storeName: string, key: IdbKey): Promise<boolean> {
    this.assertOpen();
    const tx = this.db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const count = await requestToPromise(store.count(key), `has() on "${storeName}"`);
    await transactionDone(tx, `has() on "${storeName}"`);
    return count > 0;
  }

  /**
   * Runs `executor` inside a single IndexedDB transaction spanning
   * `storeNames`, for callers that need multiple operations to commit or
   * abort atomically together. `executor` receives the live transaction
   * and must perform its IDBObjectStore calls synchronously against it
   * (per IndexedDB's rules, the transaction auto-closes once the current
   * task yields with no pending requests) but may return a promise that
   * resolves once its own async bookkeeping (e.g. awaiting request
   * results) is done. The overall promise resolves once the transaction
   * completes and rejects on error or abort.
   */
  async runTransaction<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    executor: (tx: IDBTransaction) => Promise<T> | T,
  ): Promise<T> {
    this.assertOpen();
    const tx = this.db.transaction(storeNames, mode);
    const resultPromise = Promise.resolve(executor(tx));
    const [result] = await Promise.all([resultPromise, transactionDone(tx, 'runTransaction()')]);
    return result;
  }

  /** Closes the underlying connection. Safe to call multiple times. */
  close(): void {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }
}