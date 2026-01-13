import { useState, useRef } from 'react';
import { ArrowLeft, Upload, Camera, Settings, Eye, Plus, Minus, RotateCcw, Loader2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import ItemCard from '../ItemCard';
import PhotoCapture from '../PhotoCapture';
import FieldConfiguration from '../FieldConfiguration';

// Detection API endpoint - can be configured via environment variable
const DETECTION_API_URL = import.meta.env.VITE_DETECTION_API_URL || 'http://localhost:8000';

export default function DetectionMode() {
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
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [detectionComplete, setDetectionComplete] = useState(items.length > 0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionMessage, setDetectionMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBack = () => {
    if (isEditingExisting) {
      resetAll();
      setView('dashboard');
    } else {
      setIntakeStep('consigner-info');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setMainImage(base64);
    };
    reader.readAsDataURL(file);

    // Run YOLO detection
    await runDetection(file);
  };

  const runDetection = async (file: File) => {
    setIsDetecting(true);
    setDetectionMessage('Detecting items...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${DETECTION_API_URL}/detect`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Detection failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // Add each detected item with its cropped image
        for (const item of data.items) {
          addItem({ photos: [item.image] });
        }
        setDetectionMessage(data.message);
        setDetectionComplete(true);
      } else {
        throw new Error('Detection returned unsuccessful');
      }
    } catch (error) {
      console.error('Detection error:', error);
      // Fallback: add the image as a single item if detection fails
      setDetectionMessage('Detection service unavailable. Image added as single item.');
      
      // Convert file to base64 for fallback
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        addItem({ photos: [base64] });
        setDetectionComplete(true);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleResetImage = () => {
    setMainImage(null);
    setDetectionComplete(false);
    // Clear items that were from detection
    while (items.length > 0) {
      removeItem(items.length - 1);
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

  const handleSkipDetection = () => {
    addItem();
    setDetectionComplete(true);
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
          <h2 className="text-xl font-semibold">Item Detection Mode</h2>
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

      {/* Detection Phase */}
      {!detectionComplete && !isViewOnly && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Photograph Items</h3>
          <p className="text-text-secondary mb-4">
            Upload or take a photo of the items. The system will try to detect individual items automatically.
          </p>

          {!mainImage ? (
            <>
              <div 
                onClick={() => !isDetecting && fileInputRef.current?.click()}
                className={`border-2 border-dashed border-surface-border rounded-lg p-8 text-center transition-colors ${
                  isDetecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'
                }`}
              >
                {isDetecting ? (
                  <>
                    <Loader2 size={48} className="mx-auto mb-4 text-primary animate-spin" />
                    <p className="text-text-secondary mb-2">
                      {detectionMessage || 'Processing...'}
                    </p>
                  </>
                ) : (
                  <>
                    <Upload size={48} className="mx-auto mb-4 text-text-muted" />
                    <p className="text-text-secondary mb-2">
                      Click to upload or take a photo
                    </p>
                    <p className="text-sm text-text-muted">
                      Supports JPEG, PNG
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handleFileUpload}
                className="hidden"
                capture="environment"
                disabled={isDetecting}
              />

              <div className="st-divider" />

              <button onClick={handleSkipDetection} className="w-full st-button" disabled={isDetecting}>
                Add Items Manually (Skip Photo)
              </button>
            </>
          ) : isDetecting ? (
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex-1 relative">
                <img 
                  src={mainImage} 
                  alt="Uploaded items" 
                  className="w-full max-w-md rounded-lg border border-surface-border opacity-50"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-background/90 rounded-lg p-4 flex items-center gap-3">
                    <Loader2 size={24} className="text-primary animate-spin" />
                    <span>{detectionMessage || 'Detecting items...'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex-1">
                <img 
                  src={mainImage} 
                  alt="Uploaded items" 
                  className="w-full max-w-md rounded-lg border border-surface-border"
                />
              </div>
              <button onClick={handleResetImage} className="st-button">
                <RotateCcw size={18} className="inline mr-2" />
                Reset Image
              </button>
            </div>
          )}
        </div>
      )}

      {/* Items List */}
      {detectionComplete && (
        <>
          {mainImage && (
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start">
              <img 
                src={mainImage} 
                alt="Input Image" 
                className="w-48 rounded-lg border border-surface-border"
              />
              {!isViewOnly && (
                <button onClick={handleResetImage} className="st-button">
                  <RotateCcw size={18} className="inline mr-2" />
                  Reset Image
                </button>
              )}
            </div>
          )}

          {detectionMessage && (
            <div className="st-info mb-4">
              {detectionMessage}
            </div>
          )}
          
          {items.length > 0 && (
            <div className="st-success mb-4">
              {items.length} item(s) ready for entry
            </div>
          )}

          <h3 className="text-lg font-semibold mb-4">Enter Item Details</h3>

          <div className="space-y-4 mb-6">
            {items.map((item, index) => (
              <ItemCard key={item.id} item={item} index={index} />
            ))}
          </div>

          {/* Add/Remove Items */}
          {!isViewOnly && (
            <>
              <h4 className="font-medium mb-3">Add or Remove Items</h4>
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
            </>
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
        </>
      )}
    </div>
  );
}

