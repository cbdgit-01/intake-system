/**
 * Database Layer - Offline-first with Supabase sync
 * 
 * All operations are performed locally first (IndexedDB),
 * then synced to Supabase when online.
 */

import { IntakeForm, Consigner, IntakeItem } from '../types';
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
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  // Always save locally first
  await saveFormLocally(form);
  
  // Trigger sync if online
  if (navigator.onLine && isSupabaseConfigured()) {
    // Don't await - let it sync in background
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
  await deleteFormLocally(formId);
  
  // Trigger sync if online
  if (navigator.onLine && isSupabaseConfigured()) {
    processSyncQueue().catch(console.error);
  }
}

export async function factoryResetDatabase(): Promise<void> {
  await clearAllFormsLocally();
  
  // Also clear remote if online
  if (navigator.onLine && isSupabaseConfigured()) {
    try {
      await supabase.from('forms').delete().neq('id', '');
      await supabase.from('consigners').delete().neq('id', '');
    } catch (error) {
      console.error('Failed to clear remote database:', error);
    }
  }
}

export async function updateFormConsignerNumber(formId: string, consignerNumber: string): Promise<void> {
  const form = await getFormLocally(formId);
  if (form) {
    form.consignerNumber = consignerNumber;
    await saveFormLocally(form);
    
    if (navigator.onLine && isSupabaseConfigured()) {
      processSyncQueue().catch(console.error);
    }
  }
}

export async function autoLinkFormsByName(consignerName: string, consignerNumber: string): Promise<number> {
  if (!consignerName || !consignerNumber) return 0;

  const nameLower = consignerName.toLowerCase().trim();
  const allForms = await getAllFormsLocally();
  
  // Find forms with same name but no consigner number
  const formsToLink = allForms.filter(
    f => !f.consignerNumber && f.consignerName?.toLowerCase().trim() === nameLower
  );

  for (const form of formsToLink) {
    form.consignerNumber = consignerNumber;
    await saveFormLocally(form);
  }

  if (formsToLink.length > 0 && navigator.onLine && isSupabaseConfigured()) {
    processSyncQueue().catch(console.error);
  }

  return formsToLink.length;
}

export async function getMostRecentForm(): Promise<IntakeForm | undefined> {
  const forms = await getAllFormsLocally();
  if (forms.length === 0) return undefined;
  return localFormToIntakeForm(forms[0]); // Already sorted by updated time
}

// ============================================
// CONSIGNER OPERATIONS
// ============================================

export async function saveConsigner(consigner: Omit<Consigner, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  if (!navigator.onLine || !isSupabaseConfigured()) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: existing } = await supabase
      .from('consigners')
      .select('id')
      .eq('number', consigner.consignerNumber)
      .single();

    if (existing) {
      await supabase
        .from('consigners')
        .update({
          name: consigner.name,
          address: consigner.address || null,
          phone: consigner.phone || null,
          email: consigner.email || null,
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('consigners')
        .insert({
          name: consigner.name,
          number: consigner.consignerNumber,
          address: consigner.address || null,
          phone: consigner.phone || null,
          email: consigner.email || null,
          created_by: user?.id || null,
        });
    }
  } catch (error) {
    console.error('Failed to save consigner:', error);
  }
}

export async function lookupConsigner(consignerNumber?: string, name?: string): Promise<Consigner | undefined> {
  if (!navigator.onLine || !isSupabaseConfigured()) return undefined;

  try {
    let query = supabase.from('consigners').select('*');

    if (consignerNumber) {
      query = query.eq('number', consignerNumber);
    } else if (name) {
      query = query.ilike('name', `${name}%`);
    } else {
      return undefined;
    }

    const { data, error } = await query.limit(1).single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      consignerNumber: data.number || '',
      name: data.name,
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } catch {
    return undefined;
  }
}

export async function searchConsigners(query: string): Promise<Consigner[]> {
  if (!navigator.onLine || !isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('consigners')
      .select('*')
      .or(`name.ilike.%${query}%,number.ilike.%${query}%`)
      .limit(10);

    if (error) return [];

    return (data || []).map(d => ({
      id: d.id,
      consignerNumber: d.number || '',
      name: d.name,
      address: d.address || '',
      phone: d.phone || '',
      email: d.email || undefined,
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at),
    }));
  } catch {
    return [];
  }
}

export async function getAllConsigners(): Promise<Consigner[]> {
  if (!navigator.onLine || !isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('consigners')
      .select('*')
      .order('name');

    if (error) return [];

    return (data || []).map(d => ({
      id: d.id,
      consignerNumber: d.number || '',
      name: d.name,
      address: d.address || '',
      phone: d.phone || '',
      email: d.email || undefined,
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at),
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

// ============================================
// HELPER FUNCTIONS
// ============================================

function localFormToIntakeForm(local: LocalForm): IntakeForm {
  return {
    id: local.localId,
    consignerType: local.consignerType,
    consignerName: local.consignerName,
    consignerNumber: local.consignerNumber,
    consignerAddress: local.consignerAddress,
    consignerPhone: local.consignerPhone,
    consignerEmail: local.consignerEmail,
    intakeMode: local.intakeMode,
    items: local.items as IntakeItem[],
    enabledFields: local.enabledFields,
    status: local.status,
    signatureData: local.signatureData,
    initials1: local.initials1,
    initials2: local.initials2,
    initials3: local.initials3,
    acceptedBy: local.acceptedBy,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
    signedAt: local.signedAt,
  };
}
