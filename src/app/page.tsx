'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Github } from 'lucide-react';

import { useGraphStore } from '@/store/useGraphStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useProjectCollectionStore } from '@/store/useProjectCollectionStore';
import { useToast } from '@/context/ToastContext';
import { Project } from '@/types/knowledge';
import { api } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/utils/errorUtils';

import { LoadingScreen, LoadingOverlay } from '@/components/ui';
import { Navbar, AuthNav } from '@/components/layout';
import { ProjectGrid, ProjectsToolbar, CreateProjectModal, EditProjectModal } from '@/components/projects';
import { CreateGroupModal } from '@/components/projects/CreateGroupModal';
import { DeleteGroupModal } from '@/components/projects/DeleteGroupModal';
import { GroupList } from '@/components/projects/GroupList';
import { WelcomeHero } from '@/components/home/WelcomeHero';
import { AuthModal } from '@/components/auth/AuthModal';

function AuthErrorHandlerContent({ onSetTab }: { onSetTab: (t: 'all' | 'groups') => void }) {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const tabParam = searchParams.get('tab');

  useEffect(() => {
    if (tabParam === 'groups') {
      onSetTab('groups');
    }
  }, [tabParam, onSetTab]);

  useEffect(() => {
    if (errorParam && window.opener) {
      window.opener.postMessage({ type: 'NEXUS_AUTH_ERROR', error: errorParam }, window.location.origin);
      try { window.close(); } catch (e) { }
    }
  }, [errorParam]);

  return null;
}

function AuthErrorHandler({ onSetTab }: { onSetTab: (t: 'all' | 'groups') => void }) {
  return (
    <Suspense fallback={null}>
      <AuthErrorHandlerContent onSetTab={onSetTab} />
    </Suspense>
  );
}

export default function HomePage() {
  const router = useRouter();

  const collections = useProjectCollectionStore(state => state.collections);
  const fetchCollections = useProjectCollectionStore(state => state.fetchCollections);
  const setCollections = useProjectCollectionStore(state => state.setCollections);
  const isGroupsLoading = useProjectCollectionStore(state => state.isLoading);
  const updateCollection = useProjectCollectionStore(state => state.updateCollection);
  const createCollection = useProjectCollectionStore(state => state.createCollection);
  const deleteCollection = useProjectCollectionStore(state => state.deleteCollection);

  console.log('[Page] Render collections count:', collections.length, 'Example:', collections[0]);

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

  // Group Features State
  const [activeTab, setActiveTab] = useState<'all' | 'groups'>('all');
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  const fetchedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (user?.id && fetchedUserIdRef.current !== user.id) {
      // Clear previous user data to prevent leakage
      setProjects([]);
      setCollections([]);
      setCurrentProject(null);

      setCurrentUserId(user.id);
      fetchCollections(user.id);
      fetchedUserIdRef.current = user.id;
    }
  }, [user?.id, setCurrentUserId, fetchCollections, setProjects, setCollections, setCurrentProject]);

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
      (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (p.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const filteredGroups = collections
    .filter((g) =>
      (g.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (g.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
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



  const handleCreateGroup = async (data: { name: string; description?: string; projectIds: number[] }) => {
    if (!user?.id) return;

    try {
      await createCollection({
        name: data.name,
        description: data.description,
        userId: user.id,
        projectIds: data.projectIds
      });
      setIsCreateGroupOpen(false);
      setActiveTab('groups');
      showToast('Collection created successfully');
    } catch (err) {
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const editingGroup = collections.find(c => c.id === editingGroupId);

  const handleEditGroupClick = (group: typeof collections[0]) => {
    setEditingGroupId(group.id);
  };

  const handleUpdateGroup = async (data: { name: string; description?: string; projectIds: number[] }) => {
    if (!editingGroup || !user?.id) return;

    // We already have fresh data in editingGroup because it is derived from store collections

    try {
      await updateCollection(editingGroup.id, {
        name: data.name,
        description: data.description || "",
        projectIds: data.projectIds,
        userId: user.id
      });
      setEditingGroupId(null);
      showToast('Collection updated successfully');
    } catch (err) {
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  // Debug helper for group projects
  const getGroupProjectIds = (g: any) => {
    if (g.projectIds && g.projectIds.length > 0) {
      console.log('[Page] Using projectIds:', g.projectIds, 'Type:', typeof g.projectIds[0]);
      return g.projectIds.map((id: any) => Number(id));
    }
    // Priority 2: Items (from relationship)
    if (g.items && g.items.length > 0) return g.items.map((i: any) => Number(i.projectId));
    // Priority 3: Projects (derived)
    if (g.projects && g.projects.length > 0) return g.projects.map((p: any) => Number(p.id));

    // Fallback: checks for empty arrays that might be valid if nothing else exists
    const fallback = g.projectIds || g.items?.map((i: any) => i.projectId) || g.projects?.map((p: any) => p.id) || [];
    return fallback.map((id: any) => Number(id));
  };

  const [groupToDelete, setGroupToDelete] = useState<typeof collections[0] | null>(null);

  const handleDeleteGroupClick = (group: typeof collections[0]) => {
    setGroupToDelete(group);
  };

  const handleConfirmDeleteGroup = async (withProjects: boolean) => {
    if (!groupToDelete || !user?.id) return;

    try {
      if (withProjects && groupToDelete.items) {
        // Delete all projects in the group first
        const projectIds1 = groupToDelete.items.map(item => item.projectId);
        // If items are returned, use them. If not, use getById to be sure? 
        // Assuming items are populated in the list view for now.
        await Promise.all(projectIds1.map(pid => api.projects.delete(pid)));

        // Optimistically update local project list
        projectIds1.forEach(pid => deleteProject(pid));
      }

      await deleteCollection(groupToDelete.id);
      setGroupToDelete(null);
      showToast('Collection deleted successfully');
    } catch (err) {
      console.error('Failed to delete group:', err);
      showToast('Failed to delete collection', 'error');
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
        <AuthErrorHandler onSetTab={setActiveTab} />
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
              activeTab={activeTab}
              onTabChange={setActiveTab}
              selectionMode={false}
              onSelectionModeChange={() => { }}
              selectedCount={0}
              onCreateGroup={() => setIsCreateGroupOpen(true)}
            />

            {isLoading || isGroupsLoading ? (
              <LoadingOverlay message="Loading..." />
            ) : (
              <>
                {activeTab === 'all' ? (
                  <ProjectGrid
                    projects={filteredProjects}
                    viewMode={viewMode}
                    onProjectClick={handleOpenProject}
                    onProjectEdit={handleEditProjectClick}
                    onProjectDelete={handleDeleteProject}
                  />
                ) : (
                  <GroupList
                    groups={filteredGroups}
                    onDelete={handleDeleteGroupClick}
                    onEdit={handleEditGroupClick}
                    viewMode={viewMode}
                  />
                )}
              </>
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

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onSubmit={handleCreateGroup}
        loading={isGroupsLoading}
        availableProjects={projects}
      />

      {groupToDelete && (
        <DeleteGroupModal
          group={groupToDelete}
          isOpen={true}
          onClose={() => setGroupToDelete(null)}
          onDelete={handleConfirmDeleteGroup}
          loading={isGroupsLoading}
        />
      )}

      {editingGroup && (
        <CreateGroupModal
          key={`${editingGroup.id}-${editingGroup.updatedAt}`}
          isOpen={true}
          onClose={() => setEditingGroupId(null)}
          onSubmit={handleUpdateGroup}
          loading={isGroupsLoading}
          availableProjects={projects}
          initialData={{
            name: editingGroup.name,
            description: editingGroup.description,
            projectIds: getGroupProjectIds(editingGroup)
          }}
        />
      )}
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
