import { useState } from 'react';
import { ArrowLeft, Settings, Eye, Plus, Minus, Camera, Mail, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import ItemCard from '../ItemCard';
import PhotoCapture from '../PhotoCapture';
import FieldConfiguration from '../FieldConfiguration';
import { createEmptyItem } from '../../types';

export default function EmailMode() {
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
    emailImportStep,
    setEmailImportStep,
    setItemsFromEmail,
  } = useStore();

  const [showFieldConfig, setShowFieldConfig] = useState(false);

  // Mock email data for demo - in real app, this would come from Gmail API
  const [mockEmails] = useState([
    {
      id: '1',
      subject: 'Items for consignment - Johnson Estate',
      from: 'sarah.johnson@email.com',
      date: '2024-01-08',
      messageCount: 4,
      snippet: 'Hi, I have several pieces of furniture I would like to consign...',
    },
    {
      id: '2', 
      subject: 'Re: Furniture pickup request',
      from: 'michael.smith@email.com',
      date: '2024-01-07',
      messageCount: 2,
      snippet: 'Thank you for reviewing my items. The approved pieces are...',
    },
    {
      id: '3',
      subject: 'Consignment inquiry - Antique collection',
      from: 'emily.davis@email.com',
      date: '2024-01-06',
      messageCount: 6,
      snippet: 'I have an antique dining set and several decorative pieces...',
    },
  ]);

  const handleBack = () => {
    if (isEditingExisting) {
      resetAll();
      setView('dashboard');
    } else if (emailImportStep === 'edit') {
      setEmailImportStep('queue');
    } else {
      setIntakeStep('consigner-info');
    }
  };

  const handleSelectEmail = (_emailId: string) => {
    // In real app, this would fetch the email thread and parse it
    // For demo, we'll simulate parsed items
    setEmailImportStep('edit');
    
    // Simulate parsed items from email
    const parsedItems = [
      { ...createEmptyItem(), name: 'Antique Oak Dresser', notes: 'Good condition, minor wear', quantity: 1 },
      { ...createEmptyItem(), name: 'Victorian Side Table', notes: 'Excellent condition', quantity: 1 },
      { ...createEmptyItem(), name: 'Brass Floor Lamp', notes: 'Working, needs new shade', quantity: 1 },
    ];
    
    setItemsFromEmail(parsedItems);
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

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Email Import Mode</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Consigner: {currentForm?.consignerName}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button onClick={handleBack} className="st-button">
            <ArrowLeft size={18} className="inline mr-2" />
            {isEditingExisting ? 'Close' : emailImportStep === 'edit' ? 'Back' : 'Change Mode'}
          </button>
        </div>
      </div>

      <div className="st-divider" />

      {/* Email Queue View */}
      {emailImportStep === 'queue' && (
        <div>
          <div className="st-warning mb-6 flex items-start gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Gmail Integration</p>
              <p className="text-sm mt-1">
                In a production environment, this would connect to Gmail to import email threads.
                For this demo, sample emails are shown below.
              </p>
            </div>
          </div>

          <h3 className="text-lg font-semibold mb-4">Select Email Thread</h3>
          <p className="text-text-secondary mb-4">Recent Emails:</p>

          <div className="space-y-3">
            {mockEmails.map((email) => (
              <button
                key={email.id}
                onClick={() => handleSelectEmail(email.id)}
                className="w-full st-card text-left hover:border-primary/50 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-surface">
                    <Mail size={20} className="text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{email.subject}</p>
                    <p className="text-sm text-text-secondary truncate">
                      From: {email.from} | {email.messageCount} message(s)
                    </p>
                    <p className="text-sm text-text-muted mt-1 truncate">
                      {email.snippet}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit Items View */}
      {emailImportStep === 'edit' && (
        <>
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

          <h3 className="text-lg font-semibold mb-4">Edit Items</h3>

          <div className="space-y-4 mb-6">
            {items.map((item, index) => (
              <ItemCard key={item.id} item={item} index={index} />
            ))}
          </div>

          {/* Add/Remove Items */}
          {!isViewOnly && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <button onClick={handleAddItemWithPhoto} className="st-button">
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
                </p>
              </div>
              <button onClick={handlePreview} className="st-button-primary">
                <Eye size={18} className="inline mr-2" />
                Preview Intake Agreement
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

