// Field configuration types
export interface FieldConfig {
  label: string;
  type: 'text' | 'textarea' | 'number' | 'currency' | 'status' | 'select';
  required: boolean;
  defaultEnabled: boolean;
  pdfHeader: string;
  pdfWidth: number;
  options?: string[];
}

export type FieldId = 'name' | 'notes' | 'quantity' | 'price' | 'status' | 'condition' | 'category' | 'dimensions';

export const AVAILABLE_FIELDS: Record<FieldId, FieldConfig> = {
  name: {
    label: 'Item Name',
    type: 'text',
    required: true,
    defaultEnabled: true,
    pdfHeader: 'Title',
    pdfWidth: 2.2,
  },
  notes: {
    label: 'Notes',
    type: 'textarea',
    required: false,
    defaultEnabled: true,
    pdfHeader: 'Notes',
    pdfWidth: 1.5,
  },
  quantity: {
    label: 'Quantity',
    type: 'number',
    required: false,
    defaultEnabled: true,
    pdfHeader: 'QTY',
    pdfWidth: 0.5,
  },
  price: {
    label: 'Price ($)',
    type: 'currency',
    required: false,
    defaultEnabled: false,
    pdfHeader: 'Price',
    pdfWidth: 0.7,
  },
  status: {
    label: 'Accept/Reject',
    type: 'status',
    required: false,
    defaultEnabled: false,
    pdfHeader: 'Status',
    pdfWidth: 0.5,
  },
  condition: {
    label: 'Condition',
    type: 'select',
    options: ['Excellent', 'Good', 'Fair', 'Poor'],
    required: false,
    defaultEnabled: false,
    pdfHeader: 'Cond.',
    pdfWidth: 0.6,
  },
  category: {
    label: 'Category',
    type: 'select',
    options: ['Furniture', 'Decor', 'Lighting', 'Art', 'Textiles', 'Other'],
    required: false,
    defaultEnabled: false,
    pdfHeader: 'Category',
    pdfWidth: 0.8,
  },
  dimensions: {
    label: 'Dimensions',
    type: 'text',
    required: false,
    defaultEnabled: false,
    pdfHeader: 'Dims',
    pdfWidth: 1.0,
  },
};

// Item type
export interface IntakeItem {
  id: string;
  name: string;
  notes: string;
  quantity: number;
  price: number;
  status: 'Accept' | 'Reject';
  condition: string;
  category: string;
  dimensions: string;
  photos: string[]; // Base64 encoded images
}

// Consigner type
export interface Consigner {
  id?: number;
  consignerNumber: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Form/Record type
export interface IntakeForm {
  id: string;
  consignerType: 'new' | 'existing';
  consignerName: string;
  consignerNumber?: string;
  consignerAddress?: string;
  consignerPhone?: string;
  consignerEmail?: string;
  intakeMode: 'detection' | 'general' | 'email' | null;
  items: IntakeItem[];
  enabledFields?: Record<FieldId, boolean>;
  status: 'draft' | 'signed';
  // Signature data
  signatureData?: string;
  initials1?: string;
  initials2?: string;
  initials3?: string;
  signatureDate?: string;
  acceptedBy?: string;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  signedAt?: Date;
}

// Alias for backwards compatibility
export type Item = IntakeItem;

// App navigation state
export type AppView = 'dashboard' | 'intake' | 'preview';
export type IntakeStep = 'consigner-type' | 'consigner-info' | 'item-entry' | 'preview';
export type IntakeMode = 'detection' | 'general' | 'email';

// Email parsing result (from Claude)
export interface ParsedEmailData {
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  items: Array<{
    name: string;
    status: 'approved' | 'rejected' | 'pending' | 'unknown';
    notes: string;
    quantity: number;
  }>;
  pickupRequired: boolean;
  pickupAddress: string | null;
  pickupDate: string | null;
  summary: string;
}

// Default enabled fields helper
export function getDefaultEnabledFields(): Record<FieldId, boolean> {
  const fields: Partial<Record<FieldId, boolean>> = {};
  (Object.keys(AVAILABLE_FIELDS) as FieldId[]).forEach((fieldId) => {
    fields[fieldId] = AVAILABLE_FIELDS[fieldId].defaultEnabled;
  });
  return fields as Record<FieldId, boolean>;
}

// Create empty item helper
export function createEmptyItem(): IntakeItem {
  return {
    id: crypto.randomUUID(),
    name: '',
    notes: '',
    quantity: 1,
    price: 0,
    status: 'Accept',
    condition: 'Good',
    category: 'Furniture',
    dimensions: '',
    photos: [],
  };
}


