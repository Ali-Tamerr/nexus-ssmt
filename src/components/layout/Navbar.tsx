'use client';

import Link from 'next/link';
import { Search, ArrowLeft } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { useAuthStore } from '@/store/useAuthStore';

interface NavbarProps {
  showSearch?: boolean;
  onSearchClick?: () => void;
  children?: React.ReactNode;
}

export function Navbar({ showSearch = true, onSearchClick, children }: NavbarProps) {
  const { user, isAuthenticated } = useAuthStore();

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 opacity-75 blur" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900">
              <span className="text-xl font-bold text-white">N</span>
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Nexus</h1>
            <p className="text-[10px] text-zinc-500">Knowledge Graph Explorer</p>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {children}
        
        {isAuthenticated && user && showSearch && (
          <button 
            onClick={onSearchClick}
            className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search...</span>
            <kbd className="ml-2 hidden rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 sm:inline">⌘K</kbd>
          </button>
        )}
        
        {isAuthenticated && user && <UserMenu />}
      </div>
    </header>
  );
}

interface ProjectNavbarProps {
  projectName?: string;
  projectColor?: string;
  nodeCount?: number;
  children?: React.ReactNode;
}

export function ProjectNavbar({ projectName, projectColor, nodeCount = 0, children }: ProjectNavbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Projects</span>
        </Link>
        
        <div className="h-6 w-px bg-zinc-800" />
        
        <div className="flex items-center gap-2">
          {projectColor && (
            <div 
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: projectColor }}
            />
          )}
          <div>
            <h1 className="text-sm font-semibold text-white">{projectName || 'Project'}</h1>
            <p className="text-[10px] text-zinc-500">{nodeCount} nodes</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {children}
        <UserMenu />
      </div>
    </header>
  );
}

interface AuthNavProps {
  onLogin: () => void;
  onSignup: () => void;
}

export function AuthNav({ onLogin, onSignup }: AuthNavProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onLogin}
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
      >
        Sign in
      </button>
      <button
        onClick={onSignup}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
      >
        Get Started
      </button>
    </div>
  );
}
