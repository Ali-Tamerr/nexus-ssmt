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
import { NodePreviewPane } from '@/components/editor/NodePreviewPane';
import { CommandPalette } from '@/components/ui/CommandPalette';

export default function EditorPage() {
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { user, isAuthenticated, hasHydrated: authHydrated } = useAuthStore();

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
        hasHydrated: graphHydrated,
    } = useGraphStore();

    const hasHydrated = authHydrated && graphHydrated;
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
        if (hasHydrated && isAuthenticated && !currentProject?.id) {
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

                const GROUP_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'];

                const hashString = (str: string) => {
                    let hash = 0;
                    for (let i = 0; i < str.length; i++) {
                        const char = str.charCodeAt(i);
                        hash = ((hash << 5) - hash) + char;
                        hash = hash & hash;
                    }
                    return Math.abs(hash);
                };

                let projectNodes = await api.nodes.getByProject(projectId);
                projectNodes = projectNodes.map((n) => {
                    const isValid = (c: any) => typeof c === 'string' && c.trim() && c !== 'null' && c !== 'undefined';
                    if (!isValid(n.customColor)) {
                        return { ...n, customColor: GROUP_COLORS[hashString(n.id) % GROUP_COLORS.length] };
                    }
                    return n;
                });
                setNodes(projectNodes);

                const allLinks = await api.links.getAll();
                const nodeIds = new Set(projectNodes.map(n => n.id));
                const projectLinks = allLinks.filter(
                    l => nodeIds.has(l.sourceId) || nodeIds.has(l.targetId)
                );
                setLinks(projectLinks);
            } catch (err) {
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

    const activeGroupId = useGraphStore(state => state.activeGroupId);

    const handleCreateNode = async () => {
        if (!currentProject || !projectId || !user?.id) {
            console.log('Add node aborted: missing currentProject, projectId, or user.id', { currentProject, projectId, user });
            return;
        }

        const groupId = typeof activeGroupId === 'number' ? activeGroupId : 0;

        const GROUP_COLORS: Record<number, string> = {
            0: '#8B5CF6', 1: '#3B82F6', 2: '#10B981', 3: '#F59E0B',
            4: '#EF4444', 5: '#EC4899', 6: '#06B6D4', 7: '#84CC16',
        };
        const colors = Object.values(GROUP_COLORS);
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const randomX = (Math.random() - 0.5) * 150;
        const randomY = (Math.random() - 0.5) * 150;

        const demoNode = {
            id: crypto.randomUUID(),
            title: 'New Node',
            content: '',
            excerpt: '',
            projectId: projectId,
            groupId: groupId,
            customColor: randomColor,
            x: randomX,
            y: randomY,
            userId: user.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        setLoading(true);
        try {
            const payload = {
                title: 'New Node',
                content: '',
                excerpt: '',
                projectId: projectId,
                groupId: groupId,
                customColor: randomColor,
                x: randomX,
                y: randomY,
                userId: user.id,
            };
            console.log('Creating node with payload:', payload);
            let newNode = await api.nodes.create(payload);
            console.log('Node created from API:', newNode);

            // If backend didn't return position/color, force update with full node object
            if (newNode.x === null || newNode.x === undefined || newNode.customColor !== randomColor) {
                newNode = { ...newNode, x: randomX, y: randomY, customColor: randomColor };
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
            console.error('Error creating node:', err);
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

    const isPreviewMode = graphSettings.isPreviewMode;

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-zinc-950">
            <ProjectNavbar
                projectName={currentProject?.name}
                projectColor={currentProject?.color}
                nodeCount={filteredNodes.length}
            >
                {!isPreviewMode && (
                    <>
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
                    </>
                )}
            </ProjectNavbar>

            {error && (
                <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                    {error}
                </div>
            )}

            <div className="relative flex-1 overflow-hidden">
                {/* Background layer - brightness filter only affects this */}
                <div
                    className="absolute inset-0 transition-all duration-300"
                    style={{
                        backgroundColor: !currentProject?.wallpaper?.startsWith('url')
                            ? (currentProject?.wallpaper || undefined)
                            : undefined,
                        backgroundImage: currentProject?.wallpaper?.startsWith('url')
                            ? currentProject.wallpaper
                            : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: currentProject?.wallpaper?.startsWith('url')
                            ? `brightness(${(currentProject?.wallpaperBrightness ?? 100) / 100})`
                            : undefined
                    }}
                />

                {/* Content layer - unaffected by brightness */}
                <div className="relative z-10 h-full">
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
            </div>

            {isPreviewMode ? <NodePreviewPane /> : <NodeEditor />}
            <CommandPalette />
        </div>
    );
}
