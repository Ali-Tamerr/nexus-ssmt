'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, Image, Save, LayoutGrid, ChevronRight } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { useAuthStore } from '@/store/useAuthStore';
import { useGraphStore } from '@/store/useGraphStore';
import { createColorImage } from '@/lib/imageUtils';

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
            <div className="absolute -inset-1 rounded-full border-[0.2px] border-white" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900">
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
  onExportPNG?: () => void;
  onExportJPG?: () => void;
  onExportProject?: () => void;
}

const WALLPAPER_COLORS = [
  '#000000', // Black (Default)
  '#18181b', // Zinc 900
  '#09090b', // Zinc 950
  '#020617', // Slate 950
  '#0f172a', // Slate 900
  '#0a0a0a', // Neutral 950
  '#171717', // Neutral 900
  '#111827', // Gray 900
  '#0f0f0f', // Onyx
  '#1a1a1a', // Jet
];

export function ProjectNavbar({ projectName, projectColor, nodeCount = 0, children, onExportPNG, onExportJPG, onExportProject }: ProjectNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWallpaperMenuOpen, setIsWallpaperMenuOpen] = useState(false);
  const [isSaveAsMenuOpen, setIsSaveAsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const updateProject = useGraphStore(state => state.updateProject);
  const currentProject = useGraphStore(state => state.currentProject);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsWallpaperMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleColorSelect = (color: string) => {
    if (currentProject) {
      const base64Image = createColorImage(color);
      updateProject(currentProject.id, { wallpaper: base64Image });
    }
    setIsWallpaperMenuOpen(false);
    setIsMenuOpen(false);
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4">
      <div className="flex items-center gap-4">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 hover:bg-zinc-800/50 transition-colors"
          >
            <div className="relative">
              <div className="absolute -inset-0.5 rounded-full border-[0.2px] border-white/20" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900">
                <span className="text-sm font-bold text-white">N</span>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl p-1.5 z-50 flex flex-col gap-1">
              <div className="px-3 py-2">
                <p className="text-xs font-medium text-zinc-500 mb-2">Wallpaper</p>
                <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                  {WALLPAPER_COLORS.map((color) => {
                    const isSelected = currentProject?.wallpaper === color;
                    return (
                      <button
                        key={color}
                        onClick={() => handleColorSelect(color)}
                        className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${isSelected
                          ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900'
                          : 'border border-zinc-700'
                          }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="my-1 border-t border-zinc-800" />


              <div className="relative">
                <button
                  onClick={() => setIsSaveAsMenuOpen(!isSaveAsMenuOpen)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Save className="w-4 h-4" />
                    <span>Save as</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {isSaveAsMenuOpen && (
                  <div className="absolute left-full top-0 ml-2 w-48 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl p-2 z-50">
                    <p className="px-2 py-1 text-xs font-medium text-zinc-500 mb-1">Export as</p>
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                      onClick={() => {
                        setIsSaveAsMenuOpen(false);
                        setIsMenuOpen(false);
                        if (onExportPNG) onExportPNG();
                      }}
                    >
                      <span>PNG</span>
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                      onClick={() => {
                        setIsSaveAsMenuOpen(false);
                        setIsMenuOpen(false);
                        if (onExportJPG) onExportJPG();
                      }}
                    >
                      <span>JPG</span>
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                      onClick={() => {
                        setIsSaveAsMenuOpen(false);
                        setIsMenuOpen(false);
                        if (onExportProject) onExportProject();
                      }}
                    >
                      <span>Project File</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="my-1 border-t border-zinc-800" />

              <Link
                href="/"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Projects</span>
              </Link>
            </div>
          )}
        </div>

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
        className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#265fbd]"
      >
        Get Started
      </button>
    </div>
  );
}
