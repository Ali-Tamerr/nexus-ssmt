'use client';

import { useState } from 'react';
import { X, Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useAuthStore((s) => s.login);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!validatePassword(password)) {
      setError('Password must be at least 6 characters with letters and numbers');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signup') {
        console.log('[Auth] Registering user...');
        const profile = await api.auth.register({
          email,
          password,
          displayName: displayName || undefined,
        });
        console.log('[Auth] Registration successful:', profile);
        login(profile);
        onClose();
        resetForm();
      } else {
        console.log('[Auth] Looking up user by email...');
        const profile = await api.profiles.getByEmail(email);
        console.log('[Auth] Login successful:', profile);
        login(profile);
        onClose();
        resetForm();
      }
    } catch (err) {
      console.error('Auth error:', err);

      if (err instanceof Error) {
        if (err.message.includes('404') || err.message.includes('Not Found')) {
          if (mode === 'login') {
            setError('Account not found. Please sign up first.');
          } else {
            setError('Registration failed. The server returned 404 - check if the API endpoint exists.');
          }
        } else if (err.message.includes('Failed to fetch')) {
          setError('Cannot connect to server. Please check if the backend is running.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError(null);
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-indigo-600">
            <span className="text-2xl font-bold text-white">N</span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {mode === 'login'
              ? 'Sign in to access your knowledge graphs'
              : 'Start building your knowledge graph today'}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-zinc-300">Display Name</label>
              <div className="relative mt-2">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg bg-zinc-800 py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-700 transition-all focus:ring-[#265fbd]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300">Email</label>
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg bg-zinc-800 py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-700 transition-all focus:ring-[#265fbd]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Password</label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg bg-zinc-800 py-3 pl-11 pr-12 text-sm text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-700 transition-all focus:ring-[#265fbd]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {mode === 'signup' && (
              <p className="mt-2 text-xs text-zinc-500">
                At least 6 characters with letters and numbers
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3B82F6] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#265fbd] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              mode === 'login' ? 'Sign in' : 'Create account'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-zinc-400">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={switchMode}
              className="font-medium text-violet-400 hover:text-violet-300"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
