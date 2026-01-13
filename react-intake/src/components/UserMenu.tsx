import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, ChevronDown } from 'lucide-react';
import { useAuth } from '../store/useAuth';

export default function UserMenu() {
  const { currentUser, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  const handleManageUsers = () => {
    navigate('?view=users');
    setIsOpen(false);
  };


  if (!currentUser) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          {currentUser.name.charAt(0).toUpperCase()}
        </div>
        <span className="hidden sm:inline text-sm font-medium">{currentUser.name}</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg border overflow-hidden z-50"
          style={{ 
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--surface-border)'
          }}
        >
          {/* User info */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--surface-border)' }}>
            <p className="font-medium">{currentUser.name}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              @{currentUser.username} • {currentUser.role}
            </p>
          </div>

          {/* Menu items */}
          {currentUser.role === 'admin' && (
            <div className="py-1">
              <button
                onClick={handleManageUsers}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Users size={18} />
                <span>Admin Settings</span>
              </button>
            </div>
          )}

          {/* Logout */}
          <div className="py-1 border-t" style={{ borderColor: 'var(--surface-border)' }}>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-error transition-colors"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

