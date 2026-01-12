import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { 
  IntakeForm, 
  IntakeItem, 
  FieldId, 
  AppView, 
  IntakeStep,
  IntakeMode,
  getDefaultEnabledFields,
  createEmptyItem,
  ParsedEmailData
} from '../types';
import { saveForm, loadForm, saveConsigner, autoLinkFormsByName } from '../db';

interface AppState {
  // Navigation
  currentView: AppView;
  intakeStep: IntakeStep;
  setView: (view: AppView) => void;
  setIntakeStep: (step: IntakeStep) => void;

  // Current form being edited
  currentForm: IntakeForm | null;
  isViewOnly: boolean;
  isEditingExisting: boolean;

  // Initialize new form
  initNewForm: () => void;
  
  // Load existing form
  loadExistingForm: (formId: string, viewOnly?: boolean) => Promise<boolean>;

  // Consigner info
  setConsignerType: (type: 'new' | 'existing') => void;
  setConsignerInfo: (info: Partial<Pick<IntakeForm, 'consignerName' | 'consignerNumber' | 'consignerAddress' | 'consignerPhone'>>) => void;

  // Intake mode
  setIntakeMode: (mode: IntakeMode) => void;

  // Items
  items: IntakeItem[];
  addItem: (item?: Partial<IntakeItem>) => void;
  updateItem: (index: number, updates: Partial<IntakeItem>) => void;
  removeItem: (index: number) => void;
  addPhotoToItem: (itemIndex: number, photoBase64: string) => void;
  removePhotoFromItem: (itemIndex: number, photoIndex: number) => void;
  setItemsFromEmail: (items: IntakeItem[]) => void;

  // Field configuration
  enabledFields: Record<FieldId, boolean>;
  toggleField: (fieldId: FieldId) => void;

  // Signature
  signatureData: string | null;
  initials: { init1: string; init2: string; init3: string };
  signatureDate: string;
  acceptedBy: string;
  setSignatureData: (data: string | null) => void;
  setInitials: (initials: { init1?: string; init2?: string; init3?: string }) => void;
  setSignatureDate: (date: string) => void;
  setAcceptedBy: (name: string) => void;

  // Save/Complete
  saveCurrentForm: (status?: 'draft' | 'signed') => Promise<string | null>;
  completeIntake: () => Promise<boolean>;

  // Reset
  resetForm: () => void;
  resetAll: () => void;

  // Email import
  parsedEmailData: ParsedEmailData | null;
  setParsedEmailData: (data: ParsedEmailData | null) => void;
  emailImportStep: 'queue' | 'select' | 'review' | 'edit';
  setEmailImportStep: (step: 'queue' | 'select' | 'review' | 'edit') => void;

  // Dashboard
  selectedConsignerNumber: string | null;
  setSelectedConsignerNumber: (num: string | null) => void;

  // Photo capture
  addingPhotoForItem: number | null;
  setAddingPhotoForItem: (index: number | null) => void;

  // Forms refresh trigger (increments when forms are modified externally)
  formsVersion: number;
  triggerFormsRefresh: () => void;

  // Document-only preview mode (hides signature section and actions)
  documentOnlyPreview: boolean;
  setDocumentOnlyPreview: (value: boolean) => void;
}

const initialEnabledFields = getDefaultEnabledFields();

export const useStore = create<AppState>((set, get) => ({
  // Navigation
  currentView: 'intake',
  intakeStep: 'consigner-type',
  setView: (view) => set({ currentView: view }),
  setIntakeStep: (step) => set({ intakeStep: step }),

  // Current form
  currentForm: null,
  isViewOnly: false,
  isEditingExisting: false,

  initNewForm: () => {
    const newForm: IntakeForm = {
      id: uuidv4().substring(0, 8),
      consignerType: 'new',
      consignerName: '',
      consignerNumber: '',
      consignerAddress: '',
      consignerPhone: '',
      intakeMode: null,
      items: [],
      enabledFields: getDefaultEnabledFields(),
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set({ 
      currentForm: newForm, 
      items: [],
      enabledFields: getDefaultEnabledFields(),
      isViewOnly: false,
      isEditingExisting: false,
      intakeStep: 'consigner-type',
      signatureData: null,
      initials: { init1: '', init2: '', init3: '' },
      signatureDate: new Date().toISOString().split('T')[0],
      acceptedBy: '',
    });
  },

  loadExistingForm: async (formId, viewOnly = false) => {
    const form = await loadForm(formId);
    if (form) {
      set({
        currentForm: form,
        items: form.items || [],
        enabledFields: form.enabledFields || getDefaultEnabledFields(),
        isViewOnly: viewOnly || form.status === 'signed',
        isEditingExisting: true,
        intakeStep: 'item-entry',
        signatureData: form.signatureData || null,
        initials: {
          init1: form.initials1 || '',
          init2: form.initials2 || '',
          init3: form.initials3 || '',
        },
        signatureDate: form.signatureDate || new Date().toISOString().split('T')[0],
        acceptedBy: form.acceptedBy || '',
      });
      return true;
    }
    return false;
  },

  // Consigner
  setConsignerType: (type) => {
    const { currentForm } = get();
    if (currentForm) {
      set({ currentForm: { ...currentForm, consignerType: type } });
    }
  },

  setConsignerInfo: (info) => {
    const { currentForm } = get();
    if (currentForm) {
      set({ currentForm: { ...currentForm, ...info } });
    }
  },

  // Intake mode
  setIntakeMode: (mode) => {
    const { currentForm } = get();
    if (currentForm) {
      set({ currentForm: { ...currentForm, intakeMode: mode } });
    }
  },

  // Items
  items: [],
  
  addItem: (item) => {
    const newItem = { ...createEmptyItem(), ...item };
    set((state) => ({ items: [...state.items, newItem] }));
  },

  updateItem: (index, updates) => {
    set((state) => ({
      items: state.items.map((item, i) => 
        i === index ? { ...item, ...updates } : item
      ),
    }));
  },

  removeItem: (index) => {
    set((state) => ({
      items: state.items.filter((_, i) => i !== index),
    }));
  },

  addPhotoToItem: (itemIndex, photoBase64) => {
    set((state) => ({
      items: state.items.map((item, i) =>
        i === itemIndex ? { ...item, photos: [...item.photos, photoBase64] } : item
      ),
    }));
  },

  removePhotoFromItem: (itemIndex, photoIndex) => {
    set((state) => ({
      items: state.items.map((item, i) =>
        i === itemIndex
          ? { ...item, photos: item.photos.filter((_, pi) => pi !== photoIndex) }
          : item
      ),
    }));
  },

  setItemsFromEmail: (items) => {
    set({ items });
  },

  // Field configuration
  enabledFields: initialEnabledFields,
  
  toggleField: (fieldId) => {
    set((state) => ({
      enabledFields: {
        ...state.enabledFields,
        [fieldId]: !state.enabledFields[fieldId],
      },
    }));
  },

  // Signature
  signatureData: null,
  initials: { init1: '', init2: '', init3: '' },
  signatureDate: new Date().toISOString().split('T')[0],
  acceptedBy: '',

  setSignatureData: (data) => set({ signatureData: data }),
  setInitials: (initials) => set((state) => ({ 
    initials: { ...state.initials, ...initials } 
  })),
  setSignatureDate: (date) => set({ signatureDate: date }),
  setAcceptedBy: (name) => set({ acceptedBy: name }),

  // Save
  saveCurrentForm: async (status) => {
    const { currentForm, items, enabledFields, signatureData, initials, signatureDate, acceptedBy, triggerFormsRefresh } = get();
    if (!currentForm) return null;

    const formToSave: IntakeForm = {
      ...currentForm,
      items,
      enabledFields,
      status: status || currentForm.status,
      signatureData: signatureData || undefined,
      initials1: initials.init1,
      initials2: initials.init2,
      initials3: initials.init3,
      signatureDate,
      acceptedBy,
      updatedAt: new Date(),
    };

    await saveForm(formToSave);
    set({ currentForm: formToSave });

    // Save consigner for future lookups
    if (formToSave.consignerNumber) {
      await saveConsigner({
        consignerNumber: formToSave.consignerNumber,
        name: formToSave.consignerName,
        address: formToSave.consignerAddress,
        phone: formToSave.consignerPhone,
      });

      // Auto-link: if this form has a number and name, update any previous 
      // forms with the same name that don't have a number yet
      if (formToSave.consignerName) {
        await autoLinkFormsByName(formToSave.consignerName, formToSave.consignerNumber);
      }
    }

    // Trigger refresh for sidebar/dashboard
    triggerFormsRefresh();

    return formToSave.id;
  },

  completeIntake: async () => {
    const { saveCurrentForm } = get();
    const formId = await saveCurrentForm('signed');
    if (formId) {
      set({ isViewOnly: true });
      return true;
    }
    return false;
  },

  // Reset
  resetForm: () => {
    set({
      items: [],
      signatureData: null,
      initials: { init1: '', init2: '', init3: '' },
      signatureDate: new Date().toISOString().split('T')[0],
      acceptedBy: '',
      addingPhotoForItem: null,
    });
  },

  resetAll: () => {
    set({
      currentView: 'intake',
      intakeStep: 'consigner-type',
      currentForm: null,
      isViewOnly: false,
      isEditingExisting: false,
      items: [],
      enabledFields: getDefaultEnabledFields(),
      signatureData: null,
      initials: { init1: '', init2: '', init3: '' },
      signatureDate: new Date().toISOString().split('T')[0],
      acceptedBy: '',
      parsedEmailData: null,
      emailImportStep: 'queue',
      selectedConsignerNumber: null,
      addingPhotoForItem: null,
    });
  },

  // Email import
  parsedEmailData: null,
  setParsedEmailData: (data) => set({ parsedEmailData: data }),
  emailImportStep: 'queue',
  setEmailImportStep: (step) => set({ emailImportStep: step }),

  // Dashboard
  selectedConsignerNumber: null,
  setSelectedConsignerNumber: (num) => set({ selectedConsignerNumber: num }),

  // Photo capture
  addingPhotoForItem: null,
  setAddingPhotoForItem: (index) => set({ addingPhotoForItem: index }),

  // Forms refresh trigger
  formsVersion: 0,
  triggerFormsRefresh: () => set((state) => ({ formsVersion: state.formsVersion + 1 })),

  // Document-only preview mode
  documentOnlyPreview: false,
  setDocumentOnlyPreview: (value) => set({ documentOnlyPreview: value }),
}));

