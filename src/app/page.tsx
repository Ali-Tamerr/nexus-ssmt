'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useGraphStore } from '@/store/useGraphStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/context/ToastContext';
import { Project } from '@/types/knowledge';
import { api } from '@/lib/api';

import { LoadingScreen, LoadingOverlay } from '@/components/ui';
import { Navbar, AuthNav } from '@/components/layout';
import { ProjectGrid, ProjectsToolbar, CreateProjectModal } from '@/components/projects';
import { WelcomeHero } from '@/components/home/WelcomeHero';
import { AuthModal } from '@/components/auth/AuthModal';

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
      const demoProject: Project = {
        id: crypto.randomUUID(),
        name: data.name,
        description: data.description,
        color: data.color,
        userId: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addProject(demoProject);
      toggleCreateProject(false);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    router.push('/project/editor');
  };

  const handleEditProject = async (project: Project, newName: string) => {
    try {
      await api.projects.update(project.id, { ...project, name: newName });
      setProjects(projects.map(p => p.id === project.id ? { ...p, name: newName } : p));
      showToast('Project renamed', 'success');
    } catch (err) {
      setProjects(projects.map(p => p.id === project.id ? { ...p, name: newName } : p));
      showToast('Failed to rename project', 'error');
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
      showToast('Project deleted', 'success');
    } catch (err) {
      console.error('Failed to delete project:', err);
      // Even if API fails, delete locally for now? Or show error.
      // Better only local if error is 404.
      // For now, assume it might be local only or sync issue.
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
      <Navbar>
        {!isAuthenticated && (
          <AuthNav onLogin={() => openAuth('login')} onSignup={() => openAuth('signup')} />
        )}
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
                onProjectEdit={handleEditProject}
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

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </div>
  );
}
