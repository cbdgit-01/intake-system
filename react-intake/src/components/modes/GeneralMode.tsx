import { useState } from 'react';
import { ArrowLeft, Plus, Camera, Settings, Eye, Save, Printer } from 'lucide-react';
import { useStore } from '../../store/useStore';
import ItemCard from '../ItemCard';
import PhotoCapture from '../PhotoCapture';
import FieldConfiguration from '../FieldConfiguration';
import PrintableItemsList from '../PrintableItemsList';

export default function GeneralMode() {
  const {
    currentForm,
    items,
    addItem,
    setIntakeStep,
    isViewOnly,
    isEditingExisting,
    setView,
    addingPhotoForItem,
    setAddingPhotoForItem,
    saveCurrentForm,
  } = useStore();

  const [showFieldConfig, setShowFieldConfig] = useState(false);

  const handleBack = () => {
    if (isEditingExisting) {
      // Just go back to dashboard, don't reset the form data
      setView('dashboard');
    } else {
      setIntakeStep('consigner-info');
    }
  };

  const handleAddItemWithPhoto = () => {
    addItem();
    setAddingPhotoForItem(items.length);
  };

  const handleAddItemNoPhoto = () => {
    addItem();
  };

  const handlePreview = async () => {
    await saveCurrentForm();
    setIntakeStep('preview');
  };

  const handleSaveEdits = async () => {
    await saveCurrentForm();
    setView('dashboard');
  };

  const handlePrintItems = () => {
    document.body.classList.add('printing-items');
    window.print();
    document.body.classList.remove('printing-items');
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

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold">General Entry Mode</h2>
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

      {/* Add Items Section */}
      <h3 className="text-lg font-semibold mb-4">
        {items.length > 0 ? `Items (${items.length})` : 'Add Items'}
      </h3>
      <p className="text-text-secondary mb-6">Add each item one at a time.</p>

      {/* Items List */}
      <div className="space-y-4 mb-6">
        {items.map((item, index) => (
          <ItemCard key={item.id} item={item} index={index} />
        ))}
      </div>

      {/* Add Buttons */}
      {!isViewOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button onClick={handleAddItemWithPhoto} className="st-button-primary">
            <Camera size={18} className="inline mr-2" />
            Add Item (with photo)
          </button>
          <button onClick={handleAddItemNoPhoto} className="st-button">
            <Plus size={18} className="inline mr-2" />
            Add Item (no photo)
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
          <div className="flex gap-2">
            <button onClick={handlePrintItems} className="st-button">
              <Printer size={18} className="inline mr-2" />
              Print Items
            </button>
            {isEditingExisting && (
              <button onClick={handleSaveEdits} className="st-button">
                <Save size={18} className="inline mr-2" />
                Save Edits
              </button>
            )}
            <button onClick={handlePreview} className="st-button-primary">
              <Eye size={18} className="inline mr-2" />
              Preview Intake Agreement
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="st-info">
          Add at least one item to create a form.
        </div>
      )}

      {/* Hidden printable items list */}
      <PrintableItemsList />
    </div>
  );
}

