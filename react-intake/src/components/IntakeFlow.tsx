import { useStore } from '../store/useStore';
import ConsignerTypeStep from './steps/ConsignerTypeStep';
import ConsignerInfoStep from './steps/ConsignerInfoStep';
import ItemEntryStep from './steps/ItemEntryStep';
import FormPreview from './FormPreview';

export default function IntakeFlow() {
  const { intakeStep, currentForm, isViewOnly } = useStore();

  // Show loading if no form initialized
  if (!currentForm) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-text-secondary">Loading...</div>
      </div>
    );
  }

  // If viewing preview
  if (intakeStep === 'preview') {
    return <FormPreview />;
  }

  // Step rendering
  const renderStep = () => {
    switch (intakeStep) {
      case 'consigner-type':
        return <ConsignerTypeStep />;
      case 'consigner-info':
        return <ConsignerInfoStep />;
      case 'item-entry':
        return <ItemEntryStep />;
      default:
        return <ConsignerTypeStep />;
    }
  };

  return (
    <div className="animate-in">
      {/* View only badge */}
      {isViewOnly && (
        <div className="inline-block px-3 py-1 bg-info/20 text-info rounded-full text-sm mb-4">
          View Only
        </div>
      )}

      {/* Progress indicator */}
      {!isViewOnly && (
        <div className="flex items-center gap-2 mb-6">
          <StepIndicator 
            step={1} 
            label="Consigner" 
            active={intakeStep === 'consigner-type' || intakeStep === 'consigner-info'} 
            completed={intakeStep === 'item-entry'} 
          />
          <div className="h-0.5 w-8 bg-surface-border" />
          <StepIndicator 
            step={2} 
            label="Items" 
            active={intakeStep === 'item-entry'} 
            completed={false} 
          />
          <div className="h-0.5 w-8 bg-surface-border" />
          <StepIndicator 
            step={3} 
            label="Sign" 
            active={false} 
            completed={false} 
          />
        </div>
      )}

      <div className="st-divider" />

      {/* Step content */}
      {renderStep()}
    </div>
  );
}

interface StepIndicatorProps {
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
}

function StepIndicator({ step, label, active, completed }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div 
        className={`
          w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
          transition-colors duration-200
          ${completed ? 'bg-success text-white' : 
            active ? 'bg-primary text-white' : ''}
        `}
        style={!completed && !active ? { backgroundColor: 'var(--surface)', color: 'var(--text-muted)' } : {}}
      >
        {completed ? '✓' : step}
      </div>
      <span 
        className="text-sm"
        style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}
      >
        {label}
      </span>
    </div>
  );
}

