import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from './store/useStore';
import { useAuth } from './store/useAuth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import IntakeFlow from './components/IntakeFlow';
import FormPreview from './components/FormPreview';
import LoginPage from './components/LoginPage';
import UserManagement from './components/UserManagement';
import UpdatePrompt from './components/UpdatePrompt';
import { Loader2, WifiOff } from 'lucide-react';
import { 
  setupOnlineSync, 
  subscribeToRealtimeUpdates, 
  fullSync,
  getUnsyncedCount,
} from './db';

function App() {
  const [searchParams] = useSearchParams();
  const { currentView, loadExistingForm, initNewForm, currentForm, triggerFormsRefresh } = useStore();
  const { isAuthenticated, isLoading, initialize, isOffline } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Setup sync and realtime subscriptions when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    // Setup online/offline sync listener
    const cleanupSync = setupOnlineSync();

    // Subscribe to realtime updates
    const cleanupRealtime = subscribeToRealtimeUpdates(() => {
      // Refresh UI when remote changes come in
      console.log('[App] Realtime update received, refreshing UI');
      triggerFormsRefresh();
    });

    // Initial sync
    if (navigator.onLine) {
      setIsSyncing(true);
      fullSync().finally(() => {
        setIsSyncing(false);
        triggerFormsRefresh();
      });
    }

    // Auto-sync periodically in background
    const autoSync = async () => {
      if (!navigator.onLine || isSyncing) return;

      try {
        const count = await getUnsyncedCount();
        if (count > 0) {
          setIsSyncing(true);
          await fullSync();
          triggerFormsRefresh();
        } else {
          // Periodic pull to catch remote changes
          const result = await fullSync();
          if (result.pulled > 0) {
            triggerFormsRefresh();
          }
        }
      } catch (error) {
        console.error('[App] Auto-sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    // Run initial sync check
    autoSync();

    // Set up interval for periodic syncs
    const interval = setInterval(autoSync, 10000); // Sync every 10 seconds

    return () => {
      cleanupSync();
      cleanupRealtime();
      clearInterval(interval);
    };
  }, [isAuthenticated, triggerFormsRefresh]);

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
      <>
        <UpdatePrompt />
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-primary mx-auto mb-4" />
            <p className="text-text-secondary">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <UpdatePrompt />
        <LoginPage />
      </>
    );
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
    <>
      {/* Update prompt */}
      <UpdatePrompt />

      {/* Offline status bar - only show when offline */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 py-2 text-sm text-center flex items-center justify-center gap-2 bg-warning text-black">
          <WifiOff size={16} />
          <span>You're offline. Changes will sync when connected.</span>
        </div>
      )}

      <div className={isOffline ? 'pt-10' : ''}>
        <Layout>
          {showingUsers ? <UserManagement /> : renderContent()}
        </Layout>
      </div>
    </>
  );
}

export default App;
