import { useStore } from '../../store/useStore';
import DetectionMode from '../modes/DetectionMode';
import GeneralMode from '../modes/GeneralMode';
import PrepopulateMode from '../modes/PrepopulateMode';

export default function ItemEntryStep() {
  const { currentForm } = useStore();

  const renderMode = () => {
    switch (currentForm?.intakeMode) {
      case 'detection':
        return <DetectionMode />;
      case 'prepopulate':
        return <PrepopulateMode />;
      case 'general':
      default:
        return <GeneralMode />;
    }
  };

  return (
    <div className="animate-in">
      {renderMode()}
    </div>
  );
}


