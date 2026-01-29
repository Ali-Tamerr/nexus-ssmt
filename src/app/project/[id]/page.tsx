'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';

import { useGraphStore, filterNodes } from '@/store/useGraphStore';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';

import { LoadingScreen, LoadingOverlay } from '@/components/ui';
import { SearchInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ProjectNavbar } from '@/components/layout';
import { GraphCanvas, GraphCanvasHandle } from '@/components/graph/GraphCanvas';
import { GraphControls } from '@/components/graph/GraphControls';
import { NodeEditor } from '@/components/editor/NodeEditor';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { exportProjectAsNxus } from '@/lib/projectExport';

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const graphCanvasRef = useRef<GraphCanvasHandle>(null);
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, isAuthenticated, hasHydrated } = useAuthStore();

  const {
    currentProject,
    setCurrentProject,
    nodes,
    setNodes,
    links,
    setLinks,
    searchQuery,
    setSearchQuery,
    graphSettings,
    setGraphSettings,
    addNode,
    isLoading,
    setLoading,
    shapes,
    groups,
    toggleCommandPalette,
  } = useGraphStore();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push('/');
    }
  }, [hasHydrated, isAuthenticated, router]);

  const dataLoadedRef = useRef(false);

  useEffect(() => {
    const loadProjectData = async () => {
      if (!isAuthenticated || dataLoadedRef.current) return;

      dataLoadedRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const project = await api.projects.getById(id);

        // Ownership Check
        if (project.userId !== user?.id) {
          throw new Error("Unauthorized");
        }

        setCurrentProject(project);

        const projectNodes = await api.nodes.getByProject(id);
        setNodes(projectNodes);

        const allLinks = await api.links.getAll();
        const nodeIds = new Set(projectNodes.map(n => n.id));
        const projectLinks = allLinks.filter(
          l => nodeIds.has(l.sourceId) || nodeIds.has(l.targetId)
        );
        setLinks(projectLinks);
      } catch (err: any) {
        if (err.message === "Unauthorized") {
          router.push('/');
          return;
        }

        setCurrentProject({
          id,
          name: 'Project',
          description: '',
          color: '#355ea1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userId: user?.id || 'unknown',
        });
        setNodes([]);
        setLinks([]);
      } finally {
        setLoading(false);
      }
    };

    if (hasHydrated && isAuthenticated) {
      loadProjectData();
    }

    return () => {
      dataLoadedRef.current = false;
    };
  }, [id, hasHydrated, isAuthenticated, setCurrentProject, setNodes, setLinks, setLoading]);

  const handleCreateNode = async () => {
    if (!currentProject) return;

    const GROUP_COLORS: Record<number, string> = {
      0: '#8B5CF6', 1: '#355ea1', 2: '#10B981', 3: '#F59E0B',
      4: '#EF4444', 5: '#EC4899', 6: '#06B6D4', 7: '#84CC16',
    };
    const colors = Object.values(GROUP_COLORS);
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Random position so nodes don't spawn on top of each other
    const randomX = (Math.random() - 0.5) * 150;
    const randomY = (Math.random() - 0.5) * 150;

    const demoNode = {
      id: Date.now() * -1,
      title: 'New Node',
      content: '',
      projectId: id,
      groupId: 0,
      customColor: randomColor,
      x: randomX,
      y: randomY,
      userId: user?.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setLoading(true);
    try {
      let groupId = 0;
      try {
        const groups = await api.groups.getAll();
        if (groups && groups.length > 0) {
          groupId = groups[0].id;
        } else {
          // Try to create default group if none exist?
          // console.warn('No groups found, defaulting to 0');
        }
      } catch (err) {
        // console.error('Failed to fetch groups:', err);
      }

      // If still 0, try to create a default group
      if (groupId === 0) {
        try {
          const newGroup = await api.groups.create({
            name: 'Default',
            color: '#808080',
            order: 0
          });
          if (newGroup) groupId = newGroup.id;
        } catch (e) {
          // If even creation fails, we can't do much but try 0 or 1
          // console.error('Failed to create default group:', e);
        }
      }

      let newNode = await api.nodes.create({
        title: 'New Node',
        content: '',
        projectId: id,
        groupId: groupId,
        customColor: randomColor,
        x: randomX,
        y: randomY,
        userId: user?.id,
      });

      // If backend didn't return position/color, force update with full node object
      if (newNode.x === null || newNode.x === undefined || newNode.customColor !== randomColor) {
        newNode = { ...newNode, x: randomX, y: randomY, customColor: randomColor };
        // Backend requires full node object for PUT
        api.nodes.update(newNode.id, {
          id: newNode.id,
          title: newNode.title,
          content: newNode.content || '',

          groupId: newNode.groupId,
          projectId: newNode.projectId,
          userId: newNode.userId,
          customColor: randomColor,
          x: randomX,
          y: randomY,
        }).catch(
          // err => console.error('Failed to persist initial node properties:', err)
        );
      }

      addNode(newNode);
    } catch (err) {
      addNode(demoNode);
    } finally {
      setLoading(false);
    }
  };

  const filteredNodes = filterNodes(nodes, searchQuery);

  if (!hasHydrated || !isMounted || !isAuthenticated || !currentProject || currentProject.id !== id) {
    return <LoadingScreen />;
  }

  // Handler for PNG export from ProjectNavbar
  const handleExportPNG = () => {
    graphCanvasRef.current?.exportToPNG();
  };

  const handleExportProject = async () => {
    if (!currentProject) return;

    try {
      await exportProjectAsNxus(currentProject, nodes, links, shapes, groups);
    } catch (err) {
      // console.error('Failed to export project:', err);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950">
      <ProjectNavbar
        projectName={currentProject?.name}
        projectColor={currentProject?.color}
        nodeCount={filteredNodes.length}
        onExportPNG={handleExportPNG}
        onAddNode={handleCreateNode}
        isAddingNode={isLoading}
      />

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <GraphControls
          settings={graphSettings}
          onSettingsChange={setGraphSettings}
        />

        {isLoading && nodes.length === 0 ? (
          <LoadingOverlay message="Loading graph..." />
        ) : (
          <GraphCanvas ref={graphCanvasRef} />
        )}
      </div>

      <NodeEditor />
      <CommandPalette />
    </div>
  );
}
