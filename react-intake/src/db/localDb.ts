/**
 * Local IndexedDB storage for offline-first functionality
 * Stores forms locally and syncs with Supabase when online
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { IntakeForm } from '../types';

// Database schema
interface CBDIntakeDB extends DBSchema {
  forms: {
    key: string;
    value: LocalForm;
    indexes: { 'by-sync-status': number; 'by-updated': number };
  };
  syncQueue: {
    key: number;
    value: SyncQueueItem;
    indexes: { 'by-timestamp': number };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

export interface LocalForm extends IntakeForm {
  localId: string;
  remoteId?: string;
  synced: boolean;
  syncedAt?: number;
  localUpdatedAt: number;
}

export interface SyncQueueItem {
  id?: number;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: 'forms';
  localId: string;
  payload: unknown;
  timestamp: number;
  retryCount: number;
  lastAttemptTime?: number;  // Track last retry attempt
  error?: string;            // Track last error message
}

const DB_NAME = 'cbd-intake-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<CBDIntakeDB> | null = null;

/**
 * Initialize and get database instance
 */
export async function getDb(): Promise<IDBPDatabase<CBDIntakeDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<CBDIntakeDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Forms store
      if (!db.objectStoreNames.contains('forms')) {
        const formsStore = db.createObjectStore('forms', { keyPath: 'localId' });
        formsStore.createIndex('by-sync-status', 'synced');
        formsStore.createIndex('by-updated', 'localUpdatedAt');
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        syncStore.createIndex('by-timestamp', 'timestamp');
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

/**
 * Save form locally
 */
export async function saveFormLocally(form: IntakeForm): Promise<LocalForm> {
  const db = await getDb();
  
  // Check if form already exists locally
  const existing = await db.get('forms', form.id);
  
  const localForm: LocalForm = {
    ...form,
    localId: form.id,
    remoteId: existing?.remoteId,
    synced: false,
    localUpdatedAt: Date.now(),
  };

  await db.put('forms', localForm);

  // Add to sync queue
  await addToSyncQueue({
    type: existing ? 'UPDATE' : 'CREATE',
    table: 'forms',
    localId: form.id,
    payload: form,
    timestamp: Date.now(),
    retryCount: 0,
  });

  return localForm;
}

/**
 * Get form from local storage
 */
export async function getFormLocally(formId: string): Promise<LocalForm | undefined> {
  const db = await getDb();
  return db.get('forms', formId);
}

/**
 * Get all forms from local storage
 */
export async function getAllFormsLocally(): Promise<LocalForm[]> {
  const db = await getDb();
  const forms = await db.getAllFromIndex('forms', 'by-updated');
  return forms.reverse(); // Most recent first
}

/**
 * Delete form locally
 */
export async function deleteFormLocally(formId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get('forms', formId);
  
  if (existing) {
    await db.delete('forms', formId);
    
    // Add delete to sync queue if it was synced
    if (existing.remoteId) {
      await addToSyncQueue({
        type: 'DELETE',
        table: 'forms',
        localId: formId,
        payload: { remoteId: existing.remoteId },
        timestamp: Date.now(),
        retryCount: 0,
      });
    }
  }
}

/**
 * Clear all local forms (for factory reset)
 */
export async function clearAllFormsLocally(): Promise<void> {
  const db = await getDb();
  await db.clear('forms');
  await db.clear('syncQueue');
}

/**
 * Add item to sync queue with deduplication
 */
async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
  const db = await getDb();

  // Get existing queue items for this form
  const existingItems = await db.getAllFromIndex('syncQueue', 'by-timestamp');
  const duplicates = existingItems.filter(i =>
    i.localId === item.localId && i.type === item.type
  );

  // Remove older duplicate entries
  for (const dup of duplicates) {
    if (dup.id) await db.delete('syncQueue', dup.id);
  }

  // Add new entry
  await db.add('syncQueue', item as SyncQueueItem);
}

/**
 * Get pending sync items
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDb();
  return db.getAllFromIndex('syncQueue', 'by-timestamp');
}

/**
 * Remove item from sync queue
 */
export async function removeSyncQueueItem(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('syncQueue', id);
}

/**
 * Increment retry count for a sync queue item
 */
export async function incrementSyncItemRetry(id: number, error: string): Promise<void> {
  const db = await getDb();
  const item = await db.get('syncQueue', id);

  if (item) {
    item.retryCount = (item.retryCount || 0) + 1;
    item.lastAttemptTime = Date.now();
    item.error = error;
    await db.put('syncQueue', item);
  }
}

/**
 * Check if a sync item should be retried based on exponential backoff
 */
export async function shouldRetryItem(item: SyncQueueItem): Promise<boolean> {
  const MAX_RETRIES = 5;
  const BACKOFF_MS = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m

  // Exceeded max retries
  if (item.retryCount >= MAX_RETRIES) {
    console.error(`[Sync] Max retries exceeded for item ${item.id}:`, item.error);
    return false;
  }

  // Check backoff timing
  if (item.lastAttemptTime) {
    const backoffTime = BACKOFF_MS[item.retryCount] || BACKOFF_MS[BACKOFF_MS.length - 1];
    const timeSinceLastAttempt = Date.now() - item.lastAttemptTime;

    if (timeSinceLastAttempt < backoffTime) {
      // Too soon to retry
      return false;
    }
  }

  return true;
}

/**
 * Mark form as synced
 */
export async function markFormSynced(localId: string, remoteId: string): Promise<void> {
  const db = await getDb();
  const form = await db.get('forms', localId);
  
  if (form) {
    form.synced = true;
    form.remoteId = remoteId;
    form.syncedAt = Date.now();
    await db.put('forms', form);
  }
}

/**
 * Update form from remote (when receiving realtime updates) with conflict detection
 */
export async function updateFormFromRemote(remoteForm: IntakeForm & { id: string }): Promise<void> {
  const db = await getDb();

  // Find existing by remoteId or localId
  const allForms = await db.getAll('forms');
  const existing = allForms.find(f => f.remoteId === remoteForm.id || f.localId === remoteForm.id);

  // CONFLICT DETECTION: Compare timestamps if local form has unsynced changes
  if (existing && !existing.synced) {
    const localTime = existing.localUpdatedAt || 0;
    const remoteTime = new Date(remoteForm.updatedAt).getTime();

    if (localTime > remoteTime) {
      console.log(`[Conflict] Local version newer for ${remoteForm.id}, keeping local`);
      // Don't overwrite - local will sync up later
      return;
    }
  }

  const localForm: LocalForm = {
    ...remoteForm,
    localId: existing?.localId || remoteForm.id,
    remoteId: remoteForm.id,
    synced: true,
    syncedAt: Date.now(),
    localUpdatedAt: Date.now(),
  };

  await db.put('forms', localForm);
}

/**
 * Get unsynced forms count
 */
export async function getUnsyncedCount(): Promise<number> {
  const db = await getDb();
  const unsynced = await db.getAllFromIndex('forms', 'by-sync-status', IDBKeyRange.only(false));
  return unsynced.length;
}

/**
 * Check if we have any local data
 */
export async function hasLocalData(): Promise<boolean> {
  const db = await getDb();
  const count = await db.count('forms');
  return count > 0;
}

