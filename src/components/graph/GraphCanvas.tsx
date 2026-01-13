'use client';

import dynamic from 'next/dynamic';
import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { useGraphStore, filterNodes } from '@/store/useGraphStore';
import { GROUP_COLORS, RELATIONSHIP_COLORS } from '@/types/knowledge';
import type { RelationshipType } from '@/types/knowledge';
import { DrawingProperties } from './DrawingProperties';
import { drawShapeOnContext, isPointNearShape, drawSelectionBox } from './drawingUtils';
import { DrawnShape } from '@/types/knowledge';
import { api, ApiDrawing } from '@/lib/api';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
}) as any;

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
  const setGraphSettings = useGraphStore((s) => s.setGraphSettings);

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

  const graphRef = useRef<any>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const isPreviewMode = graphSettings.isPreviewMode;
  const prevPreviewModeRef = useRef(isPreviewMode);
  const [graphTransform, setGraphTransform] = useState({ x: 0, y: 0, k: 1 });

  const currentProject = useGraphStore(state => state.currentProject);
  const shapes = useGraphStore(state => state.shapes);
  const setShapes = useGraphStore(state => state.setShapes);
  const addShape = useGraphStore(state => state.addShape);
  const updateShape = useGraphStore(state => state.updateShape);
  const undo = useGraphStore(state => state.undo);
  const redo = useGraphStore(state => state.redo);
  const pushToUndoStack = useGraphStore(state => state.pushToUndoStack);

  const apiDrawingToShape = useCallback((d: ApiDrawing): DrawnShape => ({
    id: d.id,
    type: d.type as DrawnShape['type'],
    points: JSON.parse(d.points),
    color: d.color,
    width: d.width,
    style: d.style as DrawnShape['style'],
    text: d.text || undefined,
    fontSize: d.fontSize || undefined,
    fontFamily: d.fontFamily || undefined,
  }), []);

  const shapeToApiDrawing = useCallback((s: DrawnShape, projectId: string) => ({
    projectId,
    type: s.type,
    points: JSON.stringify(s.points),
    color: s.color,
    width: s.width,
    style: s.style,
    text: s.text,
    fontSize: s.fontSize,
    fontFamily: s.fontFamily,
  }), []);

  useEffect(() => {
    if (!currentProject?.id) return;

    api.drawings.getByProject(currentProject.id)
      .then(drawings => {
        const loadedShapes = drawings.map(apiDrawingToShape);
        setShapes(loadedShapes);
      })
      .catch(err => console.error('Failed to load drawings:', err));
  }, [currentProject?.id, apiDrawingToShape, setShapes]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set());
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [dragStartWorld, setDragStartWorld] = useState<{ x: number; y: number } | null>(null);

  const isDrawingTool = ['pen', 'rectangle', 'diamond', 'circle', 'arrow', 'line', 'eraser'].includes(graphSettings.activeTool);
  const isTextTool = graphSettings.activeTool === 'text';
  const isSelectTool = graphSettings.activeTool === 'select';

  // Reheat simulation for undo/redo
  useEffect(() => {
    if (graphRef.current) {
      const z = graphRef.current.zoom();
      graphRef.current.zoom(z * 1.00001, 0);
      graphRef.current.zoom(z, 0);
    }
  }, [shapes]);

  // Clear text input when switching tools
  useEffect(() => {
    if (!isTextTool && textInputPos) {
      setTextInputPos(null);
      setTextInputValue('');
    }
  }, [graphSettings.activeTool, isTextTool, textInputPos]);

  // Handle Undo/Redo and Delete shortcuts
  const shapesRef = useRef(shapes);
  const selectedShapeIdsRef = useRef(selectedShapeIds);
  shapesRef.current = shapes;
  selectedShapeIdsRef.current = selectedShapeIds;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeIdsRef.current.size > 0) {
        e.preventDefault();
        pushToUndoStack(shapesRef.current);
        const toDelete = shapesRef.current.filter(s => selectedShapeIdsRef.current.has(s.id));
        const remaining = shapesRef.current.filter(s => !selectedShapeIdsRef.current.has(s.id));
        setShapes(remaining);
        toDelete.forEach(s => {
          api.drawings.delete(s.id).catch(err => console.error('Failed to delete drawing:', err));
        });
        setSelectedShapeIds(new Set());
      } else if (e.key === 'Escape') {
        setSelectedShapeIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, pushToUndoStack, setShapes]);



  useEffect(() => {
    if (isPreviewMode && !prevPreviewModeRef.current && graphRef.current) {
      graphRef.current.d3ReheatSimulation?.();
    }
    prevPreviewModeRef.current = isPreviewMode;
  }, [isPreviewMode]);





  const handleZoom = useCallback((transform: { x: number; y: number; k: number }) => {
    setTimeout(() => setGraphTransform(transform), 0);
  }, []);

  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    if (!graphRef.current?.screen2GraphCoords) {
      const k = graphTransform.k || 1;
      return {
        x: (screenX - graphTransform.x) / k,
        y: (screenY - graphTransform.y) / k
      };
    }
    const coords = graphRef.current.screen2GraphCoords(screenX, screenY);
    return { x: coords.x, y: coords.y };
  }, [graphTransform]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isDrawingTool) return;

    if (graphSettings.activeTool === 'eraser') {
      setIsDrawing(true);
      pushToUndoStack(shapes);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorld(screenX, screenY);

    setIsDrawing(true);
    setStartPoint(worldPoint);
    setCurrentPoints([worldPoint]);
  }, [isDrawingTool, screenToWorld, graphSettings.activeTool, shapes, pushToUndoStack]);

  const drawPreview = useCallback((points: { x: number; y: number }[]) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length === 0) return;

    const screenPoints = points.map(p => ({
      x: p.x * graphTransform.k + graphTransform.x,
      y: p.y * graphTransform.k + graphTransform.y,
    }));

    ctx.strokeStyle = graphSettings.strokeColor;
    ctx.lineWidth = graphSettings.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([5, 5]);

    if (screenPoints.length < 2 && graphSettings.activeTool !== 'pen') return;

    ctx.beginPath();

    switch (graphSettings.activeTool) {
      case 'pen':
        if (screenPoints.length === 0) break;
        ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        for (let i = 1; i < screenPoints.length; i++) {
          ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
        }
        ctx.stroke();
        break;
      case 'line':
        ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        ctx.lineTo(screenPoints[1].x, screenPoints[1].y);
        ctx.stroke();
        break;
      case 'arrow':
        const [start, end] = [screenPoints[0], screenPoints[1]];
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = 15;
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        break;
      case 'rectangle':
        ctx.strokeRect(screenPoints[0].x, screenPoints[0].y, screenPoints[1].x - screenPoints[0].x, screenPoints[1].y - screenPoints[0].y);
        break;
      case 'circle':
        const radiusX = Math.abs(screenPoints[1].x - screenPoints[0].x) / 2;
        const radiusY = Math.abs(screenPoints[1].y - screenPoints[0].y) / 2;
        const centerX = screenPoints[0].x + (screenPoints[1].x - screenPoints[0].x) / 2;
        const centerY = screenPoints[0].y + (screenPoints[1].y - screenPoints[0].y) / 2;
        ctx.ellipse(centerX, centerY, Math.max(0.1, radiusX), Math.max(0.1, radiusY), 0, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      case 'diamond':
        const midX = (screenPoints[0].x + screenPoints[1].x) / 2;
        const midY = (screenPoints[0].y + screenPoints[1].y) / 2;
        ctx.moveTo(midX, screenPoints[0].y);
        ctx.lineTo(screenPoints[1].x, midY);
        ctx.lineTo(midX, screenPoints[1].y);
        ctx.lineTo(screenPoints[0].x, midY);
        ctx.closePath();
        ctx.stroke();
        break;
    }
  }, [graphTransform, graphSettings.activeTool, graphSettings.strokeColor, graphSettings.strokeWidth]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorld(screenX, screenY);

    if (graphSettings.activeTool === 'eraser') {
      const scale = graphTransform.k || 1;
      const erasedShapes = shapes.filter(s => isPointNearShape(worldPoint, s, scale));
      const remaining = shapes.filter(s => !isPointNearShape(worldPoint, s, scale));
      if (remaining.length !== shapes.length) {
        setShapes(remaining);
        erasedShapes.forEach(s => {
          api.drawings.delete(s.id).catch(err => console.error('Failed to delete drawing:', err));
        });
      }
      return;
    }

    if (!startPoint) return;

    let newPoints: { x: number; y: number }[];
    if (graphSettings.activeTool === 'pen') {
      newPoints = [...currentPoints, worldPoint];
    } else {
      newPoints = [startPoint, worldPoint];
    }

    setCurrentPoints(newPoints);

    if (graphRef.current) {
      const z = graphRef.current.zoom();
      graphRef.current.zoom(z * 1.00001, 0);
      graphRef.current.zoom(z, 0);
    }
  }, [isDrawing, startPoint, screenToWorld, graphSettings.activeTool, currentPoints, shapes, setShapes, graphTransform]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!isDrawing) return;

    if (graphSettings.activeTool === 'eraser') {
      setIsDrawing(false);
      return;
    }

    if (currentPoints.length === 0) {
      setIsDrawing(false);
      return;
    }

    const newShape: DrawnShape = {
      id: crypto.randomUUID(),
      type: graphSettings.activeTool,
      points: [...currentPoints],
      color: graphSettings.strokeColor,
      width: graphSettings.strokeWidth,
      style: graphSettings.strokeStyle,
    };

    addShape(newShape);

    if (currentProject?.id) {
      api.drawings.create(shapeToApiDrawing(newShape, currentProject.id))
        .then(createdDrawing => {
          updateShape(newShape.id, { id: createdDrawing.id });
        })
        .catch(err => console.error('Failed to save drawing:', err));
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoints([]);
    drawPreview([]);

    setTimeout(() => {
      if (graphRef.current) {
        const currentZoom = graphRef.current.zoom();
        graphRef.current.zoom(currentZoom * 1.0001, 0);
        setTimeout(() => graphRef.current.zoom(currentZoom, 0), 20);
      }
    }, 10);
  }, [isDrawing, currentPoints, graphSettings.activeTool, graphSettings.strokeColor, graphSettings.strokeWidth, graphSettings.strokeStyle, drawPreview, currentProject?.id, shapeToApiDrawing, addShape]);

  const onRenderFramePost = useCallback((ctx: CanvasRenderingContext2D, globalScale: number) => {
    shapes.forEach(shape => {
      drawShapeOnContext(ctx, shape, globalScale);
      if (selectedShapeIds.has(shape.id)) {
        drawSelectionBox(ctx, shape, globalScale);
      }
    });

    if (isDrawing && currentPoints.length > 0) {
      const previewShape: DrawnShape = {
        id: 'preview',
        type: graphSettings.activeTool,
        points: currentPoints,
        color: graphSettings.strokeColor,
        width: graphSettings.strokeWidth,
        style: graphSettings.strokeStyle,
      };
      drawShapeOnContext(ctx, previewShape, globalScale, true);
    }
  }, [shapes, isDrawing, currentPoints, graphSettings.activeTool, graphSettings.strokeColor, graphSettings.strokeWidth, graphSettings.strokeStyle, selectedShapeIds]);

  return (
    <div ref={containerRef} className="relative h-full w-full bg-zinc-950" suppressHydrationWarning>
      {isMounted ? (
        <>
          <ForceGraph2D
            ref={graphRef}
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
            onZoom={handleZoom}
            onRenderFramePost={onRenderFramePost}
            enableNodeDrag={!graphSettings.lockAllMovement && !isDrawingTool}
            enableZoomInteraction={true}
            enablePanInteraction={graphSettings.activeTool === 'pan' || graphSettings.activeTool === 'select'}
            cooldownTicks={isPreviewMode ? 100 : 0}
            d3AlphaDecay={isPreviewMode ? 0.02 : 1}
            d3VelocityDecay={isPreviewMode ? 0.3 : 0.9}
            backgroundColor="transparent"
          />
          <canvas
            ref={previewCanvasRef}
            width={dimensions.width}
            height={dimensions.height}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 15 }}
          />
          {isDrawingTool && (
            <div
              className="absolute inset-0 z-20 cursor-crosshair"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />
          )}
          {isSelectTool && (
            <div
              className="absolute inset-0 z-20 cursor-default"
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const worldPoint = screenToWorld(screenX, screenY);
                const scale = graphTransform.k || 1;

                const clickedShape = shapes.find(s => isPointNearShape(worldPoint, s, scale, 10));

                if (clickedShape) {
                  if (e.shiftKey) {
                    setSelectedShapeIds(prev => {
                      const next = new Set(prev);
                      if (next.has(clickedShape.id)) {
                        next.delete(clickedShape.id);
                      } else {
                        next.add(clickedShape.id);
                      }
                      return next;
                    });
                  } else {
                    setSelectedShapeIds(new Set([clickedShape.id]));
                  }
                  setIsDraggingSelection(true);
                  setDragStartWorld(worldPoint);
                  pushToUndoStack(shapes);
                } else {
                  setSelectedShapeIds(new Set());
                }
              }}
              onMouseMove={(e) => {
                if (!isDraggingSelection || !dragStartWorld || selectedShapeIds.size === 0) return;

                const rect = e.currentTarget.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const worldPoint = screenToWorld(screenX, screenY);

                const dx = worldPoint.x - dragStartWorld.x;
                const dy = worldPoint.y - dragStartWorld.y;

                if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                  const updatedShapes = shapes.map(s => {
                    if (selectedShapeIds.has(s.id)) {
                      return {
                        ...s,
                        points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
                      };
                    }
                    return s;
                  });
                  setShapes(updatedShapes);
                  setDragStartWorld(worldPoint);
                }
              }}
              onMouseUp={() => {
                if (isDraggingSelection && selectedShapeIds.size > 0) {
                  shapes.filter(s => selectedShapeIds.has(s.id)).forEach(s => {
                    api.drawings.update(s.id, { points: JSON.stringify(s.points) })
                      .catch(err => console.error('Failed to update drawing:', err));
                  });
                }
                setIsDraggingSelection(false);
                setDragStartWorld(null);
                if (graphRef.current) {
                  const z = graphRef.current.zoom();
                  graphRef.current.zoom(z * 1.00001, 0);
                  graphRef.current.zoom(z, 0);
                }
              }}
              onMouseLeave={() => {
                setIsDraggingSelection(false);
                setDragStartWorld(null);
              }}
            />
          )}
          {isTextTool && (
            <div
              className="absolute inset-0 z-20 cursor-text"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const worldPoint = screenToWorld(screenX, screenY);
                setTextInputPos({ x: e.clientX, y: e.clientY, worldX: worldPoint.x, worldY: worldPoint.y });
                setTextInputValue('');
              }}
            />
          )}
          {textInputPos && (
            <div
              className="fixed z-50"
              style={{ left: textInputPos.x, top: textInputPos.y }}
            >
              <input
                autoFocus
                type="text"
                value={textInputValue}
                onChange={(e) => setTextInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textInputValue.trim()) {
                    e.preventDefault();
                    const newShape: DrawnShape = {
                      id: crypto.randomUUID(),
                      type: 'text',
                      points: [{ x: textInputPos.worldX, y: textInputPos.worldY }],
                      color: graphSettings.strokeColor,
                      width: 0,
                      style: 'solid',
                      text: textInputValue.trim(),
                      fontSize: graphSettings.fontSize || 16,
                      fontFamily: graphSettings.fontFamily || 'Inter',
                    };
                    addShape(newShape);
                    if (currentProject?.id) {
                      api.drawings.create(shapeToApiDrawing(newShape, currentProject.id))
                        .then(createdDrawing => {
                          updateShape(newShape.id, { id: createdDrawing.id });
                        })
                        .catch(err => console.error('Failed to save text:', err));
                    }
                    setTextInputPos(null);
                    setTextInputValue('');
                    setTimeout(() => {
                      if (graphRef.current) {
                        const z = graphRef.current.zoom();
                        graphRef.current.zoom(z * 1.00001, 0);
                        graphRef.current.zoom(z, 0);
                      }
                    }, 50);
                  } else if (e.key === 'Escape') {
                    setTextInputPos(null);
                    setTextInputValue('');
                  }
                }}
                onBlur={() => {
                  if (textInputValue.trim()) {
                    const newShape: DrawnShape = {
                      id: crypto.randomUUID(),
                      type: 'text',
                      points: [{ x: textInputPos.worldX, y: textInputPos.worldY }],
                      color: graphSettings.strokeColor,
                      width: 0,
                      style: 'solid',
                      text: textInputValue.trim(),
                      fontSize: graphSettings.fontSize || 16,
                      fontFamily: graphSettings.fontFamily || 'Inter',
                    };
                    addShape(newShape);
                    if (currentProject?.id) {
                      api.drawings.create(shapeToApiDrawing(newShape, currentProject.id))
                        .then(createdDrawing => {
                          updateShape(newShape.id, { id: createdDrawing.id });
                        })
                        .catch(err => console.error('Failed to save text:', err));
                    }
                    setTimeout(() => {
                      if (graphRef.current) {
                        const z = graphRef.current.zoom();
                        graphRef.current.zoom(z * 1.00001, 0);
                        graphRef.current.zoom(z, 0);
                      }
                    }, 50);
                  }
                  setTextInputPos(null);
                  setTextInputValue('');
                }}
                className="bg-transparent border-none outline-none text-white min-w-[100px]"
                style={{
                  fontSize: graphSettings.fontSize || 16,
                  fontFamily: graphSettings.fontFamily || 'Inter',
                  color: graphSettings.strokeColor,
                }}
                placeholder="Type here..."
              />
            </div>
          )}
          <DrawingProperties
            activeTool={graphSettings.activeTool}
            strokeWidth={graphSettings.strokeWidth}
            strokeColor={graphSettings.strokeColor}
            strokeStyle={graphSettings.strokeStyle}
            fontSize={graphSettings.fontSize}
            fontFamily={graphSettings.fontFamily}
            onStrokeWidthChange={(w) => setGraphSettings({ strokeWidth: w })}
            onStrokeColorChange={(c) => setGraphSettings({ strokeColor: c })}
            onStrokeStyleChange={(s) => setGraphSettings({ strokeStyle: s })}
            onFontSizeChange={(s) => setGraphSettings({ fontSize: s })}
            onFontFamilyChange={(f) => setGraphSettings({ fontFamily: f })}
          />
        </>
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
