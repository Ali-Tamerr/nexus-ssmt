'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import NexusLogo from '@/assets/Logo/Logo with no circle.svg';
import { Search, ChevronDown, Image, Save, LayoutGrid, ChevronRight, Plus } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { useAuthStore } from '@/store/useAuthStore';
import { useGraphStore } from '@/store/useGraphStore';
import { createColorImage } from '@/lib/imageUtils';
import { SearchInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

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
          <div className="relative h-9 w-9">
            <NextImage src={NexusLogo} alt="Nexus Logo" fill className="object-contain" />
          </div>
          <div>
            <h1 className="text-lg max-md:text-sm font-bold tracking-tight text-white font-light font-ka1">Nexus</h1>
            <p className="text-[10px] max-md:text-[8px] text-zinc-400">Social Study Mapping Tool</p>
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
  onExportPNG?: () => void;
  onExportJPG?: () => void;
  onExportProject?: () => void;
  onAddNode?: () => void;
  isAddingNode?: boolean;
  isPreviewMode?: boolean;
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

export function ProjectNavbar({
  projectName,
  projectColor,
  nodeCount = 0,
  onExportPNG,
  onExportJPG,
  onExportProject,
  onAddNode,
  isAddingNode,
  isPreviewMode
}: ProjectNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWallpaperMenuOpen, setIsWallpaperMenuOpen] = useState(false);
  const [isSaveAsMenuOpen, setIsSaveAsMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const updateProject = useGraphStore(state => state.updateProject);
  const currentProject = useGraphStore(state => state.currentProject);
  const searchQuery = useGraphStore(state => state.searchQuery);
  const setSearchQuery = useGraphStore(state => state.setSearchQuery);

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
    <header className="relative flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-2 sm:px-4">
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-0.5 transition-colors cursor-pointer"
          >
            <div className="relative h-8 w-8">
              <NextImage src={NexusLogo} alt="Nexus Logo" fill className="object-contain" />
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
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer hover:scale-110 ${isSelected
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
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left cursor-pointer"
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
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                      onClick={() => {
                        setIsSaveAsMenuOpen(false);
                        setIsMenuOpen(false);
                        if (onExportPNG) onExportPNG();
                      }}
                    >
                      <span>PNG</span>
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                      onClick={() => {
                        setIsSaveAsMenuOpen(false);
                        setIsMenuOpen(false);
                        if (onExportJPG) onExportJPG();
                      }}
                    >
                      <span>JPG</span>
                    </button>
                    {/* <button
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                      onClick={() => {
                        setIsSaveAsMenuOpen(false);
                        setIsMenuOpen(false);
                        if (onExportProject) onExportProject();
                      }}
                    >
                      <span>Project File</span>
                    </button> */}
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
          <div>
            <h1 className="text-sm font-semibold text-white max-w-[120px] sm:max-w-xs truncate block" title={projectName || 'Project'}>{projectName || 'Project'}</h1>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        <div className="flex items-center">
          {/* Mobile Search Toggle */}
          {!isPreviewMode && !isMobileSearchOpen && (
            <button
              className="md:hidden flex items-center justify-center h-9 w-9 text-zinc-400 hover:text-white border border-zinc-600 hover:bg-zinc-800 rounded-full transition-colors"
              onClick={() => setIsMobileSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </button>
          )}

          {/* Desktop Search */}
          {!isPreviewMode && (
            <div className="hidden md:block w-64 transition-all duration-300">
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes..."
              />
            </div>
          )}

          {/* Mobile Search Overlay */}
          {isMobileSearchOpen && (
            <div className="fixed top-0 left-0 right-0 h-14 z-[200] flex items-center bg-zinc-950 px-2 sm:px-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex-1 relative max-w-4xl mx-auto w-full flex items-center">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search nodes..."
                  autoFocus
                  className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-4 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsMobileSearchOpen(false);
                  }}
                  onBlur={(e) => {
                    if (!e.target.value) setIsMobileSearchOpen(false);
                  }}
                />
              </div>
              <button
                onClick={() => {
                  setIsMobileSearchOpen(false);
                  setSearchQuery('');
                }}
                className="ml-3 text-sm font-medium text-zinc-400 hover:text-white whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {onAddNode && (
          <Button
            variant="brand"
            onClick={onAddNode}
            loading={isAddingNode}
            icon={<Plus className="h-4 w-4" />}
            className="px-2 sm:px-4"
          >
            <span className="hidden md:inline">Add Node</span>
          </Button>
        )}

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
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
      >
        Sign in
      </button>
      <button
        onClick={onSignup}
        className="rounded-lg bg-[#355ea1] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#265fbd] sm:px-4 sm:py-2 sm:text-sm"
      >
        Sign up
      </button>
    </div>
  );
}
