import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from './store/useStore';
import { useAuth } from './store/useAuth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import IntakeFlow from './components/IntakeFlow';
import FormPreview from './components/FormPreview';
import LoginPage from './components/LoginPage';
import UserManagement from './components/UserManagement';
import { Loader2 } from 'lucide-react';

function App() {
  const [searchParams] = useSearchParams();
  const { currentView, loadExistingForm, initNewForm, currentForm } = useStore();
  const { isAuthenticated, isLoading, initialize } = useAuth();

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle URL-based form recovery
  useEffect(() => {
    if (isAuthenticated) {
      const formId = searchParams.get('form');
      if (formId && !currentForm) {
        loadExistingForm(formId);
      } else if (!currentForm) {
        initNewForm();
      }
    }
  }, [searchParams, currentForm, loadExistingForm, initNewForm, isAuthenticated]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-primary mx-auto mb-4" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'preview':
        return <FormPreview />;
      case 'intake':
      default:
        return <IntakeFlow />;
    }
  };

  // Check if showing user management (via URL or state)
  const showingUsers = searchParams.get('view') === 'users';

  return (
    <Layout>
      {showingUsers ? <UserManagement /> : renderContent()}
    </Layout>
  );
}

export default App;
