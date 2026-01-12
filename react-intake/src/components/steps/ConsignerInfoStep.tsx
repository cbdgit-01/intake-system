import { useState, useEffect } from 'react';
import { ArrowLeft, Camera, FileText, Mail, Search } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { searchConsignersFromForms } from '../../db';
import { IntakeMode } from '../../types';

export default function ConsignerInfoStep() {
  const { 
    currentForm, 
    setConsignerInfo, 
    setIntakeMode,
    setIntakeStep,
    saveCurrentForm,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    name: string;
    consignerNumber: string;
    address?: string;
    phone?: string;
  }>>([]);
  const [selectedMode, setSelectedMode] = useState<IntakeMode | ''>('');

  // Local form state
  const [name, setName] = useState(currentForm?.consignerName || '');
  const [number, setNumber] = useState(currentForm?.consignerNumber || '');
  const [address, setAddress] = useState(currentForm?.consignerAddress || '');
  const [phone, setPhone] = useState(currentForm?.consignerPhone || '');

  const isNewConsigner = currentForm?.consignerType === 'new';

  // Search consigners from forms (for existing consigner type)
  useEffect(() => {
    if (!isNewConsigner && searchQuery.length >= 2) {
      searchConsignersFromForms(searchQuery).then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, isNewConsigner]);

  const handleSelectConsigner = (consigner: {
    name: string;
    consignerNumber: string;
    address?: string;
    phone?: string;
  }) => {
    setName(consigner.name);
    setNumber(consigner.consignerNumber);
    setAddress(consigner.address || '');
    setPhone(consigner.phone || '');
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleBack = () => {
    setIntakeStep('consigner-type');
  };

  const handleContinue = async () => {
    // Update store
    setConsignerInfo({
      consignerName: name,
      consignerNumber: number,
      consignerAddress: address,
      consignerPhone: phone,
    });
    setIntakeMode(selectedMode as IntakeMode);
    
    // Save form
    await saveCurrentForm();
    
    // Go to item entry
    setIntakeStep('item-entry');
  };

  // Validation
  const isValid = () => {
    if (isNewConsigner) {
      return name.trim() && address.trim() && selectedMode;
    }
    return name.trim() && number.trim() && selectedMode;
  };

  const modeOptions: { id: IntakeMode; label: string; description: string; icon: React.ReactNode }[] = [
    {
      id: 'detection',
      label: 'Item Detection (Photo)',
      description: 'Take one photo of multiple items. The system will auto-detect and separate each item.',
      icon: <Camera size={20} />,
    },
    {
      id: 'general',
      label: 'General (Manual Entry)',
      description: 'Add items one at a time manually with optional photos.',
      icon: <FileText size={20} />,
    },
    {
      id: 'email',
      label: 'Email Import',
      description: 'Import items from an email thread where items were pre-approved.',
      icon: <Mail size={20} />,
    },
  ];

  return (
    <div className="animate-in">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-text-secondary hover:text-text mb-4 transition-colors"
      >
        <ArrowLeft size={18} />
        <span>Back to Consigner Type</span>
      </button>

      <h2 className="text-xl font-semibold mb-2">Step 2: Consigner Information</h2>
      <p className="text-text-secondary mb-6">
        {isNewConsigner 
          ? "Enter the new consigner's information:"
          : "Enter the existing consigner's information:"}
      </p>

      {/* Search for existing consigner */}
      {!isNewConsigner && (
        <div className="mb-6">
          <label className="st-label">Search by name or number</label>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              className="st-input pl-10"
              placeholder="Start typing to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="mt-2 rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              {searchResults.map((consigner, index) => (
                <button
                  key={consigner.consignerNumber || consigner.name || index}
                  onClick={() => handleSelectConsigner(consigner)}
                  className="w-full px-4 py-3 text-left transition-colors"
                  style={{ borderBottom: index < searchResults.length - 1 ? '1px solid var(--surface-border)' : 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{consigner.name || 'Unknown'}</p>
                    {consigner.consignerNumber && (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                        #{consigner.consignerNumber}
                      </span>
                    )}
                  </div>
                  {(consigner.address || consigner.phone) && (
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      {consigner.address && consigner.address.split('\n')[0]}
                      {consigner.address && consigner.phone && ' • '}
                      {consigner.phone}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
          
          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="mt-2 text-sm text-text-muted">
              No matching consigners found. Enter manually below.
            </p>
          )}

          <div className="st-divider" />
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-4 mb-8">
        <div>
          <label className="st-label">Consigner Name *</label>
          <input
            type="text"
            className="st-input"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {isNewConsigner ? (
          <>
            <div>
              <label className="st-label">Address *</label>
              <textarea
                className="st-textarea"
                rows={3}
                placeholder="Street address, city, state, zip"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div>
              <label className="st-label">Phone Number</label>
              <input
                type="tel"
                className="st-input"
                placeholder="(XXX) XXX-XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="st-label">Consigner Number *</label>
              <input
                type="text"
                className="st-input"
                placeholder="e.g., 6789"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="st-label">Address (on file or enter new)</label>
              <textarea
                className="st-textarea"
                rows={3}
                placeholder="Street address, city, state, zip"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div>
              <label className="st-label">Phone (on file or enter new)</label>
              <input
                type="tel"
                className="st-input"
                placeholder="(XXX) XXX-XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className="st-divider" />

      {/* Intake Mode Selection */}
      <h3 className="text-lg font-semibold mb-2">Select Intake Mode</h3>
      <p className="text-text-secondary mb-4">How would you like to add items?</p>

      <div className="space-y-3 mb-8">
        {modeOptions.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setSelectedMode(mode.id)}
            className={`
              w-full st-card text-left transition-all duration-200
              ${selectedMode === mode.id 
                ? 'border-primary bg-primary/5' 
                : 'hover:border-primary/50'}
            `}
          >
            <div className="flex items-start gap-4">
              <div className={`
                p-2 rounded-lg transition-colors
                ${selectedMode === mode.id 
                  ? 'bg-primary text-white' 
                  : 'bg-surface text-text-secondary'}
              `}>
                {mode.icon}
              </div>
              <div className="flex-1">
                <p className="font-medium">{mode.label}</p>
                <p className="text-sm text-text-secondary mt-1">{mode.description}</p>
              </div>
              <div className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center
                ${selectedMode === mode.id 
                  ? 'border-primary' 
                  : 'border-surface-border'}
              `}>
                {selectedMode === mode.id && (
                  <div className="w-3 h-3 rounded-full bg-primary" />
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Continue button */}
      <button
        onClick={handleContinue}
        disabled={!isValid()}
        className="w-full st-button-primary"
      >
        Continue to Item Entry
      </button>

      {!isValid() && (
        <p className="text-sm text-text-muted mt-2 text-center">
          {isNewConsigner 
            ? 'Please enter consigner name and address, then select a mode.'
            : 'Please enter consigner name and number, then select a mode.'}
        </p>
      )}
    </div>
  );
}

