import { UserPlus, Users } from 'lucide-react';
import { useStore } from '../../store/useStore';

export default function ConsignerTypeStep() {
  const { setConsignerType, setIntakeStep } = useStore();

  const handleSelectType = (type: 'new' | 'existing') => {
    setConsignerType(type);
    setIntakeStep('consigner-info');
  };

  return (
    <div className="animate-in">
      <h2 className="text-xl font-semibold mb-2">Step 1: Consigner Type</h2>
      <p className="text-text-secondary mb-8">
        Is this a new consigner or an existing consigner?
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* New Consigner */}
        <button
          onClick={() => handleSelectType('new')}
          className="st-card hover:border-primary/50 transition-all duration-200 text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <UserPlus size={28} />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">New Consigner</h3>
              <p className="text-text-secondary text-sm">
                First time consigning with us. We'll collect their contact information.
              </p>
            </div>
          </div>
        </button>

        {/* Existing Consigner */}
        <button
          onClick={() => handleSelectType('existing')}
          className="st-card hover:border-primary/50 transition-all duration-200 text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <Users size={28} />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Existing Consigner</h3>
              <p className="text-text-secondary text-sm">
                Has consigned before. Just need their name and consigner number.
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}


