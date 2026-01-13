import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  getSyncQueue,
  removeSyncQueueItem,
  incrementSyncRetry,
  markFormSynced,
  markFormSyncError,
  importFormsFromCloud,
} from './localDb';
import { IntakeForm, IntakeItem, FieldId } from '../types';

const MAX_RETRIES = 3;
let isSyncing = false;
let syncListeners: Array<(status: SyncStatus) => void> = [];

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  lastError: string | null;
}

let currentStatus: SyncStatus = {
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  lastError: null
};

// ============================================
// STATUS MANAGEMENT
// ============================================

export function getSyncStatus(): SyncStatus {
  return { ...currentStatus };
}

export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  syncListeners.push(listener);
  listener(currentStatus);
  return () => {
    syncListeners = syncListeners.filter(l => l !== listener);
  };
}

function updateStatus(updates: Partial<SyncStatus>) {
  currentStatus = { ...currentStatus, ...updates };
  syncListeners.forEach(l => l(currentStatus));
}

// ============================================
// ONLINE/OFFLINE DETECTION
// ============================================

export function initOnlineListener() {
  const handleOnline = () => {
    updateStatus({ isOnline: true });
    // Trigger sync when coming back online
    syncToCloud();
  };
  
  const handleOffline = () => {
    updateStatus({ isOnline: false });
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Initial state
  updateStatus({ isOnline: navigator.onLine });
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ============================================
// SYNC TO CLOUD
// ============================================

export async function syncToCloud(): Promise<void> {
  if (isSyncing || !navigator.onLine || !isSupabaseConfigured()) {
    return;
  }
  
  isSyncing = true;
  updateStatus({ isSyncing: true });
  
  try {
    const queue = await getSyncQueue();
    updateStatus({ pendingCount: queue.length });
    
    const { data: { user } } = await supabase.auth.getUser();
    
    for (const item of queue) {
      if (item.retryCount >= MAX_RETRIES) {
        console.error(`Sync item ${item.id} exceeded max retries, skipping`);
        await removeSyncQueueItem(item.id!);
        continue;
      }
      
      try {
        if (item.type === 'form') {
          await syncFormItem(item, user?.id);
          await removeSyncQueueItem(item.id!);
          
          // Mark local form as synced
          if (item.action !== 'delete') {
            await markFormSynced(item.entityId);
          }
        }
      } catch (error) {
        console.error(`Sync error for ${item.type} ${item.entityId}:`, error);
        await incrementSyncRetry(item.id!);
        
        if (item.type === 'form' && item.action !== 'delete') {
          await markFormSyncError(item.entityId, String(error));
        }
      }
    }
    
    const remainingQueue = await getSyncQueue();
    updateStatus({ 
      pendingCount: remainingQueue.length,
      lastSyncTime: Date.now(),
      lastError: null
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    updateStatus({ lastError: String(error) });
  } finally {
    isSyncing = false;
    updateStatus({ isSyncing: false });
  }
}

async function syncFormItem(item: { action: string; entityId: string; data?: unknown }, userId?: string): Promise<void> {
  if (item.action === 'delete') {
    const { error } = await supabase
      .from('forms')
      .delete()
      .eq('id', item.entityId);
    
    if (error) throw error;
    
  } else if (item.action === 'update' || item.action === 'create') {
    const form = item.data as IntakeForm;
    
    const formData = {
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
      created_by: userId || null,
      signed_by: form.status === 'signed' ? userId : null,
    };
    
    const { error } = await supabase
      .from('forms')
      .upsert(formData);
    
    if (error) throw error;
  }
}

// ============================================
// SYNC FROM CLOUD (Initial Load)
// ============================================

export async function syncFromCloud(): Promise<void> {
  if (!navigator.onLine || !isSupabaseConfigured()) {
    return;
  }
  
  try {
    const { data: forms, error } = await supabase
      .from('forms')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    
    if (forms && forms.length > 0) {
      const mappedForms: IntakeForm[] = forms.map(data => ({
        id: data.id,
        consignerType: data.consigner_type as 'new' | 'existing',
        consignerName: data.consigner_name,
        consignerNumber: data.consigner_number || undefined,
        consignerAddress: data.consigner_address || undefined,
        consignerPhone: data.consigner_phone || undefined,
        consignerEmail: data.consigner_email || undefined,
        intakeMode: data.intake_mode as 'detection' | 'general' | 'email' | null,
        status: data.status as 'draft' | 'signed',
        items: (data.items as unknown as IntakeItem[]) || [],
        enabledFields: (data.enabled_fields as unknown as Record<FieldId, boolean>) || undefined,
        signatureData: data.signature_data || undefined,
        initials1: data.initials_1 || undefined,
        initials2: data.initials_2 || undefined,
        initials3: data.initials_3 || undefined,
        acceptedBy: data.accepted_by || undefined,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        signedAt: data.signed_at ? new Date(data.signed_at) : undefined,
      }));
      
      await importFormsFromCloud(mappedForms);
    }
    
    updateStatus({ lastSyncTime: Date.now() });
    
  } catch (error) {
    console.error('Error syncing from cloud:', error);
  }
}

// ============================================
// FULL BIDIRECTIONAL SYNC
// ============================================

/**
 * Performs full bidirectional sync: pushes local changes and pulls cloud changes
 */
export async function syncFull(): Promise<void> {
  if (!navigator.onLine || !isSupabaseConfigured()) {
    return;
  }

  // Push local changes to cloud
  await syncToCloud();

  // Pull cloud changes to local (to see changes from other devices)
  await syncFromCloud();
}

// ============================================
// PERIODIC SYNC
// ============================================

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startPeriodicSync(intervalMs: number = 30000) {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      // Perform full bidirectional sync (push + pull)
      syncFull();
    }
  }, intervalMs);
}

export function stopPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

