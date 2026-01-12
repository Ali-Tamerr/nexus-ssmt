'use client';

import dynamic from 'next/dynamic';
import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { useGraphStore, filterNodes } from '@/store/useGraphStore';
import { GROUP_COLORS, RELATIONSHIP_COLORS } from '@/types/knowledge';
import type { RelationshipType } from '@/types/knowledge';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
});

export function GraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const nodes = useGraphStore((s) => s.nodes);
  const links = useGraphStore((s) => s.links);
  const activeNode = useGraphStore((s) => s.activeNode);
  const setActiveNode = useGraphStore((s) => s.setActiveNode);
  const setHoveredNode = useGraphStore((s) => s.setHoveredNode);
  const searchQuery = useGraphStore((s) => s.searchQuery);
  const graphSettings = useGraphStore((s) => s.graphSettings);

  const filteredNodes = useMemo(
    () => filterNodes(nodes, searchQuery),
    [nodes, searchQuery]
  );

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);



  const graphData = useMemo(() => {
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const graphNodes = filteredNodes.map((n) => ({
      id: n.id,
      title: n.title,
      groupId: n.groupId,
    }));

    const graphLinks = links
      .filter(
        (l) => filteredNodeIds.has(l.sourceId) && filteredNodeIds.has(l.targetId)
      )
      .map((l) => ({
        source: l.sourceId,
        target: l.targetId,
        relationshipType: l.relationshipType,
      }));

    return { nodes: graphNodes, links: graphLinks };
  }, [filteredNodes, links]);

  const handleNodeClick = useCallback(
    (nodeObj: { id?: string | number; x?: number; y?: number }) => {
      const node = nodes.find((n) => n.id === String(nodeObj.id));
      if (node) {
        setActiveNode(node);
      }
    },
    [nodes, setActiveNode]
  );

  const handleNodeHover = useCallback(
    (nodeObj: { id?: string | number } | null) => {
      if (nodeObj) {
        const node = nodes.find((n) => n.id === String(nodeObj.id));
        setHoveredNode(node || null);
      } else {
        setHoveredNode(null);
      }
    },
    [nodes, setHoveredNode]
  );

  const nodeCanvasObject = useCallback(
    (
      node: { id?: string | number; x?: number; y?: number; title?: string; groupId?: number },
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const label = node.title || String(node.id);
      const nodeGroup = node.groupId ?? 0;
      const fontSize = Math.max(12 / globalScale, 4);
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;

      const nodeId = String(node.id);
      const isActive = activeNode?.id === nodeId;
      const isSearchMatch =
        searchQuery &&
        label.toLowerCase().includes(searchQuery.toLowerCase());

      const baseColor = GROUP_COLORS[nodeGroup] || GROUP_COLORS[0];
      const nodeRadius = isActive ? 8 : 6;
      const x = node.x || 0;
      const y = node.y || 0;

      if (isActive) {
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius + 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(139, 92, 246, 0.4)';
        ctx.fill();
      }

      if (isSearchMatch) {
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

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
    },
    [activeNode, searchQuery]
  );

  const linkColor = useCallback((link: unknown) => {
    const l = link as { relationshipType?: string };
    const relType = l.relationshipType as RelationshipType || 'neutral';
    return (RELATIONSHIP_COLORS[relType] || RELATIONSHIP_COLORS.neutral) + '80';
  }, []);

  const linkWidth = useCallback(
    (link: unknown) => {
      const l = link as { source?: string | { id?: string }; target?: string | { id?: string } };
      const srcId = typeof l.source === 'string' ? l.source : l.source?.id;
      const tgtId = typeof l.target === 'string' ? l.target : l.target?.id;
      return activeNode?.id === srcId || activeNode?.id === tgtId ? 2 : 1;
    },
    [activeNode]
  );

  return (
    <div ref={containerRef} className="relative h-full w-full bg-zinc-950" suppressHydrationWarning>
      {isMounted ? (
        <ForceGraph2D
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeId="id"
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node: { x?: number; y?: number }, color: string, ctx: CanvasRenderingContext2D) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x || 0, node.y || 0, 10, 0, 2 * Math.PI);
            ctx.fill();
          }}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.1}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onBackgroundClick={() => setActiveNode(null)}
          enableNodeDrag={!graphSettings.lockAllMovement}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          backgroundColor="transparent"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#265fbd]/30 border-t-[#265fbd]" />
            <span className="text-sm text-zinc-400">Loading graph...</span>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
        {Object.entries(GROUP_COLORS).map(([group, color]) => (
          <div
            key={group}
            className="flex items-center gap-1.5 rounded-full bg-zinc-800/60 px-2 py-1 text-xs text-zinc-400 backdrop-blur-sm"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span>Group {group}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
