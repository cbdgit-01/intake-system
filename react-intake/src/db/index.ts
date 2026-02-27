/**
 * Database Layer - Offline-first with Railway backend sync
 *
 * All operations are performed locally first (IndexedDB),
 * then synced to the backend when online.
 */

import { IntakeForm, Consigner } from '../types';
import {
  saveFormLocally,
  getFormLocally,
  getAllFormsLocally,
  deleteFormLocally,
  clearAllFormsLocally,
  LocalForm,
  getUnsyncedCount,
} from './localDb';
import {
  processSyncQueue,
  fullSync,
  subscribeToRealtimeUpdates,
  setupOnlineSync,
  onSyncComplete,
} from './syncService';
import { consignersApi, formsApi, getToken } from '../lib/api';

// Re-export sync functions
export {
  processSyncQueue,
  fullSync,
  subscribeToRealtimeUpdates,
  setupOnlineSync,
  onSyncComplete,
  getUnsyncedCount,
};

// ============================================
// FORM OPERATIONS (Local-first)
// ============================================

export async function saveForm(form: IntakeForm): Promise<string> {
  await saveFormLocally(form);

  if (navigator.onLine && getToken()) {
    processSyncQueue().catch(console.error);
  }

  return form.id;
}

export async function loadForm(formId: string): Promise<IntakeForm | undefined> {
  const localForm = await getFormLocally(formId);
  if (localForm) {
    return localFormToIntakeForm(localForm);
  }
  return undefined;
}

export async function getAllForms(status?: 'draft' | 'signed'): Promise<IntakeForm[]> {
  const localForms = await getAllFormsLocally();
  let forms = localForms.map(localFormToIntakeForm);

  if (status) {
    forms = forms.filter(f => f.status === status);
  }

  return forms;
}

export async function deleteForm(formId: string): Promise<void> {
  console.log('[DB] Deleting form:', formId);
  await deleteFormLocally(formId);

  if (navigator.onLine && getToken()) {
    console.log('[DB] Syncing delete to remote');
    try {
      await processSyncQueue();
      console.log('[DB] Delete synced successfully');
    } catch (error) {
      console.error('[DB] Failed to sync delete:', error);
    }
  }
}

export async function factoryResetDatabase(): Promise<void> {
  console.log('[DB] Factory reset - clearing all data');

  if (navigator.onLine && getToken()) {
    try {
      console.log('[DB] Clearing remote data');
      await formsApi.deleteAll();
      await consignersApi.deleteAll();
      console.log('[DB] Remote data cleared');
    } catch (error) {
      console.error('[DB] Failed to clear remote database:', error);
    }
  }

  await clearAllFormsLocally();
  console.log('[DB] Local data cleared');
}

export async function updateFormConsignerNumber(formId: string, consignerNumber: string): Promise<void> {
  const form = await getFormLocally(formId);
  if (form) {
    form.consignerNumber = consignerNumber;
    await saveFormLocally(form);

    if (navigator.onLine && getToken()) {
      processSyncQueue().catch(console.error);
    }
  }
}

export async function autoLinkFormsByName(consignerName: string, consignerNumber: string): Promise<number> {
  if (!consignerName || !consignerNumber) return 0;

  const nameLower = consignerName.toLowerCase().trim();
  const allForms = await getAllFormsLocally();

  const formsToLink = allForms.filter(
    f => !f.consignerNumber && f.consignerName?.toLowerCase().trim() === nameLower
  );

  for (const form of formsToLink) {
    form.consignerNumber = consignerNumber;
    await saveFormLocally(form);
  }

  if (formsToLink.length > 0 && navigator.onLine && getToken()) {
    processSyncQueue().catch(console.error);
  }

  return formsToLink.length;
}

export async function getMostRecentForm(): Promise<IntakeForm | undefined> {
  const forms = await getAllFormsLocally();
  if (forms.length === 0) return undefined;
  return localFormToIntakeForm(forms[0]);
}

// ============================================
// CONSIGNER OPERATIONS (via backend API)
// ============================================

export async function saveConsigner(consigner: Omit<Consigner, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  if (!navigator.onLine || !getToken()) return;

  try {
    await consignersApi.save({
      consignerNumber: consigner.consignerNumber,
      name: consigner.name,
      address: consigner.address || undefined,
      phone: consigner.phone || undefined,
      email: consigner.email || undefined,
    });
  } catch (error) {
    console.error('Failed to save consigner:', error);
  }
}

export async function lookupConsigner(consignerNumber?: string, name?: string): Promise<Consigner | undefined> {
  if (!navigator.onLine || !getToken()) return undefined;

  try {
    const result = await consignersApi.lookup({ number: consignerNumber, name });
    if (!result) return undefined;

    return {
      id: result.id,
      consignerNumber: result.consignerNumber || '',
      name: result.name,
      address: result.address || '',
      phone: result.phone || '',
      email: result.email || undefined,
      createdAt: result.createdAt ? new Date(result.createdAt) : undefined,
      updatedAt: result.updatedAt ? new Date(result.updatedAt) : undefined,
    };
  } catch {
    return undefined;
  }
}

export async function searchConsigners(query: string): Promise<Consigner[]> {
  if (!navigator.onLine || !getToken()) return [];

  try {
    const results = await consignersApi.search(query);
    return results.map(d => ({
      id: d.id,
      consignerNumber: d.consignerNumber || '',
      name: d.name,
      address: d.address || '',
      phone: d.phone || '',
      email: d.email || undefined,
      createdAt: d.createdAt ? new Date(d.createdAt) : undefined,
      updatedAt: d.updatedAt ? new Date(d.updatedAt) : undefined,
    }));
  } catch {
    return [];
  }
}

export async function getAllConsigners(): Promise<Consigner[]> {
  if (!navigator.onLine || !getToken()) return [];

  try {
    const results = await consignersApi.list();
    return results.map(d => ({
      id: d.id,
      consignerNumber: d.consignerNumber || '',
      name: d.name,
      address: d.address || '',
      phone: d.phone || '',
      email: d.email || undefined,
      createdAt: d.createdAt ? new Date(d.createdAt) : undefined,
      updatedAt: d.updatedAt ? new Date(d.updatedAt) : undefined,
    }));
  } catch {
    return [];
  }
}

export async function getFormsByConsigner(consignerNumber: string): Promise<IntakeForm[]> {
  const allForms = await getAllFormsLocally();
  return allForms
    .filter(f => f.consignerNumber === consignerNumber)
    .map(localFormToIntakeForm);
}

export async function getUniqueConsignersFromForms(): Promise<Map<string, string>> {
  const allForms = await getAllFormsLocally();
  const consignersMap = new Map<string, string>();

  allForms.forEach((form) => {
    if (form.consignerNumber && !consignersMap.has(form.consignerNumber)) {
      consignersMap.set(form.consignerNumber, form.consignerName);
    }
  });

  return consignersMap;
}

export async function searchConsignersFromForms(query: string): Promise<Array<{
  name: string;
  consignerNumber: string;
  address?: string;
  phone?: string;
}>> {
  const allForms = await getAllFormsLocally();
  const queryLower = query.toLowerCase();

  const seen = new Map<string, {
    name: string;
    consignerNumber: string;
    address?: string;
    phone?: string;
  }>();

  allForms
    .filter(form =>
      form.consignerName?.toLowerCase().includes(queryLower) ||
      form.consignerNumber?.toLowerCase().includes(queryLower)
    )
    .forEach(form => {
      const key = form.consignerNumber || form.consignerName || '';
      if (key && !seen.has(key)) {
        seen.set(key, {
          name: form.consignerName || '',
          consignerNumber: form.consignerNumber || '',
          address: form.consignerAddress || undefined,
          phone: form.consignerPhone || undefined,
        });
      }
    });

  return Array.from(seen.values()).slice(0, 10);
}

export async function updateConsignerAcrossForms(
  key: string,
  updates: Partial<Pick<IntakeForm, 'consignerName' | 'consignerNumber' | 'consignerAddress' | 'consignerCity' | 'consignerState' | 'consignerZip' | 'consignerPhone'>>
): Promise<number> {
  const allForms = await getAllFormsLocally();
  const formsToUpdate = allForms.filter(f =>
    f.consignerNumber === key || (!f.consignerNumber && f.consignerName === key)
  );
  for (const form of formsToUpdate) {
    await saveFormLocally({ ...form, ...updates, updatedAt: new Date() });
  }
  if (formsToUpdate.length > 0 && navigator.onLine && getToken()) {
    processSyncQueue().catch(console.error);
  }
  return formsToUpdate.length;
}

export async function deleteConsignerAllForms(key: string): Promise<number> {
  const allForms = await getAllFormsLocally();
  const formsToDelete = allForms.filter(f =>
    f.consignerNumber === key || (!f.consignerNumber && f.consignerName === key)
  );
  for (const form of formsToDelete) {
    await deleteFormLocally(form.localId);
  }
  return formsToDelete.length;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function localFormToIntakeForm(local: LocalForm): IntakeForm {
  // Strip LocalForm-only fields and return everything else as IntakeForm
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { localId, remoteId, synced, syncedAt, localUpdatedAt, ...formFields } = local;
  return { ...formFields, id: localId };
}
