import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../store/useTheme';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg transition-colors ${className}`}
      style={{ backgroundColor: 'var(--surface)' }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun size={20} style={{ color: 'var(--warning)' }} />
      ) : (
        <Moon size={20} style={{ color: 'var(--primary)' }} />
      )}
    </button>
  );
}

