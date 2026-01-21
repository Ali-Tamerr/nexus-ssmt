'use client';

import { use, useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { api } from '@/lib/api';
import { NODE_COLORS } from '@/lib/constants';
import { LoadingScreen } from '@/components/ui';
import { Node, Link as LinkType, DrawnShape } from '@/types/knowledge';
import { NodePreviewPaneContent } from '@/components/editor/NodePreviewPane';

import { drawShapeOnContext } from '@/components/graph/drawingUtils';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false }) as any;

interface ApiDrawing {
    id: string;
    type: string;
    points: string;
    color: string;
    width: number;
    style: string;
    text?: string | null;
    fontSize?: number | null;
    fontFamily?: string | null;
}

function adjustBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
    return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
}

export default function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [isMounted, setIsMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [projectName, setProjectName] = useState('');
    const [nodes, setNodes] = useState<Node[]>([]);
    const [links, setLinks] = useState<LinkType[]>([]);
    const [shapes, setShapes] = useState<DrawnShape[]>([]);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<any>(null);
    const [isHoveringNode, setIsHoveringNode] = useState(false);
    const [activeNode, setActiveNode] = useState<Node | null>(null);

    useEffect(() => {
        setIsMounted(true);

        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight,
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    useEffect(() => {
        const loadProjectData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const project = await api.projects.getById(id);
                setProjectName(project.name);

                let projectNodes = await api.nodes.getByProject(id);

                // Robustly fix node colors: ensure every node has a valid customColor
                projectNodes = projectNodes.map((n, idx) => {
                    const pickPalette = () => NODE_COLORS[idx % NODE_COLORS.length];
                    const isValid = (c: any) => typeof c === 'string' && c.trim() && c !== 'null' && c !== 'undefined';

                    let customColor = n.customColor;
                    let colorSource = 'original';
                    if (!isValid(customColor)) {
                        if (isValid(n.color)) {
                            customColor = n.color;
                            colorSource = 'color-field';
                        } else {
                            customColor = pickPalette();
                            colorSource = 'palette';
                        }
                    }
                    return {
                        ...n,
                        customColor,
                    };
                });
                console.log('[NodeColorDebug][FinalNodes]', projectNodes.map(n => ({ id: n.id, title: n.title, customColor: n.customColor, color: n.color })));
                setNodes(projectNodes);

                const allLinks = await api.links.getAll();
                const nodeIds = new Set(projectNodes.map(n => n.id));
                const projectLinks = allLinks.filter(
                    l => nodeIds.has(l.sourceId) || nodeIds.has(l.targetId)
                );
                setLinks(projectLinks);

                const drawings = await api.drawings.getByProject(id);
                const loadedShapes: DrawnShape[] = drawings.map((d: ApiDrawing) => ({
                    id: d.id,
                    type: d.type as DrawnShape['type'],
                    points: JSON.parse(d.points),
                    color: d.color,
                    width: d.width,
                    style: d.style as DrawnShape['style'],
                    text: d.text === null ? undefined : d.text,
                    fontSize: d.fontSize === null ? undefined : d.fontSize,
                    fontFamily: d.fontFamily === null ? undefined : d.fontFamily,
                }));
                setShapes(loadedShapes);
            } catch (err) {
                console.error('Failed to load project:', err);
                setError('Failed to load project. It may not exist or you may not have access.');
            } finally {
                setIsLoading(false);
            }
        };

        loadProjectData();
    }, [id]);

    const graphData = {
        nodes: nodes.map(n => ({
            id: n.id,
            title: n.title,
            groupId: n.groupId,
            customColor: n.customColor,
            x: n.x,
            y: n.y,
        })),
        links: links.map(l => ({
            source: l.sourceId,
            target: l.targetId,
            color: l.color,
            description: l.description,
        })),
    };

    const nodeCanvasObject = (
        node: { id?: string | number; x?: number; y?: number; title?: string; customColor?: string },
        ctx: CanvasRenderingContext2D,
        globalScale: number
    ) => {
        const label = node.title || String(node.id);
        const fontSize = Math.max(12 / globalScale, 4);
        ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;

        const baseColor = node.customColor || '#8B5CF6';
        const nodeRadius = 6;
        const x = node.x || 0;
        const y = node.y || 0;

        const gradient = ctx.createRadialGradient(
            x - nodeRadius / 3,
            y - nodeRadius / 3,
            0,
            x,
            y,
            nodeRadius
        );
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(1, adjustBrightness(baseColor, -30));

        ctx.beginPath();
        ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.shadowColor = baseColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
        ctx.fillStyle = 'transparent';
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(label, x, y + nodeRadius + 3);
    };

    const onRenderFramePost = (ctx: CanvasRenderingContext2D, globalScale: number) => {
        shapes.forEach(shape => {
            drawShapeOnContext(ctx, shape, globalScale);
        });
    };

    if (!isMounted || isLoading) {
        return <LoadingScreen />;
    }

    if (error) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 text-white">
                <p className="mb-4 text-red-400">{error}</p>
                <Link
                    href="/"
                    className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Go back home
                </Link>
            </div>
        );
    }

    return (
        <div className="flex h-screen flex-col bg-zinc-950">
            <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4">
                <div className="flex items-center gap-4">
                    <Link
                        href="/"
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="text-sm">Back</span>
                    </Link>

                    <div className="h-6 w-px bg-zinc-800" />

                    <div>
                        <h1 className="text-sm font-semibold text-white">{projectName || 'Project'}</h1>
                        <p className="text-[10px] text-zinc-500">Preview Mode • {nodes.length} nodes</p>
                    </div>
                </div>
            </header>

            <div
                ref={containerRef}
                className="relative flex-1 overflow-hidden [&_canvas]:!cursor-[inherit]"
                style={{ cursor: isHoveringNode ? 'pointer' : 'default' }}
            >
                <ForceGraph2D
                    ref={graphRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    graphData={graphData}
                    nodeId="id"
                    nodeCanvasObject={nodeCanvasObject}
                    nodePointerAreaPaint={(node: { x?: number; y?: number }, color: string, ctx: CanvasRenderingContext2D) => {
                        if (!node.x || !node.y) return;
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, 15, 0, 2 * Math.PI, false);
                        ctx.fill();
                    }}
                    linkColor={(link: any) => (link.color || '#3B82F6') + '80'}
                    linkWidth={1}
                    linkCurvature={0.1}
                    linkDirectionalArrowLength={6}
                    linkDirectionalArrowRelPos={1}
                    onRenderFramePost={onRenderFramePost}
                    enableNodeDrag={false}
                    enableZoomInteraction={true}
                    enablePanInteraction={true}
                    cooldownTicks={100}
                    d3AlphaDecay={0.02}
                    onNodeHover={(node: any) => setIsHoveringNode(!!node)}
                    onNodeClick={(node: any) => {
                        const foundNode = nodes.find(n => n.id === node.id);
                        if (foundNode) setActiveNode(foundNode);
                    }}
                    onBackgroundClick={() => setActiveNode(null)}
                />

                {activeNode && (
                    <NodePreviewPaneContent
                        activeNode={activeNode}
                        nodes={nodes}
                        links={links}
                        onClose={() => setActiveNode(null)}
                    />
                )}
            </div>
        </div>
    );
}
