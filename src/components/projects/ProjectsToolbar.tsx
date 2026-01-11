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
}

export function ProjectsToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onCreateProject,
}: ProjectsToolbarProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="w-72">
        <SearchInput
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search for a project"
        />
      </div>

      <div className="flex items-center gap-3">
        <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} />
        
        <Button
          variant="success"
          onClick={onCreateProject}
          icon={<Plus className="h-4 w-4" />}
        >
          New project
        </Button>
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
        className={`rounded-md p-1.5 transition-colors ${
          viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
        }`}
        title="Grid view"
      >
        <Grid3X3 className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange('list')}
        className={`rounded-md p-1.5 transition-colors ${
          viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
        }`}
        title="List view"
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}
