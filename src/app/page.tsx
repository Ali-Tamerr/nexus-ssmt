'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Github } from 'lucide-react';

import { useGraphStore } from '@/store/useGraphStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/context/ToastContext';
import { Project } from '@/types/knowledge';
import { api } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/utils/errorUtils';

import { LoadingScreen, LoadingOverlay } from '@/components/ui';
import { Navbar, AuthNav } from '@/components/layout';
import { ProjectGrid, ProjectsToolbar, CreateProjectModal, EditProjectModal } from '@/components/projects';
import { WelcomeHero } from '@/components/home/WelcomeHero';
import { AuthModal } from '@/components/auth/AuthModal';

function AuthErrorHandlerContent() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (errorParam && window.opener) {
      window.opener.postMessage({ type: 'NEXUS_AUTH_ERROR', error: errorParam }, window.location.origin);
      try { window.close(); } catch (e) { }
    }
  }, [errorParam]);

  return null;
}

function AuthErrorHandler() {
  return (
    <Suspense fallback={null}>
      <AuthErrorHandlerContent />
    </Suspense>
  );
}

export default function HomePage() {
  const router = useRouter();

  const {
    projects,
    setProjects,
    addProject,
    deleteProject,
    setCurrentProject,
    isCreateProjectOpen,
    toggleCreateProject,
    isLoading,
    setLoading,
    setCurrentUserId,
  } = useGraphStore();

  const { showToast, showConfirmation } = useToast();

  const { user, isAuthenticated, hasHydrated } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id);
    }
  }, [user, setCurrentUserId]);

  useEffect(() => {
    const loadProjects = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        const fetchedProjects = await api.projects.getByUser(user.id);
        setProjects(fetchedProjects);
      } catch (err) {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && user) {
      loadProjects();
    }
  }, [user, isAuthenticated, setProjects, setLoading]);

  const filteredProjects = projects
    .filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleCreateProject = async (data: { name: string; description?: string; color: string }) => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const newProject = await api.projects.create({
        name: data.name,
        description: data.description,
        color: data.color,
        userId: user.id,
      });
      addProject(newProject);
      toggleCreateProject(false);
    } catch (err) {
      console.error('Failed to create project:', err);
      showToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    router.push('/project/editor');
  };

  const handleEditProjectClick = (project: Project) => {
    setEditingProject(project);
  };

  const handleUpdateProject = async (data: { name: string; description?: string }) => {
    if (!editingProject) return;

    setLoading(true);
    try {
      const updatedProject = { ...editingProject, ...data };
      await api.projects.update(editingProject.id, updatedProject);
      setProjects(projects.map(p => p.id === editingProject.id ? updatedProject : p));
      setEditingProject(null);
      showToast('Project updated successfully',);
    } catch (err) {
      console.error('Failed to update project:', err);
      showToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!await showConfirmation(`Are you sure you want to delete "${project.name}"?`)) {
      return;
    }

    setLoading(true);
    try {
      await api.projects.delete(project.id);
      deleteProject(project.id);
      showToast('Project deleted',);
    } catch (err) {
      console.error('Failed to delete project:', err);
      deleteProject(project.id);
      showToast('Project deleted (local)', 'info');
    } finally {
      setLoading(false);
    }
  };

  const openAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  if (!hasHydrated) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Suspense fallback={null}>
        <AuthErrorHandler />
      </Suspense>
      <Navbar showSearch={false}>
        <a
          href="https://github.com/Ali-Tamerr/nexus--social-study-mapping-tool"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-9 w-9 border border-zinc-400 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          title="View on GitHub"
        >
          <Github className="h-5 w-5" />
        </a>
      </Navbar>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {!isAuthenticated ? (
          <WelcomeHero
            onSignup={() => openAuth('signup')}
            onLogin={() => openAuth('login')}
          />
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white">Projects</h2>
            </div>

            <ProjectsToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onCreateProject={() => toggleCreateProject(true)}
            />

            {isLoading ? (
              <LoadingOverlay message="Loading projects..." />
            ) : (
              <ProjectGrid
                projects={filteredProjects}
                viewMode={viewMode}
                onProjectClick={handleOpenProject}
                onProjectEdit={handleEditProjectClick}
                onProjectDelete={handleDeleteProject}
              />
            )}
          </>
        )}
      </main>

      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => toggleCreateProject(false)}
        onSubmit={handleCreateProject}
        loading={isLoading}
      />

      {editingProject && (
        <EditProjectModal
          isOpen={true}
          onClose={() => setEditingProject(null)}
          onSubmit={handleUpdateProject}
          loading={isLoading}
          initialData={{
            name: editingProject.name,
            description: editingProject.description
          }}
        />
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </div>
  );
}
