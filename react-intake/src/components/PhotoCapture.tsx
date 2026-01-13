import { useRef, useState } from 'react';
import { X, Upload, Trash2, Check } from 'lucide-react';
import { useStore } from '../store/useStore';

interface PhotoCaptureProps {
  itemIndex: number;
  onClose: () => void;
}

export default function PhotoCapture({ itemIndex, onClose }: PhotoCaptureProps) {
  const { items, addPhotoToItem, removePhotoFromItem, saveCurrentForm } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newPhotos, setNewPhotos] = useState<string[]>([]);

  const item = items[itemIndex];
  const existingPhotos = item?.photos || [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setNewPhotos((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveNewPhoto = (photoIndex: number) => {
    setNewPhotos((prev) => prev.filter((_, i) => i !== photoIndex));
  };

  const handleRemoveExistingPhoto = (photoIndex: number) => {
    removePhotoFromItem(itemIndex, photoIndex);
  };

  const handleDone = async () => {
    // Add all new photos to the item
    newPhotos.forEach((photo) => {
      addPhotoToItem(itemIndex, photo);
    });
    
    await saveCurrentForm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const totalPhotos = existingPhotos.length + newPhotos.length;

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">
          Add Photo for Item {itemIndex + 1}
        </h3>
        <button onClick={handleCancel} className="p-2 hover:bg-surface rounded-lg">
          <X size={24} />
        </button>
      </div>

      {/* Existing photos */}
      {existingPhotos.length > 0 && (
        <div className="mb-6">
          <p className="st-label">Current photos: {existingPhotos.length}</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {existingPhotos.map((photo, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={photo}
                  alt={`Photo ${idx + 1}`}
                  className="w-full aspect-square object-cover rounded-lg border border-surface-border"
                />
                <button
                  onClick={() => handleRemoveExistingPhoto(idx)}
                  className="absolute top-1 right-1 w-6 h-6 bg-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            ))}
          </div>
          <div className="st-divider" />
        </div>
      )}

      {/* Upload area */}
      <div className="mb-6">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-surface-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <Upload size={48} className="mx-auto mb-4 text-text-muted" />
          <p className="text-text-secondary mb-2">
            Take a photo or choose from library
          </p>
          <p className="text-sm text-text-muted">
            Supports JPEG, PNG (multiple files)
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* New photos preview */}
      {newPhotos.length > 0 && (
        <div className="mb-6">
          <p className="st-label">New photos to add: {newPhotos.length}</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {newPhotos.map((photo, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={photo}
                  alt={`New photo ${idx + 1}`}
                  className="w-full aspect-square object-cover rounded-lg border-2 border-success"
                />
                <button
                  onClick={() => handleRemoveNewPhoto(idx)}
                  className="absolute top-1 right-1 w-6 h-6 bg-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="st-info mb-6">
        Total photos after save: {totalPhotos}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handleDone} className="flex-1 st-button-primary">
          <Check size={18} className="inline mr-2" />
          Done
        </button>
        <button onClick={handleCancel} className="flex-1 st-button">
          Cancel
        </button>
      </div>
    </div>
  );
}


