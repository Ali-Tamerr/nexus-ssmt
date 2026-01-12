'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { useGraphStore, filterNodes } from '@/store/useGraphStore';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';

import { LoadingScreen, LoadingOverlay } from '@/components/ui';
import { SearchInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ProjectNavbar } from '@/components/layout';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { GraphControls } from '@/components/graph/GraphControls';
import { NodeEditor } from '@/components/editor/NodeEditor';
import { CommandPalette } from '@/components/ui/CommandPalette';

export default function EditorPage() {
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

    const projectId = currentProject?.id;

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (hasHydrated && !isAuthenticated) {
            router.push('/');
        }
    }, [hasHydrated, isAuthenticated, router]);

    useEffect(() => {
        if (hasHydrated && isAuthenticated && !currentProject) {
            router.push('/');
        }
    }, [hasHydrated, isAuthenticated, currentProject, router]);

    const dataLoadedRef = useRef(false);

    useEffect(() => {
        const loadProjectData = async () => {
            if (!isAuthenticated || !projectId || dataLoadedRef.current) return;

            dataLoadedRef.current = true;
            setLoading(true);
            setError(null);

            try {
                const project = await api.projects.getById(projectId);
                setCurrentProject(project);

                const projectNodes = await api.nodes.getByProject(projectId);
                setNodes(projectNodes);

                const allLinks = await api.links.getAll();
                const nodeIds = new Set(projectNodes.map(n => n.id));
                const projectLinks = allLinks.filter(
                    l => nodeIds.has(l.sourceId) || nodeIds.has(l.targetId)
                );
                setLinks(projectLinks);
            } catch (err) {
                console.log('Demo mode: Using local data (API unavailable)');
                setNodes([]);
                setLinks([]);
            } finally {
                setLoading(false);
            }
        };

        if (hasHydrated && isAuthenticated && projectId) {
            loadProjectData();
        }

        return () => {
            dataLoadedRef.current = false;
        };
    }, [projectId, hasHydrated, isAuthenticated, setCurrentProject, setNodes, setLinks, setLoading]);

    const handleCreateNode = async () => {
        if (!currentProject || !projectId) return;

        const groupId = Math.floor(Math.random() * 8);

        const demoNode = {
            id: crypto.randomUUID(),
            title: 'New Node',
            content: '',
            excerpt: '',
            projectId: projectId,
            groupId: groupId,
            userId: user?.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        setLoading(true);
        try {
            const newNode = await api.nodes.create({
                title: 'New Node',
                content: '',
                excerpt: '',
                projectId: projectId,
                groupId: groupId,
                userId: user?.id,
            });
            addNode(newNode);
        } catch (err) {
            console.log('Demo mode: Creating local node (API unavailable)');
            addNode(demoNode);
        } finally {
            setLoading(false);
        }
    };

    const filteredNodes = filterNodes(nodes, searchQuery);

    if (!hasHydrated || !isMounted) {
        return <LoadingScreen />;
    }

    if (!currentProject) {
        return <LoadingScreen />;
    }

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-zinc-950">
            <ProjectNavbar
                projectName={currentProject?.name}
                projectColor={currentProject?.color}
                nodeCount={filteredNodes.length}
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
                    <GraphCanvas />
                )}
            </div>

            <NodeEditor />
            <CommandPalette />
        </div>
    );
}
