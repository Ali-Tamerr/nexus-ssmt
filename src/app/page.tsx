'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useGraphStore } from '@/store/useGraphStore';
import { useAuthStore } from '@/store/useAuthStore';
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
    setCurrentProject, 
    isCreateProjectOpen, 
    toggleCreateProject,
    isLoading,
    setLoading,
    setCurrentUserId,
  } = useGraphStore();

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
        console.log('Demo mode: Using local projects (API unavailable)');
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && user) {
      loadProjects();
    }
  }, [user, isAuthenticated, setProjects, setLoading]);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      console.log('Demo mode: Creating local project (API unavailable)');
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
    router.push(`/project/${project.id}`);
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
