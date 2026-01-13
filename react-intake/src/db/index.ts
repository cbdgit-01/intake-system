import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { IntakeForm, Consigner, IntakeItem } from '../types';
import {
  saveFormLocally,
  loadFormLocally,
  getAllFormsLocally,
  deleteFormLocally,
  saveConsignerLocally,
  searchConsignersLocally,
  factoryResetLocal,
  localDb,
  LocalConsigner
} from './localDb';
import { syncToCloud } from './syncService';

// ============================================
// FORM OPERATIONS (Local-First)
// ============================================

export async function saveForm(form: IntakeForm): Promise<string> {
  // Always save locally first
  await saveFormLocally(form);
  
  // Try to sync to cloud if online
  if (navigator.onLine && isSupabaseConfigured()) {
    // Trigger background sync
    syncToCloud().catch(console.error);
  }
  
  return form.id;
}

export async function loadForm(formId: string): Promise<IntakeForm | undefined> {
  // Try local first
  const localForm = await loadFormLocally(formId);
  if (localForm) return localForm;
  
  // Fall back to cloud if not found locally
  if (navigator.onLine && isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (error || !data) return undefined;
    
    return mapDbFormToIntakeForm(data);
  }
  
  return undefined;
}

export async function getAllForms(status?: 'draft' | 'signed'): Promise<IntakeForm[]> {
  // Get from local database
  return await getAllFormsLocally(status);
}

export async function deleteForm(formId: string): Promise<void> {
  await deleteFormLocally(formId);
  
  // Sync deletion to cloud
  if (navigator.onLine && isSupabaseConfigured()) {
    syncToCloud().catch(console.error);
  }
}

export async function factoryResetDatabase(): Promise<void> {
  // Clear local database
  await factoryResetLocal();
  
  // Clear cloud if online
  if (navigator.onLine && isSupabaseConfigured()) {
    await supabase.from('forms').delete().neq('id', '');
    await supabase.from('consigners').delete().neq('id', '');
  }
}

export async function updateFormConsignerNumber(formId: string, consignerNumber: string): Promise<void> {
  const form = await loadFormLocally(formId);
  if (form) {
    form.consignerNumber = consignerNumber;
    await saveFormLocally(form);
  }
  
  if (navigator.onLine && isSupabaseConfigured()) {
    syncToCloud().catch(console.error);
  }
}

export async function autoLinkFormsByName(consignerName: string, consignerNumber: string): Promise<number> {
  if (!consignerName || !consignerNumber) return 0;

  const nameLower = consignerName.toLowerCase().trim();
  const allForms = await getAllFormsLocally();
  
  let linkedCount = 0;
  
  for (const form of allForms) {
    if (!form.consignerNumber && form.consignerName?.toLowerCase().trim() === nameLower) {
      form.consignerNumber = consignerNumber;
      await saveFormLocally(form);
      linkedCount++;
    }
  }
  
  if (linkedCount > 0 && navigator.onLine) {
    syncToCloud().catch(console.error);
  }

  return linkedCount;
}

export async function getMostRecentForm(): Promise<IntakeForm | undefined> {
  const forms = await getAllFormsLocally();
  return forms[0];
}

// ============================================
// CONSIGNER OPERATIONS
// ============================================

export async function saveConsigner(consigner: Omit<Consigner, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  const fullConsigner: Consigner = {
    ...consigner,
    id: crypto.randomUUID(),
    address: consigner.address || '',
    phone: consigner.phone || '',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await saveConsignerLocally(fullConsigner);
  
  // Also save to cloud if online
  if (navigator.onLine && isSupabaseConfigured()) {
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
  }
}

export async function lookupConsigner(consignerNumber?: string, name?: string): Promise<Consigner | undefined> {
  // Try local first
  if (consignerNumber) {
    const local = await localDb.consigners.where('consignerNumber').equals(consignerNumber).first();
    if (local) {
      const { _syncStatus, _lastModified, ...consigner } = local;
      return consigner as Consigner;
    }
  }
  
  // Fall back to cloud
  if (navigator.onLine && isSupabaseConfigured()) {
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

    return mapDbConsignerToConsigner(data);
  }
  
  return undefined;
}

export async function searchConsigners(query: string): Promise<Consigner[]> {
  // Search locally first
  const localResults = await searchConsignersLocally(query);
  if (localResults.length > 0 || !navigator.onLine) {
    return localResults;
  }
  
  // Fall back to cloud
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('consigners')
      .select('*')
      .or(`name.ilike.%${query}%,number.ilike.%${query}%`)
      .limit(10);

    if (error) return [];

    return (data || []).map(mapDbConsignerToConsigner);
  }
  
  return [];
}

export async function getAllConsigners(): Promise<Consigner[]> {
  const local = await localDb.consigners.orderBy('name').toArray();
  if (local.length > 0 || !navigator.onLine) {
    return local.map(({ _syncStatus, _lastModified, ...c }: LocalConsigner) => c as Consigner);
  }
  
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('consigners')
      .select('*')
      .order('name');

    if (error) return [];

    return (data || []).map(mapDbConsignerToConsigner);
  }
  
  return [];
}

export async function getFormsByConsigner(consignerNumber: string): Promise<IntakeForm[]> {
  const allForms = await getAllFormsLocally();
  return allForms.filter(f => f.consignerNumber === consignerNumber);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbFormToIntakeForm(data: any): IntakeForm {
  return {
    id: data.id,
    consignerType: data.consigner_type,
    consignerName: data.consigner_name,
    consignerNumber: data.consigner_number || undefined,
    consignerAddress: data.consigner_address || undefined,
    consignerPhone: data.consigner_phone || undefined,
    consignerEmail: data.consigner_email || undefined,
    intakeMode: data.intake_mode || undefined,
    status: data.status,
    items: (data.items || []) as IntakeItem[],
    enabledFields: data.enabled_fields || undefined,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbConsignerToConsigner(data: any): Consigner {
  return {
    id: data.id,
    consignerNumber: data.number || '',
    name: data.name,
    address: data.address || undefined,
    phone: data.phone || undefined,
    email: data.email || undefined,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}
