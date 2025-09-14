/**
 * Shared Record Management Utilities
 * Consolidates duplicate record CRUD operations across components
 */

import { idb } from '../idb';
import type { PinData } from '../types';
import { handleAsyncOperation, CommonErrorContexts } from './errorHandler';

/**
 * Delete old records from the locationpins object store
 */
export async function deleteOldRecords(): Promise<void> {
  await handleAsyncOperation(
    async () => {
      const deletedCount = await idb.deleteOldRecords(30);
      console.log(`Deleted ${deletedCount} old records from locationpins`);
    },
    CommonErrorContexts.idb.deleteOldRecords()
  );
}

/**
 * Delete old records from the localpins object store
 */
export async function deleteOldRecordsLocal(): Promise<void> {
  await handleAsyncOperation(
    async () => {
      const deletedCount = await idb.deleteOldLocalRecords(30);
      console.log(`Deleted ${deletedCount} old local records from localpins`);
    },
    { component: 'IndexedDB', operation: 'deleteOldLocalRecords' }
  );
}

/**
 * Store a record in the locationpins object store
 */
export async function storeRecord(record: PinData): Promise<void> {
  await handleAsyncOperation(
    async () => {
      await idb.savePin(record);
      console.log('Stored record in IndexedDB');
    },
    CommonErrorContexts.idb.savePin(record.mapid)
  );
}

/**
 * Store a record in the localpins object store
 */
export async function storeRecordInLocalPins(record: PinData): Promise<void> {
  await handleAsyncOperation(
    async () => {
      await idb.saveLocalPin(record);
      console.log('Stored record in localpins IndexedDB');
    },
    { component: 'IndexedDB', operation: 'saveLocalPin', additionalInfo: record.mapid }
  );
}

/**
 * Load records from the locationpins object store
 */
export async function loadRecordsFromIndexedDB(): Promise<PinData[]> {
  const result = await handleAsyncOperation(
    () => idb.loadPins(),
    CommonErrorContexts.idb.loadPins(),
    []
  );
  
  return result || [];
}

/**
 * Initialize the app with proper sequence
 */
export async function initializeApp(): Promise<PinData[]> {
  await handleAsyncOperation(
    async () => {
      // Note: initializeIndexedDB should be called before this function
      await deleteOldRecords();
      await deleteOldRecordsLocal();
    },
    { component: 'App', operation: 'initializeApp' }
  );
  
  const storedRecords = await loadRecordsFromIndexedDB();
  console.log('Loaded records from IndexedDB');
  return storedRecords;
}
