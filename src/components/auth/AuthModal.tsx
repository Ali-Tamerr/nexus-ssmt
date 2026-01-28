'use client';

import { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { getFriendlyErrorMessage } from '@/utils/errorUtils';
import { api } from '@/lib/api';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import NexusLogo from '@/assets/Logo/Logo with no circle.svg';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  // Removed isGoogleLoading state as signIn handles it internally partially, but we can track if needed.
  // Actually signIn is async so we can use local loading state.
  const [error, setError] = useState<string | null>(null);

  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
    }
  }, [isOpen, initialMode]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      // 1. Get the auth URL without redirecting the main page
      const result = await signIn('google', {
        redirect: false,
        callbackUrl: '/auth/popup-close'
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      if (result?.url) {
        // 2. Open popup
        const width = 500;
        const height = 600;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
          result.url,
          'Google Sign In',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // 3. Monitor popup via postMessage
        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;

          if (event.data?.type === 'NEXUS_AUTH_SUCCESS') {
            window.removeEventListener('message', handleMessage);
            // popup will close itself
            window.location.reload();
          } else if (event.data?.type === 'NEXUS_AUTH_ERROR') {
            window.removeEventListener('message', handleMessage);
            // popup will close itself
            setError('Authentication failed: ' + (event.data.error || 'Unknown error'));
            setIsGoogleLoading(false);
          }
        };
        window.addEventListener('message', handleMessage);

        // We rely on postMessage for success (from /auth/popup-close) or error (from /?error=...).
        // We do NOT poll popup.closed to avoid COOP warnings.
        // If the user manually closes the popup, they must click "Cancel" in the UI.
      }

    } catch (err: any) {
      setError('Google login failed: ' + (err.message || String(err)));
      setIsGoogleLoading(false);
    }
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

    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        // For signup, we still register manually first to create the account in backend
        const profile = await api.auth.register({
          email,
          password,
          displayName: displayName || undefined,
          provider: 'email',
        });

        // Then sign in automatically
        const result = await signIn('credentials', {
          redirect: false,
          email,
          password
        });

        if (result?.error) throw new Error(result.error);

        onClose();
        resetForm();
      } else {
        const result = await signIn('credentials', {
          redirect: false,
          email,
          password
        });

        if (result?.error) throw new Error('Invalid email or password');

        onClose();
        resetForm();
      }
    } catch (err: any) {
      // Special case: Signup succeeded but auto-login failed
      if (mode === 'signup' && (err.message?.includes('CredentialsSignin') || err.message?.includes('Invalid email or password'))) {
        setError('Account created successfully, but auto-login failed. Please sign in manually.');
        setMode('login');
        return;
      }

      const friendlyMsg = getFriendlyErrorMessage(err);

      // Contextual overrides for AuthModal specifically
      if (friendlyMsg.includes('404') && mode === 'login') {
        setError('We couldn\'t find an account with that email. Please sign up.');
      } else if (friendlyMsg.includes('404') && mode === 'signup') {
        // If registering returns 404, it's weird (endpoint missing), but generic message is okay or specific hint.
        setError('Registration service unavailable (404). Please try again later.');
      } else {
        setError(friendlyMsg);
      }
    } finally {
      setIsSubmitting(false);
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
          <div className="mx-auto mb-4 relative h-14 w-14">
            <Image src={NexusLogo} alt="Nexus Logo" fill className="object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {mode === 'login'
              ? 'Sign in to access your social study projects'
              : 'Start building your social study projects today'}
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
            disabled={isSubmitting || isGoogleLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#355ea1] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#265fbd] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              mode === 'login' ? 'Sign in' : 'Create account'
            )}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-4">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-500">OR</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <button
          type="button"
          onClick={() => {
            if (isGoogleLoading) {
              setIsGoogleLoading(false);
            } else {
              handleGoogleLogin();
            }
          }}
          disabled={isSubmitting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {isGoogleLoading ? 'Connecting... (Click to Cancel)' : 'Continue with Google'}
        </button>

        <div className="mt-6 text-center">
          <p className="text-sm text-zinc-400">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={switchMode}
              className="font-medium text-[#355ea1] hover:text-[#6c9ff5]"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
