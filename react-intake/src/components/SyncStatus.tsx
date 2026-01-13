import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { subscribeSyncStatus, SyncStatus as SyncStatusType, syncFull } from '../db/syncService';

export default function SyncStatus() {
  const [status, setStatus] = useState<SyncStatusType>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    lastError: null
  });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(setStatus);
    return unsubscribe;
  }, []);

  const handleManualSync = () => {
    // Perform full bidirectional sync (push + pull)
    syncFull();
  };

  // Format last sync time
  const formatLastSync = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div className="relative">
      {/* Status indicator button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
          transition-all duration-200
          ${status.isOnline 
            ? status.pendingCount > 0 
              ? 'bg-warning/20 text-warning' 
              : 'bg-success/20 text-success'
            : 'bg-error/20 text-error'
          }
        `}
      >
        {status.isOnline ? (
          status.isSyncing ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : status.pendingCount > 0 ? (
            <Cloud size={14} />
          ) : (
            <Check size={14} />
          )
        ) : (
          <WifiOff size={14} />
        )}
        
        <span className="hidden sm:inline">
          {status.isOnline 
            ? status.isSyncing 
              ? 'Syncing...' 
              : status.pendingCount > 0 
                ? `${status.pendingCount} pending`
                : 'Synced'
            : 'Offline'
          }
        </span>
      </button>

      {/* Details dropdown */}
      {showDetails && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDetails(false)}
          />
          <div 
            className="absolute right-0 top-full mt-2 w-64 rounded-lg shadow-lg z-50 p-4"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--surface-border)' }}
          >
            {/* Connection status */}
            <div className="flex items-center gap-3 mb-3">
              {status.isOnline ? (
                <Wifi size={20} className="text-success" />
              ) : (
                <WifiOff size={20} className="text-error" />
              )}
              <div>
                <p className="font-medium">
                  {status.isOnline ? 'Online' : 'Offline'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {status.isOnline 
                    ? 'Connected to internet' 
                    : 'Working offline - changes saved locally'
                  }
                </p>
              </div>
            </div>

            <div className="st-divider my-3" />

            {/* Sync status */}
            <div className="flex items-center gap-3 mb-3">
              {status.pendingCount > 0 ? (
                <CloudOff size={20} className="text-warning" />
              ) : (
                <Cloud size={20} className="text-success" />
              )}
              <div>
                <p className="font-medium">
                  {status.pendingCount > 0 
                    ? `${status.pendingCount} changes pending`
                    : 'All synced'
                  }
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Last sync: {formatLastSync(status.lastSyncTime)}
                </p>
              </div>
            </div>

            {/* Error */}
            {status.lastError && (
              <div className="flex items-start gap-2 p-2 rounded bg-error/10 text-error text-sm mb-3">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{status.lastError}</span>
              </div>
            )}

            {/* Manual sync button */}
            {status.isOnline && status.pendingCount > 0 && (
              <button
                onClick={handleManualSync}
                disabled={status.isSyncing}
                className="w-full st-button-primary text-sm"
              >
                {status.isSyncing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin mr-2" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} className="mr-2" />
                    Sync now
                  </>
                )}
              </button>
            )}

            {/* Offline info */}
            {!status.isOnline && (
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Your changes will sync automatically when you're back online.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

