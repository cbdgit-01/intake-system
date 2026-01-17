/**
 * Sync Service - Handles synchronization between local IndexedDB and Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  getPendingSyncItems,
  removeSyncQueueItem,
  markFormSynced,
  updateFormFromRemote,
  getUnsyncedCount as getLocalUnsyncedCount,
  SyncQueueItem,
  incrementSyncItemRetry,
  shouldRetryItem,
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
let realtimeSubscription: ReturnType<typeof supabase.channel> | null = null;
let lastSyncTime: number | null = null;
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

/**
 * Notify all sync callbacks
 */
function notifySyncCallbacks() {
  syncCallbacks.forEach(cb => cb());
}

/**
 * Get current sync status
 */
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

/**
 * Notify status subscribers
 */
async function notifyStatusSubscribers() {
  const status = await getCurrentSyncStatus();
  statusSubscribers.forEach(cb => cb(status));
}

/**
 * Subscribe to sync status changes
 */
export function subscribeSyncStatus(callback: (status: SyncStatus) => void): () => void {
  statusSubscribers.push(callback);
  
  // Send initial status
  getCurrentSyncStatus().then(callback);
  
  return () => {
    statusSubscribers = statusSubscribers.filter(cb => cb !== callback);
  };
}

/**
 * Full bidirectional sync (alias for fullSync)
 */
export async function syncFull(): Promise<void> {
  await fullSync();
}

/**
 * Pull data from cloud (alias for pullFromRemote)
 */
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
 * Process a single sync queue item
 */
async function processSyncItem(item: SyncQueueItem): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    switch (item.type) {
      case 'CREATE':
      case 'UPDATE': {
        const form = item.payload as IntakeForm;

        // VALIDATE before syncing
        const validation = validateForm(form);
        if (!validation.valid) {
          console.error(`[Sync] Validation failed:`, validation.error);
          if (item.id) await incrementSyncItemRetry(item.id, validation.error!);
          return false;
        }

        // Handle CREATE
        if (item.type === 'CREATE') {
          const { data, error } = await supabase
            .from('forms')
            .insert({
              id: form.id,
              consigner_type: form.consignerType,
              consigner_name: form.consignerName || '',
              consigner_number: form.consignerNumber || null,
              consigner_address: form.consignerAddress || null,
              consigner_phone: form.consignerPhone || null,
              consigner_email: form.consignerEmail || null,
              intake_mode: form.intakeMode || null,
              status: form.status || 'draft',
              items: JSON.parse(JSON.stringify(form.items)),
              enabled_fields: form.enabledFields || null,
              signature_data: form.signatureData || null,
              initials_1: form.initials1 || null,
              initials_2: form.initials2 || null,
              initials_3: form.initials3 || null,
              accepted_by: form.acceptedBy || null,
              signed_at: form.signedAt ? form.signedAt.toISOString() : null,
              created_by: user?.id || null,
              signed_by: form.status === 'signed' ? user?.id : null,
            })
            .select()
            .single();

          if (error) throw error;
          if (data) {
            await markFormSynced(item.localId, data.id);
          }
          return true;
        }

        // Handle UPDATE
        const { error } = await supabase
          .from('forms')
          .update({
            consigner_type: form.consignerType,
            consigner_name: form.consignerName || '',
            consigner_number: form.consignerNumber || null,
            consigner_address: form.consignerAddress || null,
            consigner_phone: form.consignerPhone || null,
            consigner_email: form.consignerEmail || null,
            intake_mode: form.intakeMode || null,
            status: form.status || 'draft',
            items: JSON.parse(JSON.stringify(form.items)),
            enabled_fields: form.enabledFields || null,
            signature_data: form.signatureData || null,
            initials_1: form.initials1 || null,
            initials_2: form.initials2 || null,
            initials_3: form.initials3 || null,
            accepted_by: form.acceptedBy || null,
            signed_at: form.signedAt ? form.signedAt.toISOString() : null,
            signed_by: form.status === 'signed' ? user?.id : null,
          })
          .eq('id', form.id);

        if (error) throw error;
        await markFormSynced(item.localId, form.id);
        return true;
      }

      case 'DELETE': {
        const payload = item.payload as { remoteId: string };
        const { error } = await supabase
          .from('forms')
          .delete()
          .eq('id', payload.remoteId);

        if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" errors
        return true;
      }

      default:
        return true;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sync] Error processing item:', errorMsg);
    if (item.id) await incrementSyncItemRetry(item.id, errorMsg);
    return false;
  }
}

/**
 * Process all pending sync items with retry logic and Promise-based locking
 */
export async function processSyncQueue(): Promise<{ success: number; failed: number }> {
  // If sync already in progress, return existing promise
  if (syncPromise) {
    return syncPromise;
  }

  if (!navigator.onLine || !isSupabaseConfigured()) {
    return { success: 0, failed: 0 };
  }

  // Create new sync promise
  syncPromise = (async () => {
    let success = 0;
    let failed = 0;

    try {
      const pendingItems = await getPendingSyncItems();

      for (const item of pendingItems) {
        // Check if item should be retried based on backoff
        if (!(await shouldRetryItem(item))) {
          if (item.retryCount >= 5) {
            // Max retries exceeded - remove from queue
            await removeSyncQueueItem(item.id!);
            console.error(`[Sync] Removing failed item after max retries:`, item);
          }
          continue;
        }

        const result = await processSyncItem(item);

        if (result) {
          await removeSyncQueueItem(item.id!);
          success++;
        } else {
          failed++;
        }
      }
    } catch (error) {
      console.error('Sync queue processing error:', error);
      lastError = error instanceof Error ? error.message : 'Sync failed';
    } finally {
      syncPromise = null; // Release lock

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
 * Pull latest forms from Supabase to local
 */
export async function pullFromRemote(): Promise<number> {
  if (!navigator.onLine || !isSupabaseConfigured()) return 0;

  try {
    const { data, error } = await supabase
      .from('forms')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    if (!data) return 0;

    let updated = 0;
    for (const remoteForm of data) {
      await updateFormFromRemote(mapRemoteToLocal(remoteForm));
      updated++;
    }

    lastSyncTime = Date.now();
    lastError = null;
    notifySyncCallbacks();
    notifyStatusSubscribers();
    return updated;
  } catch (error) {
    console.error('Pull from remote failed:', error);
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
 * Subscribe to realtime updates from Supabase
 */
export function subscribeToRealtimeUpdates(onUpdate: () => void): () => void {
  if (!isSupabaseConfigured()) return () => {};

  // Unsubscribe from existing subscription
  if (realtimeSubscription) {
    supabase.removeChannel(realtimeSubscription);
  }

  realtimeSubscription = supabase
    .channel('forms-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'forms' },
      async (payload) => {
        console.log('Realtime update:', payload.eventType);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          await updateFormFromRemote(mapRemoteToLocal(payload.new as RemoteForm));
        }
        
        // For DELETE, we'd need to handle removal from local DB
        // But we should be careful not to delete forms the user created locally
        
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    if (realtimeSubscription) {
      supabase.removeChannel(realtimeSubscription);
      realtimeSubscription = null;
    }
  };
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

  // Initial sync if online
  if (navigator.onLine) {
    processSyncQueue();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

// Type for remote form data
interface RemoteForm {
  id: string;
  consigner_type: string;
  consigner_name: string;
  consigner_number: string | null;
  consigner_address: string | null;
  consigner_phone: string | null;
  consigner_email: string | null;
  intake_mode: string | null;
  status: string;
  items: unknown;
  enabled_fields: unknown;
  signature_data: string | null;
  initials_1: string | null;
  initials_2: string | null;
  initials_3: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
  signed_at: string | null;
}

/**
 * Map remote Supabase form to local IntakeForm
 */
function mapRemoteToLocal(data: RemoteForm): IntakeForm & { id: string } {
  return {
    id: data.id,
    consignerType: data.consigner_type as 'new' | 'existing',
    consignerName: data.consigner_name,
    consignerNumber: data.consigner_number || undefined,
    consignerAddress: data.consigner_address || undefined,
    consignerPhone: data.consigner_phone || undefined,
    consignerEmail: data.consigner_email || undefined,
    intakeMode: data.intake_mode as 'detection' | 'general' | 'email' | null,
    status: data.status as 'draft' | 'signed',
    items: (data.items || []) as IntakeForm['items'],
    enabledFields: data.enabled_fields as IntakeForm['enabledFields'],
    signatureData: data.signature_data || undefined,
    initials1: data.initials_1 || undefined,
    initials2: data.initials_2 || undefined,
    initials3: data.initials_3 || undefined,
    acceptedBy: data.accepted_by || undefined,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    signedAt: data.signed_at ? new Date(data.signed_at) : undefined,
  };
}
