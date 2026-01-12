import { useState } from 'react';
import { ArrowLeft, Plus, Minus, Camera, Settings, Eye } from 'lucide-react';
import { useStore } from '../../store/useStore';
import ItemCard from '../ItemCard';
import PhotoCapture from '../PhotoCapture';
import FieldConfiguration from '../FieldConfiguration';

export default function GeneralMode() {
  const { 
    currentForm, 
    items, 
    addItem, 
    removeItem,
    setIntakeStep,
    isViewOnly,
    isEditingExisting,
    setView,
    resetAll,
    addingPhotoForItem,
    setAddingPhotoForItem,
    saveCurrentForm,
  } = useStore();

  const [showFieldConfig, setShowFieldConfig] = useState(false);

  const handleBack = () => {
    if (isEditingExisting) {
      resetAll();
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

      {/* Add/Remove Buttons */}
      {!isViewOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <button onClick={handleAddItemWithPhoto} className="st-button-primary">
            <Camera size={18} className="inline mr-2" />
            Add Item (with photo)
          </button>
          <button onClick={handleAddItemNoPhoto} className="st-button">
            <Plus size={18} className="inline mr-2" />
            Add Item (no photo)
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

