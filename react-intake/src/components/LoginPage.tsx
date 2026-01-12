import { useState } from 'react';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../store/useAuth';
import ThemeToggle from './ThemeToggle';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password);
      
      if (!result.success) {
        setError(result.error || 'Login failed');
        setPassword('');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with theme toggle */}
      <header className="p-4 flex justify-end">
        <ThemeToggle />
      </header>

      {/* Login form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="/ConsignbyDesignlogo-border_240x@2x.avif"
              alt="Consigned By Design"
              className="h-20 mx-auto mb-4 object-contain"
            />
            <h1 className="text-2xl font-bold text-text">CBD Intake</h1>
            <p className="text-text-secondary mt-2">Sign in to continue</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="st-card">
            {error && (
              <div className="st-error mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="st-label">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="email"
                    className="st-input pl-10"
                    placeholder="Enter email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="st-label">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="st-input pl-10 pr-10"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full st-button-primary mt-6"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Help text */}
          <p className="text-center text-sm text-text-muted mt-6">
            Contact an administrator if you need an account
          </p>
        </div>
      </div>
    </div>
  );
}
