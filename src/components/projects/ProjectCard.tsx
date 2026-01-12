'use client';

import { useState } from 'react';
import { ChevronRight, FolderOpen, Loader2 } from 'lucide-react';
import { Project } from '@/types/knowledge';

interface ProjectCardProps {
  project: Project;
  onClick: (project: Project) => void;
  viewMode?: 'grid' | 'list';
}

export function ProjectCard({ project, onClick, viewMode = 'grid' }: ProjectCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isListView = viewMode === 'list';

  const handleClick = () => {
    setIsLoading(true);
    onClick(project);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        group relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left 
        transition-all hover:border-zinc-700 hover:bg-zinc-900
        disabled:cursor-wait disabled:opacity-80
        ${isListView ? 'flex items-center justify-between' : ''}
      `}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-zinc-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-[#3B82F6]" />
            <span className="text-sm text-zinc-300">Loading...</span>
          </div>
        </div>
      )}

      <div className={isListView ? 'flex items-center gap-4' : ''}>
        <div className="flex items-start gap-3">

          <div className="flex items-center gap-3">
            {project.color && (
              <div
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
            )}
            <h3 className="font-semibold text-white group-hover:text-[#3B82F6] transition-colors">
              {project.name}
            </h3>
            <ChevronRight className="h-5 w-5 -ml-1 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400" />

          </div>
          {project.description && (
            <p className="mt-1 text-sm text-zinc-500 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>

        <div className={`flex items-center gap-3 text-xs text-zinc-500 ${!isListView ? 'mt-4' : ''}`}>
          <span className="text-zinc-600">
            {new Date(project.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

    </button>
  );
}

interface ProjectGridProps {
  projects: Project[];
  viewMode: 'grid' | 'list';
  onProjectClick: (project: Project) => void;
}

export function ProjectGrid({ projects, viewMode, onProjectClick }: ProjectGridProps) {
  if (projects.length === 0) {
    return <EmptyProjectsState />;
  }

  return (
    <div className={
      viewMode === 'grid'
        ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
        : 'flex flex-col gap-3'
    }>
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onClick={onProjectClick}
          viewMode={viewMode}
        />
      ))}
    </div>
  );
}

export function EmptyProjectsState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <FolderOpen className="h-16 w-16 text-zinc-700" />
      <p className="mt-4 text-lg text-zinc-400">No projects found</p>
      <p className="text-sm text-zinc-500">Create your first project to get started</p>
    </div>
  );
}
