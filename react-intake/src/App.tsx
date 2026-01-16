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
import { Loader2, WifiOff, RefreshCw } from 'lucide-react';
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
  const [unsyncedCount, setUnsyncedCount] = useState(0);
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

    // Update unsynced count periodically
    const updateUnsyncedCount = async () => {
      const count = await getUnsyncedCount();
      setUnsyncedCount(count);
    };
    updateUnsyncedCount();
    const interval = setInterval(updateUnsyncedCount, 5000);

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

  // Manual sync handler
  const handleManualSync = async () => {
    if (isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      await fullSync();
      triggerFormsRefresh();
      const count = await getUnsyncedCount();
      setUnsyncedCount(count);
    } finally {
      setIsSyncing(false);
    }
  };

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
    <>
      {/* Update prompt */}
      <UpdatePrompt />

      {/* Offline/Sync status bar */}
      {(isOffline || unsyncedCount > 0) && (
        <div 
          className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-sm text-center flex items-center justify-center gap-2 ${
            isOffline ? 'bg-warning text-black' : 'bg-info text-white'
          }`}
        >
          {isOffline ? (
            <>
              <WifiOff size={16} />
              <span>You're offline. Changes will sync when connected.</span>
            </>
          ) : unsyncedCount > 0 ? (
            <>
              <span>{unsyncedCount} change{unsyncedCount !== 1 ? 's' : ''} pending sync</span>
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="ml-2 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors flex items-center gap-1"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Syncing...' : 'Sync now'}
              </button>
            </>
          ) : null}
        </div>
      )}
      
      <div className={isOffline || unsyncedCount > 0 ? 'pt-10' : ''}>
        <Layout>
          {showingUsers ? <UserManagement /> : renderContent()}
        </Layout>
      </div>
    </>
  );
}

export default App;
