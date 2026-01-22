'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

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

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const graphCanvasRef = useRef<GraphCanvasHandle>(null);
  const { id } = use(params);
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, isAuthenticated, hasHydrated } = useAuthStore();

  const {
    currentProject,
    setCurrentProject,
    nodes,
    setNodes,
    setLinks,
    searchQuery,
    setSearchQuery,
    graphSettings,
    setGraphSettings,
    addNode,
    isLoading,
    setLoading,
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
        setCurrentProject(project);

        const projectNodes = await api.nodes.getByProject(id);
        setNodes(projectNodes);

        const allLinks = await api.links.getAll();
        const nodeIds = new Set(projectNodes.map(n => n.id));
        const projectLinks = allLinks.filter(
          l => nodeIds.has(l.sourceId) || nodeIds.has(l.targetId)
        );
        setLinks(projectLinks);
      } catch (err) {
        setCurrentProject({
          id,
          name: 'Project',
          description: '',
          color: '#3B82F6',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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
      0: '#8B5CF6', 1: '#3B82F6', 2: '#10B981', 3: '#F59E0B',
      4: '#EF4444', 5: '#EC4899', 6: '#06B6D4', 7: '#84CC16',
    };
    const colors = Object.values(GROUP_COLORS);
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Random position so nodes don't spawn on top of each other
    const randomX = (Math.random() - 0.5) * 150;
    const randomY = (Math.random() - 0.5) * 150;

    const demoNode = {
      id: crypto.randomUUID(),
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
      let newNode = await api.nodes.create({
        title: 'New Node',
        content: '',
        projectId: id,
        groupId: 0,
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
          excerpt: newNode.excerpt || '',
          groupId: newNode.groupId,
          projectId: newNode.projectId,
          userId: newNode.userId,
          customColor: randomColor,
          x: randomX,
          y: randomY,
        }).catch(err => console.error('Failed to persist initial node properties:', err));
      }

      addNode(newNode);
    } catch (err) {
      addNode(demoNode);
    } finally {
      setLoading(false);
    }
  };

  const filteredNodes = filterNodes(nodes, searchQuery);

  if (!hasHydrated || !isMounted) {
    return <LoadingScreen />;
  }

  // Handler for PNG export from ProjectNavbar
  const handleExportPNG = () => {
    graphCanvasRef.current?.exportToPNG();
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950">
      <ProjectNavbar
        projectName={currentProject?.name}
        projectColor={currentProject?.color}
        nodeCount={filteredNodes.length}
        onExportPNG={handleExportPNG}
      >
        <div className="w-64">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
          />
        </div>

        <Button
          variant="brand"
          onClick={handleCreateNode}
          loading={isLoading}
          icon={<Plus className="h-4 w-4" />}
        >
          Add Node
        </Button>
      </ProjectNavbar>

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
