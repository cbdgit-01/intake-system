import { ReactNode, useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';
import UserMenu from './UserMenu';
import SyncStatus from './SyncStatus';
import { initOnlineListener, syncFromCloud, startPeriodicSync, stopPeriodicSync } from '../db/syncService';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize sync service
  useEffect(() => {
    const cleanupOnlineListener = initOnlineListener();
    
    // Initial sync from cloud
    syncFromCloud();
    
    // Start periodic sync every 30 seconds
    startPeriodicSync(30000);
    
    return () => {
      cleanupOnlineListener();
      stopPeriodicSync();
    };
  }, []);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-72 border-r
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ 
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--surface-border)'
        }}
      >
        <div className="flex items-center justify-between p-4 lg:hidden">
          <span className="font-semibold text-lg">Menu</span>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <X size={20} />
          </button>
        </div>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Header */}
        <header 
          className="sticky top-0 z-30 border-b p-4 flex items-center justify-between gap-4"
          style={{ 
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--surface-border)'
          }}
        >
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg"
              style={{ backgroundColor: 'var(--surface)' }}
            >
              <Menu size={24} />
            </button>
            <h1 className="font-semibold text-lg hidden sm:block">CBD Intake</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <SyncStatus />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 lg:p-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
