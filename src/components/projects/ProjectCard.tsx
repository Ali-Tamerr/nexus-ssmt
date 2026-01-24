'use client';

import { useState } from 'react';
import { ChevronRight, FolderOpen, Loader2, Trash2, Pencil } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectCardProps {
  project: Project;
  onClick: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onEdit?: (project: Project, newName: string) => void;
  viewMode?: 'grid' | 'list';
}

export function ProjectCard({ project, onClick, onDelete, onEdit, viewMode = 'grid' }: ProjectCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editValue, setEditValue] = useState(project.name);
  const isListView = viewMode === 'list';

  const handleClick = () => {
    setIsLoading(true);
    onClick(project);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof onDelete === 'function') onDelete(project);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleEditSave = async () => {
    if (editValue.trim() && editValue.trim() !== project.name && typeof onEdit === 'function') {
      setIsSaving(true);
      setIsEditing(false);
      try {
        await onEdit(project, editValue.trim());
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  return (
    <div
      onClick={isLoading ? undefined : handleClick}
      role="button"
      tabIndex={isLoading ? -1 : 0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      className={`
        group relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left 
        transition-all hover:border-zinc-700 hover:bg-zinc-900 cursor-pointer
        ${isLoading ? 'cursor-wait opacity-80' : ''}
        ${isListView ? 'flex items-center justify-between' : ''}
      `}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-zinc-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-[#355ea1]" />
            <span className="text-sm text-zinc-300">Loading...</span>
          </div>
        </div>
      )}

      <div className={isListView ? 'flex items-center gap-4' : ''}>
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-3">
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin text-blue-400 flex-shrink-0" />
            ) : project.color ? (
              <div
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
            ) : null}
            {isEditing ? (
              <input
                className="bg-zinc-800 text-white rounded px-1 text-sm w-32 border border-zinc-700 outline-none"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onClick={e => e.stopPropagation()}
                onBlur={handleEditSave}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') handleEditSave();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                autoFocus
              />
            ) : (
              <h3 className="font-semibold text-white group-hover:text-[#355ea1] transition-colors">
                {project.name}
              </h3>
            )}
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
          <button
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 transition-colors"
            title="Edit project name"
            onClick={handleEdit}
            tabIndex={-1}
            type="button"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
            title="Delete project"
            onClick={handleDelete}
            tabIndex={-1}
            type="button"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProjectGridProps {
  projects: Project[];
  viewMode: 'grid' | 'list';
  onProjectClick: (project: Project) => void;
  onProjectDelete?: (project: Project) => void;
  onProjectEdit?: (project: Project, newName: string) => void;
}

export function ProjectGrid({ projects, viewMode, onProjectClick, onProjectDelete, onProjectEdit }: ProjectGridProps) {
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
          onDelete={onProjectDelete}
          onEdit={onProjectEdit}
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
