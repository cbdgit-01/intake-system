import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, LayoutDashboard, Plus, FileText } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getAllForms, loadForm } from '../db';
import { IntakeForm } from '../types';

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const navigate = useNavigate();
  const { 
    currentView, 
    setView, 
    currentForm, 
    resetAll,
    loadExistingForm,
    setIntakeStep,
    formsVersion,
  } = useStore();
  
  const [recentForms, setRecentForms] = useState<IntakeForm[]>([]);
  const [allForms, setAllForms] = useState<IntakeForm[]>([]);
  const [totalForms, setTotalForms] = useState(0);

  useEffect(() => {
    loadRecentForms();
  }, [currentForm, formsVersion]);

  const loadRecentForms = async () => {
    const forms = await getAllForms();
    setAllForms(forms);
    setTotalForms(forms.length);
    setRecentForms(forms.slice(0, 5));
  };

  const handleNewIntake = () => {
    resetAll();
    setView('intake');
    navigate('/');
    onNavigate?.();
  };

  const handleViewDashboard = () => {
    setView('dashboard');
    navigate('/');
    onNavigate?.();
  };

  const handleBackToIntake = () => {
    setView('intake');
    navigate('/');
    onNavigate?.();
  };

  const handleOpenForm = async (formId: string) => {
    const form = await loadForm(formId);
    if (form) {
      await loadExistingForm(formId, true);
      setIntakeStep('item-entry');
      setView('intake');
      navigate('/');
      onNavigate?.();
    }
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      {/* Logo */}
      <div className="hidden lg:block mb-6">
        <img
          src="/ConsignbyDesignlogo-border_240x@2x.avif"
          alt="Consigned By Design"
          className="h-14 object-contain mb-3"
        />
        <h1 className="text-xl font-bold" style={{ color: 'var(--primary)' }}>CBD Intake</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Consigned By Design</p>
      </div>

      {/* Navigation */}
      <nav className="space-y-2 mb-6">
        {currentView === 'dashboard' ? (
          <button
            onClick={handleBackToIntake}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
            style={{ 
              backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
          >
            <ClipboardList size={20} />
            <span>Back to Intake</span>
          </button>
        ) : (
          <button
            onClick={handleViewDashboard}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <LayoutDashboard size={20} />
            <span>View All Records</span>
          </button>
        )}
      </nav>

      <div className="st-divider" />

      {/* Current Form Info */}
      {currentForm && (
        <div className="mb-6">
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Current Form</p>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ID: {currentForm.id}</p>
          {currentForm.consignerName && (
            <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{currentForm.consignerName}</p>
          )}
        </div>
      )}

      <div className="st-divider" />

      {/* Stats */}
      <div className="mb-4">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Total Records: {totalForms}
        </p>
      </div>

      {/* Recent Forms */}
      {recentForms.length > 0 && (
        <div className="flex-1">
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Recent Forms</p>
          <div className="space-y-2">
            {recentForms.map((form) => {
              // Calculate form number for this consigner
              const consignerKey = form.consignerNumber || form.consignerName;
              const allFormsForConsigner = recentForms.filter(f => 
                (f.consignerNumber || f.consignerName) === consignerKey
              );
              // Get total count from all forms (not just recent)
              const totalForConsigner = allForms.filter(f =>
                (f.consignerNumber || f.consignerName) === consignerKey
              ).length;
              // Find this form's position (sorted by date, oldest = 1)
              const sortedForms = allForms
                .filter(f => (f.consignerNumber || f.consignerName) === consignerKey)
                .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
              const formNumber = sortedForms.findIndex(f => f.id === form.id) + 1;
              
              return (
                <button
                  key={form.id}
                  onClick={() => handleOpenForm(form.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FileText size={16} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm truncate flex-1">
                        {form.consignerName || `#${form.consignerNumber}` || 'Unknown'}
                      </p>
                      {form.consignerNumber && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-muted)' }}>
                          #{form.consignerNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Form {formNumber} of {totalForConsigner}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* New Intake Button */}
      <div className="mt-auto pt-4">
        <button
          onClick={handleNewIntake}
          className="w-full flex items-center justify-center gap-2 st-button-primary"
        >
          <Plus size={18} />
          <span>New Intake</span>
        </button>
      </div>
    </div>
  );
}

