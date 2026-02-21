/**
 * Sync Service - Handles synchronization between local IndexedDB and Railway backend
 */

import { formsApi, getToken } from '../lib/api';
import {
  getPendingSyncItems,
  removeSyncQueueItem,
  markFormSynced,
  updateFormFromRemote,
  getUnsyncedCount as getLocalUnsyncedCount,
  SyncQueueItem,
  incrementSyncItemRetry,
  shouldRetryItem,
  getAllFormsLocally,
  deleteFormLocalOnly,
} from './localDb';
import { IntakeForm } from '../types';

type SyncCallback = () => void;

// Sync status type
export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  lastError: string | null;
}

let syncPromise: Promise<{ success: number; failed: number }> | null = null;
let syncCallbacks: SyncCallback[] = [];
let lastSyncTime: number | null = null;
let lastSyncTimestamp: string | null = null; // ISO timestamp for incremental pulls
let lastError: string | null = null;
let statusSubscribers: ((status: SyncStatus) => void)[] = [];

/**
 * Register a callback for when sync completes
 */
export function onSyncComplete(callback: SyncCallback): () => void {
  syncCallbacks.push(callback);
  return () => {
    syncCallbacks = syncCallbacks.filter(cb => cb !== callback);
  };
}

function notifySyncCallbacks() {
  syncCallbacks.forEach(cb => cb());
}

async function getCurrentSyncStatus(): Promise<SyncStatus> {
  const pendingCount = await getLocalUnsyncedCount();
  return {
    isOnline: navigator.onLine,
    isSyncing: syncPromise !== null,
    pendingCount,
    lastSyncTime,
    lastError,
  };
}

async function notifyStatusSubscribers() {
  const status = await getCurrentSyncStatus();
  statusSubscribers.forEach(cb => cb(status));
}

export function subscribeSyncStatus(callback: (status: SyncStatus) => void): () => void {
  statusSubscribers.push(callback);
  getCurrentSyncStatus().then(callback);
  return () => {
    statusSubscribers = statusSubscribers.filter(cb => cb !== callback);
  };
}

export async function syncFull(): Promise<void> {
  await fullSync();
}

export async function syncFromCloud(): Promise<number> {
  return pullFromRemote();
}

/**
 * Validate form data before syncing
 */
function validateForm(form: IntakeForm): { valid: boolean; error?: string } {
  if (!form.id) return { valid: false, error: 'Missing form ID' };
  if (!form.consignerType) return { valid: false, error: 'Missing consigner type' };

  if (form.consignerType === 'new') {
    if (!form.consignerName?.trim()) {
      return { valid: false, error: 'New consigner requires name' };
    }
  } else if (form.consignerType === 'existing') {
    if (!form.consignerNumber) {
      return { valid: false, error: 'Existing consigner requires number' };
    }
  }

  return { valid: true };
}

/**
 * Convert an IntakeForm to the payload format expected by the API
 */
function formToPayload(form: IntakeForm): Record<string, unknown> {
  return {
    id: form.id,
    consignerType: form.consignerType,
    consignerName: form.consignerName || '',
    consignerNumber: form.consignerNumber || null,
    consignerAddress: form.consignerAddress || null,
    consignerPhone: form.consignerPhone || null,
    consignerEmail: form.consignerEmail || null,
    intakeMode: form.intakeMode || null,
    status: form.status || 'draft',
    items: JSON.parse(JSON.stringify(form.items)),
    enabledFields: form.enabledFields || null,
    signatureData: form.signatureData || null,
    initials1: form.initials1 || null,
    initials2: form.initials2 || null,
    initials3: form.initials3 || null,
    signatureDate: form.signatureDate || null,
    acceptedBy: form.acceptedBy || null,
    createdAt: form.createdAt instanceof Date ? form.createdAt.toISOString() : form.createdAt,
    updatedAt: form.updatedAt instanceof Date ? form.updatedAt.toISOString() : form.updatedAt,
    signedAt: form.signedAt ? (form.signedAt instanceof Date ? form.signedAt.toISOString() : form.signedAt) : null,
  };
}

/**
 * Process all pending sync items
 */
export async function processSyncQueue(): Promise<{ success: number; failed: number }> {
  if (syncPromise) {
    return syncPromise;
  }

  if (!navigator.onLine || !getToken()) {
    return { success: 0, failed: 0 };
  }

  syncPromise = (async () => {
    let success = 0;
    let failed = 0;

    try {
      const pendingItems = await getPendingSyncItems();
      if (pendingItems.length === 0) return { success: 0, failed: 0 };

      // Build batch operations
      const operations: { type: 'CREATE' | 'UPDATE' | 'DELETE'; payload: Record<string, unknown> }[] = [];
      const itemMap: Map<number, SyncQueueItem> = new Map();

      for (const item of pendingItems) {
        if (!(await shouldRetryItem(item))) {
          if (item.retryCount >= 5) {
            await removeSyncQueueItem(item.id!);
            console.error(`[Sync] Max retries exceeded for ${item.type} ${item.localId}`);
          }
          continue;
        }

        if (item.type === 'CREATE' || item.type === 'UPDATE') {
          const form = item.payload as IntakeForm;
          const validation = validateForm(form);
          if (!validation.valid) {
            console.error(`[Sync] Validation failed:`, validation.error);
            if (item.id) await incrementSyncItemRetry(item.id, validation.error!);
            failed++;
            continue;
          }
          operations.push({ type: item.type, payload: formToPayload(form) });
        } else if (item.type === 'DELETE') {
          const payload = item.payload as { remoteId?: string; id?: string };
          operations.push({ type: 'DELETE', payload: { id: payload.remoteId || payload.id } });
        }

        if (item.id) itemMap.set(operations.length - 1, item);
      }

      if (operations.length === 0) return { success: 0, failed: 0 };

      console.log(`[Sync] Pushing ${operations.length} operations`);
      const response = await formsApi.pushSync(operations);

      for (let i = 0; i < response.results.length; i++) {
        const result = response.results[i];
        const item = itemMap.get(i);

        if (result.success) {
          if (item?.id) {
            await removeSyncQueueItem(item.id);
            if (item.type === 'CREATE' || item.type === 'UPDATE') {
              await markFormSynced(item.localId, result.id);
            }
          }
          success++;
        } else {
          if (item?.id) {
            await incrementSyncItemRetry(item.id, result.error || 'Sync failed');
          }
          console.error(`[Sync] Operation failed:`, result.error);
          failed++;
        }
      }
    } catch (error) {
      console.error('[Sync] Queue processing error:', error);
      lastError = error instanceof Error ? error.message : 'Sync failed';
    } finally {
      syncPromise = null;

      if (success > 0) {
        lastSyncTime = Date.now();
        lastError = null;
        notifySyncCallbacks();
      }
      notifyStatusSubscribers();
    }

    return { success, failed };
  })();

  return syncPromise;
}

/**
 * Map API response form to local IntakeForm
 */
function mapRemoteToLocal(data: Record<string, unknown>): IntakeForm & { id: string } {
  return {
    id: data.id as string,
    consignerType: data.consignerType as 'new' | 'existing',
    consignerName: (data.consignerName as string) || '',
    consignerNumber: (data.consignerNumber as string) || undefined,
    consignerAddress: (data.consignerAddress as string) || undefined,
    consignerPhone: (data.consignerPhone as string) || undefined,
    consignerEmail: (data.consignerEmail as string) || undefined,
    intakeMode: (data.intakeMode as 'detection' | 'general' | 'prepopulate' | null) || null,
    status: (data.status as 'draft' | 'signed') || 'draft',
    items: (data.items || []) as IntakeForm['items'],
    enabledFields: data.enabledFields as IntakeForm['enabledFields'],
    signatureData: (data.signatureData as string) || undefined,
    initials1: (data.initials1 as string) || undefined,
    initials2: (data.initials2 as string) || undefined,
    initials3: (data.initials3 as string) || undefined,
    signatureDate: (data.signatureDate as string) || undefined,
    acceptedBy: (data.acceptedBy as string) || undefined,
    createdAt: data.createdAt ? new Date(data.createdAt as string) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt as string) : new Date(),
    signedAt: data.signedAt ? new Date(data.signedAt as string) : undefined,
  };
}

/**
 * Pull latest forms from backend
 */
export async function pullFromRemote(): Promise<number> {
  if (!navigator.onLine || !getToken()) {
    return 0;
  }

  try {
    console.log('[Sync] Pulling forms from server');
    const response = await formsApi.pullSync(lastSyncTimestamp || undefined);

    // Update timestamp for next incremental pull
    lastSyncTimestamp = response.server_time;

    // Handle deleted forms
    if (response.deleted_ids.length > 0) {
      const localForms = await getAllFormsLocally();
      for (const deletedId of response.deleted_ids) {
        const localForm = localForms.find(f => f.remoteId === deletedId || f.localId === deletedId);
        if (localForm && localForm.synced) {
          console.log(`[Sync] Deleting local form ${localForm.localId} - deleted on server`);
          await deleteFormLocalOnly(localForm.localId);
        }
      }
    }

    // Update/add forms
    let updated = 0;
    for (const remoteForm of response.forms) {
      await updateFormFromRemote(mapRemoteToLocal(remoteForm));
      updated++;
    }

    if (updated > 0 || response.deleted_ids.length > 0) {
      console.log(`[Sync] Updated ${updated} forms, deleted ${response.deleted_ids.length}`);
      lastSyncTime = Date.now();
      lastError = null;
      notifySyncCallbacks();
    }

    notifyStatusSubscribers();
    return updated;
  } catch (error) {
    console.error('[Sync] Pull from remote failed:', error);
    lastError = error instanceof Error ? error.message : 'Pull failed';
    notifyStatusSubscribers();
    return 0;
  }
}

/**
 * Full sync - push local changes then pull remote changes
 */
export async function fullSync(): Promise<{ pushed: number; pulled: number }> {
  const pushResult = await processSyncQueue();
  const pulled = await pullFromRemote();
  return { pushed: pushResult.success, pulled };
}

/**
 * Subscribe to realtime updates (polling-based, replaces Supabase realtime)
 * Returns a cleanup function. The actual polling is handled by the auto-sync interval in App.tsx.
 */
export function subscribeToRealtimeUpdates(_onUpdate: () => void): () => void {
  // No-op - polling via App.tsx auto-sync interval handles this
  return () => {};
}

/**
 * Setup online/offline event listeners
 */
export function setupOnlineSync(): () => void {
  const handleOnline = () => {
    console.log('Back online - syncing...');
    processSyncQueue();
  };

  window.addEventListener('online', handleOnline);

  if (navigator.onLine) {
    processSyncQueue();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
