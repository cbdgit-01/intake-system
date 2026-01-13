import Dexie, { Table } from 'dexie';
import { IntakeForm, Consigner } from '../types';

// Extend form with sync metadata
export interface LocalForm extends IntakeForm {
  _syncStatus: 'synced' | 'pending' | 'error';
  _lastModified: number;
  _syncError?: string;
}

export interface LocalConsigner extends Consigner {
  _syncStatus: 'synced' | 'pending' | 'error';
  _lastModified: number;
}

export interface SyncQueue {
  id?: number;
  type: 'form' | 'consigner';
  action: 'create' | 'update' | 'delete';
  entityId: string;
  data?: unknown;
  timestamp: number;
  retryCount: number;
}

class LocalDatabase extends Dexie {
  forms!: Table<LocalForm, string>;
  consigners!: Table<LocalConsigner, string>;
  syncQueue!: Table<SyncQueue, number>;

  constructor() {
    super('cbd-intake-offline');
    
    this.version(1).stores({
      forms: 'id, consignerNumber, consignerName, status, _syncStatus, _lastModified',
      consigners: 'id, consignerNumber, name, _syncStatus',
      syncQueue: '++id, type, action, entityId, timestamp'
    });
  }
}

export const localDb = new LocalDatabase();

// ============================================
// LOCAL FORM OPERATIONS
// ============================================

export async function saveFormLocally(form: IntakeForm): Promise<void> {
  const localForm: LocalForm = {
    ...form,
    _syncStatus: 'pending',
    _lastModified: Date.now()
  };
  
  await localDb.forms.put(localForm);
  
  // Add to sync queue
  await localDb.syncQueue.add({
    type: 'form',
    action: 'update',
    entityId: form.id,
    data: form,
    timestamp: Date.now(),
    retryCount: 0
  });
}

export async function loadFormLocally(formId: string): Promise<IntakeForm | undefined> {
  const form = await localDb.forms.get(formId);
  if (!form) return undefined;
  
  // Strip sync metadata
  const { _syncStatus, _lastModified, _syncError, ...intakeForm } = form;
  return intakeForm as IntakeForm;
}

export async function getAllFormsLocally(status?: 'draft' | 'signed'): Promise<IntakeForm[]> {
  let forms: LocalForm[];
  
  if (status) {
    forms = await localDb.forms.where('status').equals(status).reverse().sortBy('_lastModified');
  } else {
    forms = await localDb.forms.reverse().sortBy('_lastModified');
  }
  
  // Strip sync metadata
  return forms.map(({ _syncStatus, _lastModified, _syncError, ...form }) => form as IntakeForm);
}

export async function deleteFormLocally(formId: string): Promise<void> {
  await localDb.forms.delete(formId);
  
  // Add delete to sync queue
  await localDb.syncQueue.add({
    type: 'form',
    action: 'delete',
    entityId: formId,
    timestamp: Date.now(),
    retryCount: 0
  });
}

export async function clearAllFormsLocally(): Promise<void> {
  const forms = await localDb.forms.toArray();
  
  // Queue all deletions
  for (const form of forms) {
    await localDb.syncQueue.add({
      type: 'form',
      action: 'delete',
      entityId: form.id,
      timestamp: Date.now(),
      retryCount: 0
    });
  }
  
  await localDb.forms.clear();
}

// ============================================
// LOCAL CONSIGNER OPERATIONS
// ============================================

export async function saveConsignerLocally(consigner: Consigner): Promise<void> {
  const localConsigner: LocalConsigner = {
    ...consigner,
    id: consigner.id || crypto.randomUUID(),
    address: consigner.address || '',
    phone: consigner.phone || '',
    _syncStatus: 'pending',
    _lastModified: Date.now()
  };
  
  // Check if exists by number
  const existing = await localDb.consigners.where('consignerNumber').equals(consigner.consignerNumber).first();
  
  if (existing) {
    await localDb.consigners.update(existing.id!, localConsigner);
  } else {
    await localDb.consigners.add(localConsigner);
  }
}

export async function searchConsignersLocally(query: string): Promise<Consigner[]> {
  const queryLower = query.toLowerCase();
  
  const consigners = await localDb.consigners
    .filter((c: LocalConsigner) => 
      c.name.toLowerCase().includes(queryLower) ||
      c.consignerNumber.toLowerCase().includes(queryLower)
    )
    .limit(10)
    .toArray();
  
  return consigners.map(({ _syncStatus, _lastModified, ...c }: LocalConsigner) => c as Consigner);
}

// ============================================
// SYNC STATUS
// ============================================

export async function getPendingSyncCount(): Promise<number> {
  return await localDb.syncQueue.count();
}

export async function getPendingForms(): Promise<LocalForm[]> {
  return await localDb.forms.where('_syncStatus').equals('pending').toArray();
}

export async function markFormSynced(formId: string): Promise<void> {
  await localDb.forms.update(formId, { _syncStatus: 'synced' });
}

export async function markFormSyncError(formId: string, error: string): Promise<void> {
  await localDb.forms.update(formId, { _syncStatus: 'error', _syncError: error });
}

export async function getSyncQueue(): Promise<SyncQueue[]> {
  return await localDb.syncQueue.orderBy('timestamp').toArray();
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  await localDb.syncQueue.delete(id);
}

export async function incrementSyncRetry(id: number): Promise<void> {
  const item = await localDb.syncQueue.get(id);
  if (item) {
    await localDb.syncQueue.update(id, { retryCount: item.retryCount + 1 });
  }
}

// ============================================
// BULK IMPORT FROM CLOUD
// ============================================

export async function importFormsFromCloud(forms: IntakeForm[]): Promise<void> {
  const localForms: LocalForm[] = forms.map(form => ({
    ...form,
    _syncStatus: 'synced' as const,
    _lastModified: new Date(form.updatedAt).getTime()
  }));
  
  await localDb.forms.bulkPut(localForms);
}

export async function factoryResetLocal(): Promise<void> {
  await localDb.forms.clear();
  await localDb.consigners.clear();
  await localDb.syncQueue.clear();
}

