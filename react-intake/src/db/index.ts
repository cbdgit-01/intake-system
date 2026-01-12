import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { IntakeForm, Consigner, Item } from '../types';

// ============================================
// FORM OPERATIONS
// ============================================

export async function saveForm(form: IntakeForm): Promise<string> {
  if (!isSupabaseConfigured()) {
    console.error('Supabase not configured');
    return form.id;
  }

  const { data: { user } } = await supabase.auth.getUser();
  
  // Check if form exists
  const { data: existing } = await supabase
    .from('forms')
    .select('id')
    .eq('id', form.id)
    .single();

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
    items: form.items as unknown as Record<string, unknown>[],
    enabled_fields: form.enabledFields || null,
    signature_data: form.signatureData || null,
    initials_1: form.initials1 || null,
    initials_2: form.initials2 || null,
    initials_3: form.initials3 || null,
    accepted_by: form.acceptedBy || null,
    signed_at: form.signedAt || null,
    created_by: user?.id || null,
    signed_by: form.status === 'signed' ? user?.id : null,
  };

  if (existing) {
    const { error } = await supabase
      .from('forms')
      .update(formData)
      .eq('id', form.id);
    
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('forms')
      .insert(formData);
    
    if (error) throw error;
  }

  return form.id;
}

export async function loadForm(formId: string): Promise<IntakeForm | undefined> {
  if (!isSupabaseConfigured()) return undefined;

  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('id', formId)
    .single();

  if (error || !data) return undefined;

  return mapDbFormToIntakeForm(data);
}

export async function getAllForms(status?: 'draft' | 'signed'): Promise<IntakeForm[]> {
  if (!isSupabaseConfigured()) return [];

  let query = supabase
    .from('forms')
    .select('*')
    .order('updated_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching forms:', error);
    return [];
  }

  return (data || []).map(mapDbFormToIntakeForm);
}

export async function deleteForm(formId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('forms')
    .delete()
    .eq('id', formId);

  if (error) throw error;
}

export async function factoryResetDatabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  // Delete all forms (admin only, enforced by RLS)
  await supabase.from('forms').delete().neq('id', '');
  
  // Delete all consigners
  await supabase.from('consigners').delete().neq('id', '');
}

export async function updateFormConsignerNumber(formId: string, consignerNumber: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('forms')
    .update({ consigner_number: consignerNumber })
    .eq('id', formId);

  if (error) throw error;
}

export async function autoLinkFormsByName(consignerName: string, consignerNumber: string): Promise<number> {
  if (!isSupabaseConfigured() || !consignerName || !consignerNumber) return 0;

  const nameLower = consignerName.toLowerCase().trim();

  // Find all forms with same name but no consigner number
  const { data: formsToLink, error } = await supabase
    .from('forms')
    .select('id, consigner_name')
    .is('consigner_number', null);

  if (error || !formsToLink) return 0;

  // Filter by name (case-insensitive)
  const matchingForms = formsToLink.filter(
    f => f.consigner_name?.toLowerCase().trim() === nameLower
  );

  // Update each form
  for (const form of matchingForms) {
    await supabase
      .from('forms')
      .update({ consigner_number: consignerNumber })
      .eq('id', form.id);
  }

  return matchingForms.length;
}

export async function getMostRecentForm(): Promise<IntakeForm | undefined> {
  if (!isSupabaseConfigured()) return undefined;

  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return undefined;

  return mapDbFormToIntakeForm(data);
}

// ============================================
// CONSIGNER OPERATIONS
// ============================================

export async function saveConsigner(consigner: Omit<Consigner, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { data: { user } } = await supabase.auth.getUser();

  // Check if consigner exists
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

export async function lookupConsigner(consignerNumber?: string, name?: string): Promise<Consigner | undefined> {
  if (!isSupabaseConfigured()) return undefined;

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

export async function searchConsigners(query: string): Promise<Consigner[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('consigners')
    .select('*')
    .or(`name.ilike.%${query}%,number.ilike.%${query}%`)
    .limit(10);

  if (error) return [];

  return (data || []).map(mapDbConsignerToConsigner);
}

export async function getAllConsigners(): Promise<Consigner[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('consigners')
    .select('*')
    .order('name');

  if (error) return [];

  return (data || []).map(mapDbConsignerToConsigner);
}

export async function getFormsByConsigner(consignerNumber: string): Promise<IntakeForm[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('consigner_number', consignerNumber)
    .order('updated_at', { ascending: false });

  if (error) return [];

  return (data || []).map(mapDbFormToIntakeForm);
}

export async function getUniqueConsignersFromForms(): Promise<Map<string, string>> {
  if (!isSupabaseConfigured()) return new Map();

  const { data, error } = await supabase
    .from('forms')
    .select('consigner_name, consigner_number')
    .not('consigner_number', 'is', null);

  if (error || !data) return new Map();

  const consignersMap = new Map<string, string>();
  data.forEach((form) => {
    if (form.consigner_number && !consignersMap.has(form.consigner_number)) {
      consignersMap.set(form.consigner_number, form.consigner_name);
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
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('forms')
    .select('consigner_name, consigner_number, consigner_address, consigner_phone')
    .or(`consigner_name.ilike.%${query}%,consigner_number.ilike.%${query}%`)
    .order('updated_at', { ascending: false });

  if (error || !data) return [];

  // Deduplicate by consignerNumber or name
  const seen = new Map<string, {
    name: string;
    consignerNumber: string;
    address?: string;
    phone?: string;
  }>();

  data.forEach(form => {
    const key = form.consigner_number || form.consigner_name || '';
    if (key && !seen.has(key)) {
      seen.set(key, {
        name: form.consigner_name || '',
        consignerNumber: form.consigner_number || '',
        address: form.consigner_address || undefined,
        phone: form.consigner_phone || undefined,
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
    items: (data.items || []) as Item[],
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
