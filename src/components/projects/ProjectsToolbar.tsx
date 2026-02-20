'use client';

import { Search, Grid3X3, List, Plus } from 'lucide-react';
import { SearchInput } from '@/components/ui/Input';
import { Button, IconButton } from '@/components/ui/Button';

interface ProjectsToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onCreateProject: () => void;
  // New props
  activeTab: 'all' | 'groups';
  onTabChange: (tab: 'all' | 'groups') => void;
  selectionMode: boolean;
  onSelectionModeChange: (enabled: boolean) => void;
  selectedCount: number;
  onCreateGroup: () => void;
}

export function ProjectsToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onCreateProject,
  activeTab,
  onTabChange,
  selectionMode,
  onSelectionModeChange,
  selectedCount,
  onCreateGroup
}: ProjectsToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Left Side: Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <div className="flex rounded-lg bg-zinc-800/50 p-1 w-max">
          <button
            onClick={() => onTabChange('all')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
          >
            All Projects
          </button>
          <button
            onClick={() => onTabChange('groups')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === 'groups' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
          >
            Collections
          </button>
        </div>

        <div className="w-full sm:w-64">
          <SearchInput
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={activeTab === 'groups' ? "Search collections..." : "Search projects..."}
          />
        </div>
      </div>

      {/* Right Side: Actions */}
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {activeTab === 'all' && (
          <Button
            variant="brand"
            onClick={onCreateProject}
            icon={<Plus className="h-4 w-4" />}
            className="w-full sm:w-auto justify-center h-9"
          >
            New project
          </Button>
        )}

        {activeTab === 'groups' && (
          <Button
            variant="brand"
            onClick={onCreateGroup}
            icon={<Plus className="h-4 w-4" />}
            className="w-full sm:w-auto justify-center h-9"
          >
            New collection
          </Button>
        )}

        <div className="hidden sm:block">
          <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} />
        </div>
      </div>
    </div>
  );
}

interface ViewModeToggleProps {
  viewMode: 'grid' | 'list';
  onChange: (mode: 'grid' | 'list') => void;
}

export function ViewModeToggle({ viewMode, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex rounded-lg bg-zinc-800/50 p-1">
      <button
        onClick={() => onChange('grid')}
        className={`rounded-md p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        title="Grid view"
      >
        <Grid3X3 className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange('list')}
        className={`rounded-md p-1.5 transition-colors ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        title="List view"
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}
