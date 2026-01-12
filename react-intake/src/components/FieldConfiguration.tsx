import { useStore } from '../store/useStore';
import { AVAILABLE_FIELDS, FieldId } from '../types';

export default function FieldConfiguration() {
  const { enabledFields, toggleField } = useStore();

  const fieldIds = Object.keys(AVAILABLE_FIELDS) as FieldId[];

  return (
    <div>
      <h4 className="font-medium mb-3">Configure Form Fields</h4>
      <p className="text-sm text-text-secondary mb-4">
        Select which fields to include for each item:
      </p>

      <div className="grid grid-cols-2 gap-3">
        {fieldIds.map((fieldId) => {
          const config = AVAILABLE_FIELDS[fieldId];
          const isEnabled = enabledFields[fieldId];
          const isRequired = config.required;

          return (
            <label
              key={fieldId}
              className={`
                flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors
                ${isRequired ? 'bg-surface-hover cursor-not-allowed' : 'hover:bg-surface-hover'}
              `}
            >
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={() => !isRequired && toggleField(fieldId)}
                disabled={isRequired}
                className="rounded"
              />
              <span className={isRequired ? 'text-text-muted' : ''}>
                {config.label}
                {isRequired && (
                  <span className="text-xs text-text-muted ml-1">(required)</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}


