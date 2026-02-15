import { useState } from 'react';
import { ArrowLeft, Plus, Minus, Settings, Eye, Grid } from 'lucide-react';
import { useStore } from '../../store/useStore';
import ItemCard from '../ItemCard';
import PhotoCapture from '../PhotoCapture';
import FieldConfiguration from '../FieldConfiguration';

export default function PrepopulateMode() {
  const {
    currentForm,
    items,
    addItem,
    removeItem,
    setIntakeStep,
    isViewOnly,
    isEditingExisting,
    setView,
    addingPhotoForItem,
    setAddingPhotoForItem,
    saveCurrentForm,
  } = useStore();

  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [itemCountInput, setItemCountInput] = useState('20');
  const [hasPopulated, setHasPopulated] = useState(items.length > 0);

  const handleBack = () => {
    if (isEditingExisting) {
      // Just go back to dashboard, don't reset the form data
      setView('dashboard');
    } else {
      setIntakeStep('consigner-info');
    }
  };

  const handlePopulate = () => {
    const count = parseInt(itemCountInput) || 1;
    const safeCount = Math.max(1, Math.min(100, count));
    // Add the specified number of empty items
    for (let i = 0; i < safeCount; i++) {
      addItem();
    }
    setHasPopulated(true);
  };

  const handleAddMore = () => {
    addItem();
  };

  const handleRemoveLastItem = () => {
    if (items.length > 0) {
      removeItem(items.length - 1);
    }
  };

  const handlePreview = async () => {
    await saveCurrentForm();
    setIntakeStep('preview');
  };

  // If capturing photo for an item
  if (addingPhotoForItem !== null) {
    return (
      <PhotoCapture
        itemIndex={addingPhotoForItem}
        onClose={() => setAddingPhotoForItem(null)}
      />
    );
  }

  const acceptedCount = items.filter(item => item.status === 'Accept').length;
  const totalQuantity = items.reduce((sum, item) =>
    item.status === 'Accept' ? sum + item.quantity : sum, 0
  );

  // Show pre-populate selector if no items yet
  if (!hasPopulated && items.length === 0) {
    return (
      <div className="animate-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold">Pre-populate Mode</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Consigner: {currentForm?.consignerName}
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={handleBack} className="st-button">
              <ArrowLeft size={18} className="inline mr-2" />
              Change Mode
            </button>
          </div>
        </div>

        <div className="st-divider" />

        {/* Simple Item Count Input */}
        <div className="max-w-md mx-auto text-center py-8">
          <Grid size={48} className="mx-auto mb-4" style={{ color: 'var(--primary)' }} />
          <h3 className="text-lg font-semibold mb-2">How many items?</h3>
          <p className="text-text-secondary mb-6">
            Enter the number of item boxes to create. You can add or remove items later.
          </p>

          <div className="mb-8">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={itemCountInput}
              onChange={(e) => {
                // Allow empty string for easier editing, or numbers only
                const val = e.target.value;
                if (val === '' || /^\d+$/.test(val)) {
                  setItemCountInput(val);
                }
              }}
              onBlur={() => {
                // On blur, ensure we have a valid number
                const num = parseInt(itemCountInput) || 1;
                setItemCountInput(String(Math.max(1, Math.min(100, num))));
              }}
              className="st-input text-center text-3xl font-bold w-32 mx-auto"
              placeholder="20"
            />
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              Enter 1-100
            </p>
          </div>

          <button
            onClick={handlePopulate}
            disabled={!itemCountInput || parseInt(itemCountInput) < 1}
            className="st-button-primary text-lg px-8 py-3"
          >
            <Grid size={20} className="inline mr-2" />
            Create {parseInt(itemCountInput) || 0} Item Boxes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Pre-populate Mode</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Consigner: {currentForm?.consignerName}
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={handleBack} className="st-button">
            <ArrowLeft size={18} className="inline mr-2" />
            {isEditingExisting ? 'Close' : 'Change Mode'}
          </button>
        </div>
      </div>

      <div className="st-divider" />

      {/* Field Configuration */}
      {!isViewOnly && (
        <div className="mb-6">
          <button
            onClick={() => setShowFieldConfig(!showFieldConfig)}
            className="flex items-center gap-2 text-text-secondary hover:text-text transition-colors"
          >
            <Settings size={18} />
            <span>Configure Form Fields</span>
          </button>

          {showFieldConfig && (
            <div className="mt-4 p-4 bg-surface rounded-lg">
              <FieldConfiguration />
            </div>
          )}
        </div>
      )}

      {/* Items Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          Items ({items.length})
        </h3>
        <p className="text-text-secondary">
          Fill in details for each item below
        </p>
      </div>

      {/* Items List */}
      <div className="space-y-4 mb-6">
        {items.map((item, index) => (
          <ItemCard key={item.id} item={item} index={index} />
        ))}
      </div>

      {/* Add/Remove Buttons */}
      {!isViewOnly && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button onClick={handleAddMore} className="st-button">
            <Plus size={18} className="inline mr-2" />
            Add Another Item
          </button>
          <button
            onClick={handleRemoveLastItem}
            className="st-button"
            disabled={items.length === 0}
          >
            <Minus size={18} className="inline mr-2" />
            Remove Last Item
          </button>
        </div>
      )}

      <div className="st-divider" />

      {/* Summary and Preview */}
      {items.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium">
              Ready to create form: {acceptedCount} items
              {totalQuantity !== acceptedCount && ` (${totalQuantity} total quantity)`}
            </p>
          </div>
          <button onClick={handlePreview} className="st-button-primary">
            <Eye size={18} className="inline mr-2" />
            Preview Intake Agreement
          </button>
        </div>
      )}

      {items.length === 0 && (
        <div className="st-info">
          Add at least one item to create a form.
        </div>
      )}
    </div>
  );
}
