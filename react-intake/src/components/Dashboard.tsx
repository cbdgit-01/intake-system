import { useState, useEffect } from 'react';
import { Search, ArrowLeft, FileText, Edit, Trash2, Eye, Plus, User } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getAllForms, deleteForm } from '../db';
import { IntakeForm } from '../types';

export default function Dashboard() {
  const {
    setView,
    loadExistingForm,
    setIntakeStep,
    resetAll,
    selectedConsignerNumber,
    setSelectedConsignerNumber,
    formsVersion,
    triggerFormsRefresh,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [allForms, setAllForms] = useState<IntakeForm[]>([]);

  // Load data on mount and when forms change
  useEffect(() => {
    loadAllData();
  }, [formsVersion]);

  const loadAllData = async () => {
    // Load forms from Supabase
    const forms = await getAllForms();
    setAllForms(forms);
  };

  // Search forms directly by consigner name or number
  const searchResults = searchTerm.length >= 2 
    ? allForms.filter(f => 
        f.consignerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.consignerNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // Group search results by consigner (using name as key if no number)
  const groupedSearchResults = getUniqueConsignersFromForms(searchResults);

  // Get forms for selected consigner - match by number OR by name if no number
  const consignerForms = selectedConsignerNumber 
    ? allForms.filter(f => 
        f.consignerNumber === selectedConsignerNumber || 
        (!f.consignerNumber && f.consignerName === selectedConsignerNumber)
      )
    : [];

  // Get consigner info from forms
  const consignerInfo = selectedConsignerNumber 
    ? allForms.find(f => f.consignerNumber === selectedConsignerNumber) ||
      allForms.find(f => f.consignerName === selectedConsignerNumber)
    : null;

  const handleViewForm = async (formId: string) => {
    await loadExistingForm(formId, true);
    setIntakeStep('item-entry');
    setView('intake');
  };

  const handleEditForm = async (formId: string) => {
    await loadExistingForm(formId, false);
    setIntakeStep('item-entry');
    setView('intake');
  };

  const handleDeleteForm = async (formId: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      await deleteForm(formId);
      await loadAllData();
      triggerFormsRefresh();
      
      // If we deleted the last form for this consigner, go back to search
      const remainingForms = allForms.filter(f => 
        f.id !== formId && (
          f.consignerNumber === selectedConsignerNumber || 
          (!f.consignerNumber && f.consignerName === selectedConsignerNumber)
        )
      );
      if (remainingForms.length === 0) {
        setSelectedConsignerNumber(null);
      }
    }
  };

  const handleSelectConsigner = (consignerNum: string) => {
    setSelectedConsignerNumber(consignerNum);
  };

  const handleBackToSearch = () => {
    setSelectedConsignerNumber(null);
  };

  const handleNewIntake = () => {
    resetAll();
    setView('intake');
  };

  // Viewing specific consigner's records
  if (selectedConsignerNumber) {
    return (
      <div className="animate-in">
        <button
          onClick={handleBackToSearch}
          className="flex items-center gap-2 mb-4 transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <ArrowLeft size={18} />
          <span>Back to Search</span>
        </button>

        {/* Consigner Details */}
        <div className="st-card mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <User size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {consignerInfo?.consignerName || selectedConsignerNumber}
              </h2>
              {consignerInfo?.consignerNumber && (
                <p style={{ color: 'var(--text-secondary)' }}>#{consignerInfo.consignerNumber}</p>
              )}
              {consignerInfo?.consignerAddress && (
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{consignerInfo.consignerAddress}</p>
              )}
              {consignerInfo?.consignerPhone && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{consignerInfo.consignerPhone}</p>
              )}
            </div>
          </div>
        </div>

        <div className="st-divider" />

        <h3 className="text-lg font-semibold mb-4">Records ({consignerForms.length})</h3>

        {consignerForms.length > 0 ? (
          <div className="space-y-3">
            {consignerForms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onView={() => handleViewForm(form.id)}
                onEdit={() => handleEditForm(form.id)}
                onDelete={() => handleDeleteForm(form.id)}
              />
            ))}
          </div>
        ) : (
          <div className="st-info">No records found for this consigner.</div>
        )}

        <div className="st-divider" />

        <button onClick={handleNewIntake} className="w-full st-button-primary">
          <Plus size={18} className="inline mr-2" />
          Start New Intake
        </button>
      </div>
    );
  }

  // Main dashboard view
  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold mb-2">Records Dashboard</h1>
      <div className="st-divider" />

      {/* Search */}
      <div className="mb-6">
        <label className="st-label">Search consigner by name or number</label>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="st-input pl-10"
            placeholder="Enter name or number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Search Results */}
      {searchTerm.length >= 2 ? (
        <div className="mb-6">
          {groupedSearchResults.length > 0 ? (
            <>
              <p className="font-medium mb-3">Found {groupedSearchResults.length} consigner(s) ({searchResults.length} records)</p>
              <div className="space-y-2">
                {groupedSearchResults.map((consigner) => (
                  <button
                    key={consigner.key}
                    onClick={() => handleSelectConsigner(consigner.key)}
                    className="w-full st-card text-left hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{consigner.name || 'Unknown'}</p>
                          {consigner.number && (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)' }}>
                              #{consigner.number}
                            </span>
                          )}
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {consigner.recordCount} record(s)
                          </span>
                        </div>
                        {(consigner.address || consigner.phone) && (
                          <p className="text-sm mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                            {consigner.address && consigner.address.split('\n')[0]}
                            {consigner.address && consigner.phone && ' • '}
                            {consigner.phone}
                          </p>
                        )}
                      </div>
                      <span style={{ color: 'var(--text-muted)' }} className="flex-shrink-0">→</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="st-info">No consigners found matching your search.</div>
          )}
        </div>
      ) : (
        <div className="mb-6">
          <p className="st-caption">Enter at least 2 characters to search.</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            {allForms.length} total records in database
          </p>
        </div>
      )}

      <div className="st-divider" />

      <button onClick={handleNewIntake} className="w-full st-button-primary">
        <Plus size={18} className="inline mr-2" />
        Start New Intake
      </button>
    </div>
  );
}

// Helper to get unique consigners from forms
// Uses consignerNumber as key if available, otherwise uses consignerName
function getUniqueConsignersFromForms(forms: IntakeForm[]): Array<{ 
  key: string; 
  name: string; 
  number: string; 
  address: string;
  phone: string;
  recordCount: number 
}> {
  const consignersMap = new Map<string, { name: string; number: string; address: string; phone: string; count: number }>();
  
  forms.forEach((form) => {
    // Use consignerNumber as key if available, otherwise use name
    const key = form.consignerNumber || form.consignerName || form.id;
    
    const existing = consignersMap.get(key);
    if (existing) {
      existing.count++;
      // Update fields if we have better ones
      if (form.consignerName && !existing.name) {
        existing.name = form.consignerName;
      }
      if (form.consignerNumber && !existing.number) {
        existing.number = form.consignerNumber;
      }
      if (form.consignerAddress && !existing.address) {
        existing.address = form.consignerAddress;
      }
      if (form.consignerPhone && !existing.phone) {
        existing.phone = form.consignerPhone;
      }
    } else {
      consignersMap.set(key, {
        name: form.consignerName || '',
        number: form.consignerNumber || '',
        address: form.consignerAddress || '',
        phone: form.consignerPhone || '',
        count: 1,
      });
    }
  });
  
  return Array.from(consignersMap.entries()).map(([key, data]) => ({
    key,
    name: data.name,
    number: data.number,
    address: data.address,
    phone: data.phone,
    recordCount: data.count,
  }));
}

interface FormCardProps {
  form: IntakeForm;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function FormCard({ form, onView, onEdit, onDelete }: FormCardProps) {
  const isSigned = form.status === 'signed';
  const modeLabel = (form.intakeMode || '').charAt(0).toUpperCase() + (form.intakeMode || '').slice(1);
  const dateStr = form.updatedAt ? new Date(form.updatedAt).toLocaleDateString() : '';

  return (
    <div className="st-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--surface)' }}>
            <FileText size={20} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div>
            <p className="font-medium">
              {dateStr} - {modeLabel}
              {isSigned && (
                <span className="ml-2 text-xs px-2 py-0.5 bg-success/20 text-success rounded-full">
                  Signed
                </span>
              )}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              ID: {form.id} | {form.items?.length || 0} items
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onView} className="st-button text-sm">
            <Eye size={16} className="inline mr-1" />
            View
          </button>
          
          {!isSigned && (
            <>
              <button onClick={onEdit} className="st-button text-sm">
                <Edit size={16} className="inline mr-1" />
                Edit
              </button>
              <button onClick={onDelete} className="st-button text-sm text-error">
                <Trash2 size={16} className="inline mr-1" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
