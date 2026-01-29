'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import { Info, Search, ChevronDown, Save, ChevronRight, LayoutGrid } from 'lucide-react';
import NexusLogo from '@/assets/Logo/Logo with no circle.svg';
import { SearchInput } from '@/components/ui/Input';
import { createColorImage } from '@/lib/imageUtils';

interface PreviewNavbarProps {
    projectName: string;
    projectDescription: string;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onExportPNG: () => void;
    onExportJPG: () => void;
    currentWallpaper?: string;
    onWallpaperChange?: (wallpaper: string) => void;
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

export function PreviewNavbar({
    projectName,
    projectDescription,
    searchQuery,
    setSearchQuery,
    onExportPNG,
    onExportJPG,
    currentWallpaper,
    onWallpaperChange
}: PreviewNavbarProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSaveAsMenuOpen, setIsSaveAsMenuOpen] = useState(false);
    const [showDescription, setShowDescription] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as any)) {
                setIsMenuOpen(false);
                setIsSaveAsMenuOpen(false);
            }
        }
        // Capture phase to ensure we catch clicks even if propagation is stopped (e.g. by Canvas)
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, []);

    const handleColorSelect = (color: string) => {
        if (onWallpaperChange) {
            const base64Image = createColorImage(color);
            onWallpaperChange(base64Image);
        }
        // Keep menu open or close? ProjectNavbar closes it.
        // But ProjectNavbar has dedicated Wallpaper menu state.
        // Here we embed it in the main dropdown?
        // ProjectNavbar renders it inside `isMenuOpen`.
        // I will follow ProjectNavbar layout.
    };

    return (
        <header className="absolute top-0 left-0 right-0 z-20 flex h-14 items-center justify-between border-b border-zinc-800/20 bg-zinc-900/30 backdrop-blur-md px-4 pointer-events-none">
            <div className="flex items-center gap-3 pointer-events-auto">
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-0.5 transition-colors cursor-pointer hover:bg-zinc-800"
                    >
                        <div className="relative h-8 w-8">
                            <NextImage src={NexusLogo} alt="Nexus Logo" fill className="object-contain" />
                        </div>
                        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isMenuOpen && (
                        <div className="absolute top-full left-0 mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl p-1.5 z-50 flex flex-col gap-1">
                            {/* Wallpaper Section */}
                            <div className="px-3 py-2">
                                <p className="text-xs font-medium text-zinc-500 mb-2">Wallpaper</p>
                                <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                                    {WALLPAPER_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => handleColorSelect(color)}
                                            className="w-6 h-6 rounded-full transition-transform cursor-pointer hover:scale-110 border border-zinc-700"
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
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
                                                onExportPNG();
                                            }}
                                        >
                                            <span>PNG</span>
                                        </button>
                                        <button
                                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                                            onClick={() => {
                                                setIsSaveAsMenuOpen(false);
                                                setIsMenuOpen(false);
                                                onExportJPG();
                                            }}
                                        >
                                            <span>JPG</span>
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
                                <span className="text-zinc-300">Home</span>
                            </Link>
                        </div>
                    )}
                </div>

                <div className="h-6 w-px bg-zinc-800/50" />

                <div className='flex items-center gap-3'>
                    <div className="relative">
                        <button
                            onClick={() => setShowDescription(!showDescription)}
                            className={`flex items-center justify-center rounded-md p-1 transition-colors ${showDescription ? 'text-white' : 'text-zinc-500 hover:text-white'}`}
                            title={projectDescription ? "Show description" : "No description"}
                        >
                            <Info className="h-5 w-5" />
                        </button>
                        {showDescription && projectDescription && (
                            <div className="absolute top-full left-0 mt-2 w-72 rounded-xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-md p-4 text-sm text-zinc-300 shadow-2xl z-50 whitespace-pre-wrap animate-in fade-in zoom-in-95 duration-200">
                                {projectDescription}
                            </div>
                        )}
                    </div>

                    <div>
                        <h1 className="text-sm font-semibold text-white">{projectName || 'Project'}</h1>
                        <p className="text-[10px] text-zinc-500">Preview Mode</p>
                    </div>
                </div>
            </div>

            <div className="pointer-events-auto w-64">
                <SearchInput
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search nodes..."
                />
            </div>
        </header>
    );
}
