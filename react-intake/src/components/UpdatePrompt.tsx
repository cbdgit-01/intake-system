import { useEffect, useState, useCallback } from 'react';

const UpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    try {
      // Fetch version.json with cache busting
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const serverVersion = data.version;

        // Get stored version from localStorage
        const storedVersion = localStorage.getItem('app_version');

        if (!storedVersion) {
          // First visit - store the version
          localStorage.setItem('app_version', serverVersion);
          setCurrentVersion(serverVersion);
        } else if (storedVersion !== serverVersion) {
          // Version mismatch - update available!
          setCurrentVersion(serverVersion);
          setShowPrompt(true);
        }
      }
    } catch (error) {
      console.log('Version check error:', error);
    }
  }, []);

  useEffect(() => {
    // Check immediately
    checkForUpdates();

    // Check when app becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Check every 60 seconds
    const interval = setInterval(checkForUpdates, 60 * 1000);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForUpdates]);

  const handleUpdate = () => {
    // Update stored version before refresh
    if (currentVersion) {
      localStorage.setItem('app_version', currentVersion);
    }

    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }

    // Hard refresh
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        padding: '16px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.7))',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg, 8px)',
          padding: '16px 20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: 'var(--font-size-base, 16px)', fontWeight: 600, color: 'var(--text-primary)' }}>
            New Version Available
          </span>
          <span style={{ fontSize: 'var(--font-size-xs, 12px)', color: 'var(--text-muted)' }}>
            v{currentVersion}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleUpdate}
            style={{
              background: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md, 6px)',
              padding: '10px 20px',
              fontSize: 'var(--font-size-sm, 14px)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
          >
            Update
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-md, 6px)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '10px 16px',
              fontSize: 'var(--font-size-sm, 14px)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.borderColor = 'var(--text-muted)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.borderColor = 'var(--surface-border)';
            }}
          >
            Later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 480px) {
          .update-prompt-content {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};

export default UpdatePrompt;
