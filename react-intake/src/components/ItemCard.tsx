import { useState } from 'react';
import { Camera, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import { IntakeItem, AVAILABLE_FIELDS, FieldId } from '../types';

interface ItemCardProps {
  item: IntakeItem;
  index: number;
}

export default function ItemCard({ item, index }: ItemCardProps) {
  const { 
    updateItem, 
    enabledFields, 
    isViewOnly,
    setAddingPhotoForItem,
    removePhotoFromItem,
  } = useStore();
  
  const [expanded, setExpanded] = useState(true);

  const handleFieldChange = (field: keyof IntakeItem, value: string | number) => {
    updateItem(index, { [field]: value });
  };

  const renderField = (fieldId: FieldId) => {
    if (!enabledFields[fieldId] && fieldId !== 'name') return null;
    
    const config = AVAILABLE_FIELDS[fieldId];
    const value = item[fieldId as keyof IntakeItem];

    switch (config.type) {
      case 'text':
        // Special handling for dimensions - show 3 boxes
        if (fieldId === 'dimensions') {
          const dimValue = (value as string) || '';
          const parts = dimValue.split(' x ').map(p => p.replace(/"/g, '').trim());
          const [length = '', width = '', height = ''] = parts;
          
          const updateDimensions = (l: string, w: string, h: string) => {
            const formatted = [l, w, h].filter(Boolean).join('" x ') + (l || w || h ? '"' : '');
            handleFieldChange('dimensions', formatted || '');
          };
          
          return (
            <div key={fieldId}>
              <label className="st-label">{config.label}</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    className="st-input text-center"
                    value={length}
                    onChange={(e) => updateDimensions(e.target.value, width, height)}
                    disabled={isViewOnly}
                    placeholder="L"
                  />
                </div>
                <span className="text-text-muted">×</span>
                <div className="flex-1">
                  <input
                    type="text"
                    className="st-input text-center"
                    value={width}
                    onChange={(e) => updateDimensions(length, e.target.value, height)}
                    disabled={isViewOnly}
                    placeholder="W"
                  />
                </div>
                <span className="text-text-muted">×</span>
                <div className="flex-1">
                  <input
                    type="text"
                    className="st-input text-center"
                    value={height}
                    onChange={(e) => updateDimensions(length, width, e.target.value)}
                    disabled={isViewOnly}
                    placeholder="H"
                  />
                </div>
              </div>
            </div>
          );
        }
        
        return (
          <div key={fieldId}>
            <label className="st-label">{config.label}</label>
            <input
              type="text"
              className="st-input"
              value={value as string}
              onChange={(e) => handleFieldChange(fieldId as keyof IntakeItem, e.target.value)}
              disabled={isViewOnly}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={fieldId}>
            <label className="st-label">{config.label}</label>
            <textarea
              className="st-textarea"
              rows={2}
              value={value as string}
              onChange={(e) => handleFieldChange(fieldId as keyof IntakeItem, e.target.value)}
              disabled={isViewOnly}
            />
          </div>
        );

      case 'number':
        return (
          <div key={fieldId}>
            <label className="st-label">{config.label}</label>
            <input
              type="number"
              className="st-input"
              min={1}
              value={value as number}
              onChange={(e) => handleFieldChange(fieldId as keyof IntakeItem, parseInt(e.target.value) || 1)}
              disabled={isViewOnly}
            />
          </div>
        );

      case 'currency':
        return (
          <div key={fieldId}>
            <label className="st-label">{config.label}</label>
            <input
              type="number"
              className="st-input"
              min={0}
              step={0.01}
              value={value as number}
              onChange={(e) => handleFieldChange(fieldId as keyof IntakeItem, parseFloat(e.target.value) || 0)}
              disabled={isViewOnly}
            />
          </div>
        );

      case 'select':
        return (
          <div key={fieldId}>
            <label className="st-label">{config.label}</label>
            <select
              className="st-select"
              value={value as string}
              onChange={(e) => handleFieldChange(fieldId as keyof IntakeItem, e.target.value)}
              disabled={isViewOnly}
            >
              {config.options?.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="st-card">
      {/* Header */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h4 className="font-semibold">Item {index + 1}</h4>
        <button className="p-1 hover:bg-surface rounded">
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Photos Column */}
            <div className="w-full md:w-48 flex-shrink-0">
              {/* Photo thumbnails */}
              {item.photos.length > 0 ? (
                <div className="space-y-2">
                  <img 
                    src={item.photos[0]} 
                    alt={`Item ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-surface-border"
                  />
                  <p className="text-sm text-text-secondary text-center">
                    {item.photos.length} photo{item.photos.length > 1 ? 's' : ''}
                  </p>
                  
                  {/* Photo gallery */}
                  {item.photos.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                      {item.photos.slice(1, 4).map((photo, photoIdx) => (
                        <div key={photoIdx} className="relative">
                          <img 
                            src={photo}
                            alt={`Photo ${photoIdx + 2}`}
                            className="w-12 h-12 object-cover rounded"
                          />
                          {!isViewOnly && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removePhotoFromItem(index, photoIdx + 1);
                              }}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-error rounded-full flex items-center justify-center"
                            >
                              <X size={12} className="text-white" />
                            </button>
                          )}
                        </div>
                      ))}
                      {item.photos.length > 4 && (
                        <div className="w-12 h-12 bg-surface rounded flex items-center justify-center text-sm text-text-muted">
                          +{item.photos.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-32 bg-surface rounded-lg border border-surface-border flex items-center justify-center">
                  <span className="text-text-muted text-sm">No photos</span>
                </div>
              )}

              {/* Add photos button */}
              {!isViewOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddingPhotoForItem(index);
                  }}
                  className="w-full mt-2 st-button text-sm"
                >
                  <Camera size={16} className="inline mr-1" />
                  {item.photos.length > 0 ? 'Manage Photos' : 'Add Photos'}
                </button>
              )}

              {/* Status toggle */}
              {enabledFields.status && (
                <div className="mt-4">
                  <label className="st-label">Status</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFieldChange('status', 'Accept')}
                      disabled={isViewOnly}
                      className={`
                        flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors
                        ${item.status === 'Accept' 
                          ? 'bg-success text-white' 
                          : 'bg-surface text-text-secondary hover:bg-surface-hover'}
                      `}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleFieldChange('status', 'Reject')}
                      disabled={isViewOnly}
                      className={`
                        flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors
                        ${item.status === 'Reject' 
                          ? 'bg-error text-white' 
                          : 'bg-surface text-text-secondary hover:bg-surface-hover'}
                      `}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Fields Column */}
            <div className="flex-1 space-y-4">
              {/* Name (always shown) */}
              {renderField('name')}

              {/* Notes */}
              {renderField('notes')}

              {/* Row of small fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {renderField('price')}
                {renderField('quantity')}
                {renderField('condition')}
                {renderField('category')}
              </div>

              {/* Dimensions */}
              {renderField('dimensions')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


