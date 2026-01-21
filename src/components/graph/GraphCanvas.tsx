'use client';

import dynamic from 'next/dynamic';
import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { useGraphStore, filterNodes } from '@/store/useGraphStore';
import { DrawingProperties } from './DrawingProperties';
import { ConnectionProperties } from './ConnectionProperties';
import { drawShapeOnContext, isPointNearShape, drawSelectionBox, isShapeInMarquee, drawMarquee } from './drawingUtils';
import { getShapeBounds, drawResizeHandles, getHandleAtPoint, resizeShape, getCursorForHandle, ResizeHandle, ShapeBounds } from './resizeUtils';
import { SelectionPane } from './SelectionPane';
import { GroupsTabs, getNextGroupColor } from './GroupsTabs';
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

  const groups = useGraphStore(state => state.groups);
  const activeGroupId = useGraphStore(state => state.activeGroupId);
  const setGroups = useGraphStore(state => state.setGroups);
  const setActiveGroupId = useGraphStore(state => state.setActiveGroupId);
  const addGroup = useGraphStore(state => state.addGroup);
  const updateGroup = useGraphStore(state => state.updateGroup);
  const deleteGroup = useGraphStore(state => state.deleteGroup);

  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedLink, setSelectedLink] = useState<any | null>(null);
  const [hoveredLink, setHoveredLink] = useState<any | null>(null);
  const [isOutsideContent, setIsOutsideContent] = useState(false);

  const filteredNodes = useMemo(
    () => {
      let result = filterNodes(nodes, searchQuery);
      if (activeGroupId !== null) {
        // Filter nodes by the active group ID. 
        // We handle the case where n.groupId might be undefined by defaulting to 0 or another fallback if needed.
        // Assuming backend uses 0 for default.
        result = result.filter(n => n.groupId === activeGroupId);
      }
      return result;
    },
    [nodes, searchQuery, activeGroupId]
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
      customColor: n.customColor,
      x: n.x,
      y: n.y,
      fx: n.x,
      fy: n.y,
    }));

    const graphLinks = links
      .filter(
        (l) => filteredNodeIds.has(l.sourceId) && filteredNodeIds.has(l.targetId)
      )
      .map((l) => ({
        source: l.sourceId,
        target: l.targetId,
        color: l.color,
        description: l.description,
      }));

    return { nodes: graphNodes, links: graphLinks };
  }, [filteredNodes, links]);

  const isNodeDraggingRef = useRef(false);
  const lastDragTimeRef = useRef(0);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleNodeClick = useCallback(
    (nodeObj: { id?: string | number; x?: number; y?: number }, event: MouseEvent) => {
      // Check drag state flags
      if (isNodeDraggingRef.current || Date.now() - lastDragTimeRef.current < 300) return;

      // Check drag distance (safeguard against drag events not firing or clearing too fast)
      if (dragStartPosRef.current && event.clientX !== undefined && event.clientY !== undefined) {
        const dx = event.clientX - dragStartPosRef.current.x;
        const dy = event.clientY - dragStartPosRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) return;
      }

      const node = nodes.find((n) => n.id === String(nodeObj.id));
      if (node) {
        setActiveNode(node);
      }


      const nodeId = String(nodeObj.id);
      if (event.shiftKey) {
        setSelectedNodeIds(prev => {
          const next = new Set(prev);
          if (next.has(nodeId)) {
            next.delete(nodeId);
          } else {
            next.add(nodeId);
          }
          return next;
        });
      } else {
        // If we clicked a node without shift maintaing selection if it was already selected?
        // Usually dragging handles that. But this is CLICK (MouseUp).
        // If it IS a click, we usually reset selection to just this node, UNLESS we dragged.
        // But D3 suppresses click if dragged.
        // So if we are here, we did NOT drag.
        // So we should select ONLY this node.
        setSelectedShapeIds(new Set());
        setSelectedNodeIds(new Set([nodeId]));
      }
    },
    [nodes, setActiveNode]
  );



  // Ref to track last hovered node ID (survives brief hover->null transitions during click)
  const lastHoveredNodeIdRef = useRef<string | null>(null);

  // Ref to track when we last clicked a node (to prevent onBackgroundClick from closing editor)
  const lastNodeClickTimeRef = useRef<number>(0);

  const handleNodeHover = useCallback(
    (nodeObj: { id?: string | number } | null) => {
      if (nodeObj) {
        const nodeId = String(nodeObj.id);
        lastHoveredNodeIdRef.current = nodeId;
        const node = nodes.find((n) => n.id === nodeId);
        setHoveredNode(node || null);
        setIsHoveringNode(true);
      } else {
        setHoveredNode(null);
        setIsHoveringNode(false);
      }
    },
    [nodes, setHoveredNode]
  );

  const handleLinkClick = useCallback((link: any) => {
    const fullLink = links.find(l =>
      (l.sourceId === link.source.id || l.sourceId === link.source) &&
      (l.targetId === link.target.id || l.targetId === link.target)
    );
    if (fullLink) {
      setSelectedLink({
        ...fullLink,
        source: link.source,
        target: link.target,
      });
    }
  }, [links]);

  const handleLinkHover = useCallback((link: any) => {
    if (link) {
      setHoveredLink(link);
    } else {
      setHoveredLink(null);
    }
  }, []);

  const nodeCanvasObject = useCallback(
    (
      node: { id?: string | number; x?: number; y?: number; title?: string; groupId?: number; customColor?: string },
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const label = node.title || String(node.id);
      const nodeGroup = node.groupId ?? 0;
      const fontSize = Math.max(12 / globalScale, 4);
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;

      const nodeId = String(node.id);
      const isActive = activeNode?.id === nodeId;
      const isSelected = selectedNodeIds.has(nodeId);
      const isSearchMatch =
        searchQuery &&
        label.toLowerCase().includes(searchQuery.toLowerCase());

      // Debug: log node color rendering
      const baseColor = node.customColor || groups.find(g => g.order === nodeGroup)?.color || groups[0]?.color || '#8B5CF6';
      console.log('[NodeRenderDebug]', {
        nodeId: node.id,
        title: node.title,
        customColor: node.customColor,
        groupId: node.groupId,
        groupColor: groups.find(g => g.order === nodeGroup)?.color,
        fallbackColor: groups[0]?.color,
        baseColor
      });
      const nodeRadius = isActive ? 8 : 6;
      const x = node.x || 0;
      const y = node.y || 0;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2 / globalScale;
        ctx.setLineDash([4 / globalScale, 2 / globalScale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

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
    [activeNode, searchQuery, selectedNodeIds, groups]
  );

  const linkColor = useCallback((link: unknown) => {
    const l = link as { color?: string; source?: any; target?: any };
    const baseColor = l.color || '#3B82F6';

    const isHovered = hoveredLink &&
      ((hoveredLink.source === l.source || hoveredLink.source?.id === l.source?.id) &&
        (hoveredLink.target === l.target || hoveredLink.target?.id === l.target?.id));

    return isHovered ? baseColor : baseColor + '80';
  }, [hoveredLink]);

  const linkWidth = useCallback(
    (link: unknown) => {
      const l = link as { source?: string | { id?: string }; target?: string | { id?: string } };
      const srcId = typeof l.source === 'string' ? l.source : l.source?.id;
      const tgtId = typeof l.target === 'string' ? l.target : l.target?.id;

      const isHovered = hoveredLink &&
        ((typeof hoveredLink.source === 'string' ? hoveredLink.source === srcId : hoveredLink.source?.id === srcId) &&
          (typeof hoveredLink.target === 'string' ? hoveredLink.target === tgtId : hoveredLink.target?.id === tgtId));

      const isActive = activeNode?.id === srcId || activeNode?.id === tgtId;

      return isHovered ? 3 : (isActive ? 2 : 1);
    },
    [activeNode, hoveredLink]
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
  const deleteShape = useGraphStore(state => state.deleteShape);
  const updateNode = useGraphStore(state => state.updateNode);
  const deleteNode = useGraphStore(state => state.deleteNode);
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
    groupId: d.groupId,
  }), []);

  const shapeToApiDrawing = useCallback((s: DrawnShape, projectId: string, groupId?: number) => ({
    projectId,
    groupId: groupId ?? s.groupId,
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

  const groupsLoadedRef = useRef(false);

  useEffect(() => {
    if (groupsLoadedRef.current) return;
    groupsLoadedRef.current = true;

    // Color names that should be renamed to "Group X"
    const colorNames = ['violet', 'blue', 'green', 'yellow', 'red', 'pink', 'cyan', 'lime', 'orange', 'purple', 'teal', 'amber', 'emerald', 'sky', 'indigo', 'rose', 'fuchsia'];

    api.groups.getAll()
      .then((backendGroups) => {
        const hidden = JSON.parse(localStorage.getItem('nexus_hidden_groups') || '[]');
        const visibleGroups = backendGroups.filter(g => !hidden.includes(g.id));

        const groupsWithOrder = visibleGroups.map((g, i) => {
          // Rename color-named groups to "Group X"
          const isColorName = colorNames.includes(g.name.toLowerCase());
          const newName = isColorName ? `Group ${i + 1}` : g.name;

          // If renaming, also update backend
          if (isColorName && g.name !== newName) {
            api.groups.update(g.id, { name: newName })
              .catch(err => console.warn('Failed to rename group:', err));
          }

          return { ...g, name: newName, order: i };
        });
        setGroups(groupsWithOrder);

        if (groupsWithOrder.length > 0) {
          setActiveGroupId(groupsWithOrder[0].id);
        }
      })
      .catch(err => console.error('Failed to load groups:', err));
  }, [setGroups, setActiveGroupId]);

  useEffect(() => {
    const checkIfOutsideContent = () => {
      if (!graphRef.current) return;

      const allPoints: { x: number; y: number }[] = [];

      const currentGraphNodes = graphData.nodes as Array<{ x?: number; y?: number }>;
      currentGraphNodes.forEach(n => {
        if (n.x !== undefined && n.y !== undefined) {
          allPoints.push({ x: n.x, y: n.y });
        }
      });

      shapes.forEach(shape => {
        shape.points.forEach(p => {
          allPoints.push({ x: p.x, y: p.y });
        });
      });

      if (allPoints.length === 0) {
        setIsOutsideContent(false);
        return;
      }

      const minX = Math.min(...allPoints.map(p => p.x));
      const maxX = Math.max(...allPoints.map(p => p.x));
      const minY = Math.min(...allPoints.map(p => p.y));
      const maxY = Math.max(...allPoints.map(p => p.y));

      const padding = 200;
      const contentBounds = {
        minX: minX - padding,
        maxX: maxX + padding,
        minY: minY - padding,
        maxY: maxY + padding,
      };

      try {
        const center = graphRef.current.centerAt();
        const zoom = graphRef.current.zoom();
        const viewWidth = dimensions.width / zoom;
        const viewHeight = dimensions.height / zoom;

        const viewBounds = {
          minX: center.x - viewWidth / 2,
          maxX: center.x + viewWidth / 2,
          minY: center.y - viewHeight / 2,
          maxY: center.y + viewHeight / 2,
        };

        const isIntersecting = !(
          viewBounds.maxX < contentBounds.minX ||
          viewBounds.minX > contentBounds.maxX ||
          viewBounds.maxY < contentBounds.minY ||
          viewBounds.minY > contentBounds.maxY
        );

        setIsOutsideContent(!isIntersecting);
      } catch (e) {
        setIsOutsideContent(false);
      }
    };

    const interval = setInterval(checkIfOutsideContent, 500);
    checkIfOutsideContent();

    return () => clearInterval(interval);
  }, [graphData.nodes, shapes, dimensions]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set());
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [isHoveringShape, setIsHoveringShape] = useState(false);
  const [isHoveringNode, setIsHoveringNode] = useState(false);
  const [dragStartWorld, setDragStartWorld] = useState<{ x: number; y: number } | null>(null);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);
  const dragNodePrevRef = useRef<{ x: number; y: number } | null>(null);

  const [isResizing, setIsResizing] = useState(false);
  const activeResizeHandleRef = useRef<ResizeHandle | null>(null);
  const resizeStartBoundsRef = useRef<ShapeBounds | null>(null);
  const resizeDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const resizingShapeIdRef = useRef<string | null>(null);
  const originalShapeRef = useRef<DrawnShape | null>(null);
  const [hoveredResizeHandle, setHoveredResizeHandle] = useState<ResizeHandle | null>(null);
  const [resizeUpdateCounter, setResizeUpdateCounter] = useState(0);

  const [isMiddleMousePanning, setIsMiddleMousePanning] = useState(false);
  const middleMouseStartRef = useRef<{ x: number; y: number } | null>(null);

  const [showSelectionPane, setShowSelectionPane] = useState(false);

  const isDrawingTool = ['pen', 'rectangle', 'diamond', 'circle', 'arrow', 'line', 'eraser'].includes(graphSettings.activeTool);
  const isTextTool = graphSettings.activeTool === 'text';
  const isSelectTool = graphSettings.activeTool === 'select';
  const isPanTool = graphSettings.activeTool === 'pan' || (!isDrawingTool && !isTextTool && !isSelectTool);

  const getToolCursor = () => {
    if (graphSettings.isPreviewMode) {
      return isHoveringNode ? 'pointer' : 'default';
    }

    if (isSelectTool) {
      if (isMiddleMousePanning) return 'grabbing';
      if (hoveredResizeHandle) return getCursorForHandle(hoveredResizeHandle);
      if (isHoveringNode || isHoveringShape) return 'pointer';
      return 'default';
    }

    if (isPanTool) {
      if (isHoveringNode || isHoveringShape) return 'pointer';
      return 'grab';
    }

    if (isTextTool) return 'text';
    if (graphSettings.activeTool === 'eraser') return 'crosshair';
    if (isDrawingTool) return 'crosshair';
    return 'default';
  };

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

  useEffect(() => {
    if (!isResizing || !graphRef.current) return;

    let animationFrameId: number;
    const refresh = () => {
      if (graphRef.current) {
        const z = graphRef.current.zoom();
        graphRef.current.zoom(z * 1.00001, 0);
        graphRef.current.zoom(z, 0);
      }
      animationFrameId = requestAnimationFrame(refresh);
    };

    animationFrameId = requestAnimationFrame(refresh);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isResizing]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!containerRef.current?.contains(e.target as Node) || !graphRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = e.deltaY > 0 ? 0.88 : 1.12;
        const currentZoom = graphRef.current.zoom();
        const newZoom = Math.max(0.1, Math.min(10, currentZoom * zoomFactor));

        graphRef.current.zoom(newZoom, 0);
      } else {
        const scale = graphTransform.k || 1;
        const panX = e.deltaX / scale;
        const panY = e.deltaY / scale;

        const currentCenter = graphRef.current.centerAt();
        graphRef.current.centerAt(
          currentCenter.x + panX,
          currentCenter.y + panY,
          0
        );
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [graphTransform.k]);

  // Handle Undo/Redo and Delete shortcuts
  // Filter shapes by active group
  const filteredShapes = useMemo(() => {
    if (activeGroupId === null || activeGroupId === undefined) {
      return shapes;
    }
    return shapes.filter(s => s.groupId === activeGroupId || s.groupId === undefined);
  }, [shapes, activeGroupId]);

  const shapesRef = useRef(filteredShapes);
  const selectedShapeIdsRef = useRef(selectedShapeIds);
  const selectedNodeIdsRefForDelete = useRef(selectedNodeIds);

  // Always keep shapesRef in sync with filteredShapes
  useEffect(() => {
    shapesRef.current = filteredShapes;
  }, [filteredShapes]);

  // Also sync during render if not dragging/resizing (for immediate updates)
  if (!dragNodePrevRef.current && !isResizing) {
    shapesRef.current = filteredShapes;
  }
  selectedShapeIdsRef.current = selectedShapeIds;
  selectedNodeIdsRefForDelete.current = selectedNodeIds;

  // Force redraw when activeGroupId changes
  useEffect(() => {
    if (graphRef.current) {
      const z = graphRef.current.zoom();
      graphRef.current.zoom(z * 1.00001, 0);
      setTimeout(() => graphRef.current?.zoom(z, 0), 20);
    }
  }, [activeGroupId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace')) {
        // Don't delete if typing in an input
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return;
        }

        const hasSelectedShapes = selectedShapeIdsRef.current.size > 0;
        const hasSelectedNodes = selectedNodeIdsRefForDelete.current.size > 0;

        if (hasSelectedShapes || hasSelectedNodes) {
          e.preventDefault();

          // Delete selected shapes
          if (hasSelectedShapes) {
            pushToUndoStack(shapesRef.current);
            const toDelete = shapesRef.current.filter(s => selectedShapeIdsRef.current.has(s.id));
            const remaining = shapesRef.current.filter(s => !selectedShapeIdsRef.current.has(s.id));
            setShapes(remaining);
            toDelete.forEach(s => {
              api.drawings.delete(s.id).catch(err => console.error('Failed to delete drawing:', err));
            });
            setSelectedShapeIds(new Set());
          }

          // Delete selected nodes
          if (hasSelectedNodes) {
            const deleteNode = useGraphStore.getState().deleteNode;
            selectedNodeIdsRefForDelete.current.forEach(nodeId => {
              deleteNode(nodeId);
              api.nodes.delete(nodeId).catch(err => console.error('Failed to delete node:', err));
            });
            setSelectedNodeIds(new Set());
            setActiveNode(null);
          }
        }
      } else if (e.key === 'Escape') {
        setSelectedShapeIds(new Set());
        setSelectedNodeIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, pushToUndoStack, setShapes, setActiveNode]);



  useEffect(() => {
    if (isPreviewMode && !prevPreviewModeRef.current && graphRef.current) {
      graphRef.current.d3ReheatSimulation?.();
    }
    prevPreviewModeRef.current = isPreviewMode;
  }, [isPreviewMode]);





  /* Use refs for callback stability to prevent ForceGraph2D handler rebinding issues */
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds; // Update immediately in render body



  // selectedShapeIdsRef is already defined above
  const graphDataRef = useRef(graphData);
  graphDataRef.current = graphData; // Update immediately in render body

  /* Manual Group Drag Refs */
  const hoveredNode = useGraphStore(s => s.hoveredNode);
  const dragGroupRef = useRef<{
    active: boolean;
    startMouse: { x: number; y: number };
    nodeId: string;
    initialNodes: Map<string, { x: number; y: number; fx?: number; fy?: number }>;
    initialShapes: Map<string, DrawnShape['points']>;
  } | null>(null);

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

  const handleContainerMouseMove = useCallback((e: React.MouseEvent) => {
    // Manual Group Drag Logic
    if (dragGroupRef.current?.active) {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPoint = screenToWorld(screenX, screenY);

      const dx = worldPoint.x - dragGroupRef.current.startMouse.x;
      const dy = worldPoint.y - dragGroupRef.current.startMouse.y;



      // Update Nodes
      const initialNodes = dragGroupRef.current.initialNodes;
      graphDataRef.current.nodes.forEach((n: any) => {
        const initPos = initialNodes.get(String(n.id));
        if (initPos) {
          const newX = (initPos.fx ?? initPos.x ?? 0) + dx;
          const newY = (initPos.fy ?? initPos.y ?? 0) + dy;
          n.fx = newX;
          n.fy = newY;
          n.x = newX;
          n.y = newY;
        }
      });

      // Update Shapes
      const initialShapes = dragGroupRef.current.initialShapes;
      if (initialShapes.size > 0) {
        shapesRef.current = shapesRef.current.map(s => {
          const initPoints = initialShapes.get(s.id);
          if (initPoints) {
            return {
              ...s,
              points: initPoints.map(p => ({ x: p.x + dx, y: p.y + dy }))
            };
          }
          return s;
        });
      }
      return;
    }

    // Marquee selection update
    if (isMarqueeSelecting) {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPoint = screenToWorld(screenX, screenY);
      setMarqueeEnd(worldPoint);
      if (graphRef.current) {
        const z = graphRef.current.zoom();
        graphRef.current.zoom(z * 1.00001, 0);
        graphRef.current.zoom(z, 0);
      }
      return;
    }

    if (graphSettings.activeTool !== 'select') return;

    const rect = e.currentTarget.getBoundingClientRect();

    // If dragging a node, do not interfere with overlay
    if (dragNodePrevRef.current) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorld(screenX, screenY);
    const scale = graphTransform.k || 1;

    const isNear = filteredShapes.some(s => isPointNearShape(worldPoint, s, scale, 10));
    if (isNear !== isHoveringShape) {
      setIsHoveringShape(isNear);
    }
  }, [graphSettings.activeTool, graphTransform, filteredShapes, screenToWorld, isHoveringShape, isMarqueeSelecting]);



  const handleContainerMouseDownCapture = useCallback((e: React.MouseEvent) => {
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    const selectedNodeIds = selectedNodeIdsRef.current;

    if (graphSettings.activeTool !== 'select') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorld(screenX, screenY);
    const scale = graphTransform.k || 1;

    // Check if over a shape (let overlay handle)
    const isOverShape = filteredShapes.some(s => isPointNearShape(worldPoint, s, scale, 10));
    if (isOverShape) return;

    // Check if we're clicking ON a node by examining coordinates
    // Find the closest node within hit radius (handles overlapping nodes)
    const nodeHitRadius = 15 / scale;
    let clickedNodeId: string | null = null;
    let closestDist = Infinity;

    graphDataRef.current.nodes.forEach((n: any) => {
      const dx = (n.x ?? 0) - worldPoint.x;
      const dy = (n.y ?? 0) - worldPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= nodeHitRadius && dist < closestDist) {
        closestDist = dist;
        clickedNodeId = String(n.id);
      }
    });



    // If we clicked on a node that is part of selection, start group drag AND open editor
    if (clickedNodeId && selectedNodeIds.has(clickedNodeId)) {
      lastHoveredNodeIdRef.current = clickedNodeId;
      lastNodeClickTimeRef.current = Date.now();

      // Open editor for clicked node
      const fullNode = nodes.find(n => n.id === clickedNodeId);
      if (fullNode) {
        setActiveNode(fullNode);
      }

      const initialNodes = new Map();
      graphDataRef.current.nodes.forEach((n: any) => {
        if (selectedNodeIds.has(String(n.id)) && String(n.id) !== clickedNodeId) {
          initialNodes.set(String(n.id), { x: n.x, y: n.y, fx: n.fx, fy: n.fy });
        }
      });

      const initialShapes = new Map();
      if (selectedShapeIdsRef.current.size > 0) {
        shapesRef.current.forEach(s => {
          if (selectedShapeIdsRef.current.has(s.id)) {
            initialShapes.set(s.id, JSON.parse(JSON.stringify(s.points)));
          }
        });
      }

      dragGroupRef.current = {
        active: true,
        startMouse: worldPoint,
        nodeId: clickedNodeId,
        initialNodes,
        initialShapes
      };

      return;
    }

    // If we clicked on a node that is NOT in selection, select it and open editor
    // Don't return - let ForceGraph2D handle the drag
    if (clickedNodeId && !selectedNodeIds.has(clickedNodeId)) {
      lastHoveredNodeIdRef.current = clickedNodeId;
      lastNodeClickTimeRef.current = Date.now();

      // Find the full node object and activate it
      const fullNode = nodes.find(n => n.id === clickedNodeId);
      if (fullNode) {
        setActiveNode(fullNode);
      }

      // Also select it
      setSelectedShapeIds(new Set());
      setSelectedNodeIds(new Set([clickedNodeId]));
      return;
    }

    // Not over a node or shape - start marquee selection

    lastHoveredNodeIdRef.current = null;

    if (!e.shiftKey) {
      setSelectedShapeIds(new Set());
      setSelectedNodeIds(new Set());
    }
    setIsMarqueeSelecting(true);
    setMarqueeStart(worldPoint);
    setMarqueeEnd(worldPoint);
  }, [screenToWorld, graphTransform, graphSettings.activeTool, shapes, nodes, setActiveNode]);

  const handleContainerMouseUpCapture = useCallback(() => {
    // Finalize group drag
    if (dragGroupRef.current?.active) {
      const selectedShapeIds = selectedShapeIdsRef.current;
      if (selectedShapeIds.size > 0) {
        const finalShapes = shapesRef.current;
        setShapes(finalShapes);
        finalShapes.forEach(s => {
          if (selectedShapeIds.has(s.id)) {
            api.drawings.update(s.id, { points: JSON.stringify(s.points) })
              .catch(err => console.error('Failed to update drawing:', err));
          }
        });
      }

      dragGroupRef.current = null;
    }

    // Finalize marquee selection
    if (isMarqueeSelecting && marqueeStart && marqueeEnd) {
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);

      const newSelectedNodes = new Set<string>();
      graphDataRef.current.nodes.forEach((n: any) => {
        if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
          newSelectedNodes.add(String(n.id));
        }
      });

      const newSelectedShapes = new Set<string>();
      filteredShapes.forEach(s => {
        const cx = s.points.reduce((sum, p) => sum + p.x, 0) / s.points.length;
        const cy = s.points.reduce((sum, p) => sum + p.y, 0) / s.points.length;
        if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
          newSelectedShapes.add(s.id);
        }
      });



      setSelectedNodeIds(newSelectedNodes);
      setSelectedShapeIds(newSelectedShapes);
      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
    }
  }, [setShapes, isMarqueeSelecting, marqueeStart, marqueeEnd, filteredShapes]);

  // Handle node drag via ForceGraph - move other selected nodes along
  const handleNodeDrag = useCallback((node: any) => {
    isNodeDraggingRef.current = true;
    lastDragTimeRef.current = Date.now();
    if (!dragGroupRef.current?.active) return;
    if (String(node.id) !== dragGroupRef.current.nodeId) return;

    // Calculate delta from the dragged node's movement
    const initialNodes = dragGroupRef.current.initialNodes;
    const startMouse = dragGroupRef.current.startMouse;

    // The dragged node's new position gives us the delta
    const draggedNodeInitial = {
      x: startMouse.x,
      y: startMouse.y
    };
    const dx = (node.x ?? 0) - draggedNodeInitial.x;
    const dy = (node.y ?? 0) - draggedNodeInitial.y;



    // Update other selected nodes
    graphDataRef.current.nodes.forEach((n: any) => {
      const initPos = initialNodes.get(String(n.id));
      if (initPos) {
        const newX = (initPos.x ?? 0) + dx;
        const newY = (initPos.y ?? 0) + dy;
        n.fx = newX;
        n.fy = newY;
        n.x = newX;
        n.y = newY;
      }
    });

    // Update shapes
    const initialShapes = dragGroupRef.current.initialShapes;
    if (initialShapes.size > 0) {
      shapesRef.current = shapesRef.current.map(s => {
        const initPoints = initialShapes.get(s.id);
        if (initPoints) {
          return {
            ...s,
            points: initPoints.map(p => ({ x: p.x + dx, y: p.y + dy }))
          };
        }
        return s;
      });
    }
  }, []);

  const handleNodeDragEnd = useCallback((node: any) => {
    // Small delay to ensure click handler sees the drag state
    setTimeout(() => {
      isNodeDraggingRef.current = false;
    }, 250);

    const storeNodes = useGraphStore.getState().nodes;
    const updateNode = useGraphStore.getState().updateNode;

    if (dragGroupRef.current?.active) {
      const selectedNodeIds = selectedNodeIdsRef.current;

      // Persist node positions for all selected nodes
      graphDataRef.current.nodes.forEach((n: any) => {
        if (selectedNodeIds.has(String(n.id))) {
          updateNode(String(n.id), { x: n.x, y: n.y });

          const fullNode = storeNodes.find(sn => sn.id === String(n.id));
          if (fullNode) {
            api.nodes.update(String(n.id), {
              id: fullNode.id,
              title: fullNode.title,
              content: fullNode.content || '',
              excerpt: fullNode.excerpt || '',
              groupId: fullNode.groupId,
              projectId: fullNode.projectId,
              userId: fullNode.userId,
              x: n.x,
              y: n.y
            }).catch(err => console.error('Failed to update node position:', err));
          }
        }
      });

      // Sync shapes to state and persist
      const selectedShapeIds = selectedShapeIdsRef.current;
      if (selectedShapeIds.size > 0) {
        const finalShapes = shapesRef.current;
        setShapes(finalShapes);
        finalShapes.forEach(s => {
          if (selectedShapeIds.has(s.id)) {
            api.drawings.update(s.id, { points: JSON.stringify(s.points) })
              .catch(err => console.error('Failed to update drawing:', err));
          }
        });
      }

      dragGroupRef.current = null;
    } else if (node) {
      // Single node drag - persist position
      const nodeId = String(node.id);
      updateNode(nodeId, { x: node.x, y: node.y });

      const fullNode = storeNodes.find(sn => sn.id === nodeId);
      if (fullNode) {
        api.nodes.update(nodeId, {
          id: fullNode.id,
          title: fullNode.title,
          content: fullNode.content || '',
          excerpt: fullNode.excerpt || '',
          groupId: fullNode.groupId,
          projectId: fullNode.projectId,
          userId: fullNode.userId,
          x: node.x,
          y: node.y
        }).catch(err => console.error('Failed to update node position:', err));
      }
    }
  }, [setShapes]);

  /* End Manual Refs */


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
      const erasedShapes = filteredShapes.filter(s => isPointNearShape(worldPoint, s, scale));
      // Keep shapes from other groups and shapes that weren't erased
      const remaining = shapes.filter(s => {
        // Keep shapes from other groups
        if (activeGroupId !== null && s.groupId !== activeGroupId && s.groupId !== undefined) {
          return true;
        }
        // For shapes in current group, check if they should be erased
        return !isPointNearShape(worldPoint, s, scale);
      });
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
      groupId: activeGroupId ?? undefined,
    };

    addShape(newShape);

    if (currentProject?.id) {
      api.drawings.create(shapeToApiDrawing(newShape, currentProject.id, activeGroupId ?? undefined))
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
    const renderShapes = shapesRef.current;
    renderShapes.forEach(shape => {
      drawShapeOnContext(ctx, shape, globalScale);
      if (selectedShapeIds.has(shape.id)) {
        drawSelectionBox(ctx, shape, globalScale);

        if (selectedShapeIds.size === 1) {
          const bounds = getShapeBounds(shape);
          if (bounds) {
            drawResizeHandles(ctx, bounds, globalScale);
          }
        }
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

    if (isMarqueeSelecting && marqueeStart && marqueeEnd) {
      drawMarquee(ctx, marqueeStart, marqueeEnd, globalScale);
    }
  }, [filteredShapes, isDrawing, currentPoints, graphSettings.activeTool, graphSettings.strokeColor, graphSettings.strokeWidth, graphSettings.strokeStyle, selectedShapeIds, isMarqueeSelecting, marqueeStart, marqueeEnd, isResizing, resizeUpdateCounter, drawPreview, currentProject?.id, shapeToApiDrawing, addShape]);

  const handleSelectMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isSelectTool) return;
    if (isHoveringNode) return;

    if (e.button === 1) {
      e.preventDefault();
      setIsMiddleMousePanning(true);
      middleMouseStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button !== 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorld(screenX, screenY);
    const scale = graphTransform.k || 1;

    if (selectedShapeIds.size === 1) {
      const selectedShape = filteredShapes.find(s => selectedShapeIds.has(s.id));
      if (selectedShape) {
        const bounds = getShapeBounds(selectedShape);
        if (bounds) {
          const handle = getHandleAtPoint(worldPoint, bounds, scale);
          if (handle) {
            setIsResizing(true);
            activeResizeHandleRef.current = handle;
            resizeStartBoundsRef.current = bounds;
            resizeDragStartRef.current = worldPoint;
            resizingShapeIdRef.current = selectedShape.id;
            originalShapeRef.current = { ...selectedShape, points: [...selectedShape.points] };
            pushToUndoStack(shapes);
            return;
          }
        }
      }
    }

    const clickedShape = filteredShapes.find(s => isPointNearShape(worldPoint, s, scale, 10));

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
        if (!selectedShapeIds.has(clickedShape.id)) {
          setSelectedShapeIds(new Set([clickedShape.id]));
          setSelectedNodeIds(new Set());
        }
      }
      setIsDraggingSelection(true);
      setDragStartWorld(worldPoint);
      pushToUndoStack(shapes);
    } else {
      if (!e.shiftKey) {
        setSelectedShapeIds(new Set());
        setSelectedNodeIds(new Set());
      }
      setIsMarqueeSelecting(true);
      setMarqueeStart(worldPoint);
      setMarqueeEnd(worldPoint);
    }
  }, [isSelectTool, isHoveringNode, filteredShapes, selectedShapeIds, screenToWorld, graphTransform.k, getShapeBounds, pushToUndoStack, shapes, isPointNearShape]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full bg-transparent"
      style={{
        cursor: getToolCursor(),
        overscrollBehavior: 'none',
        touchAction: 'none',
      }}
      suppressHydrationWarning
      onMouseMove={handleContainerMouseMove}
      onMouseDownCapture={handleContainerMouseDownCapture}
      onMouseDown={handleSelectMouseDown}
      onMouseUpCapture={handleContainerMouseUpCapture}
    >
      {isMounted ? (
        <>
          <div
            style={{
              cursor: getToolCursor(),
            }}
            className="[&_canvas]:!cursor-[inherit]"
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
              nodeLabel={() => ''}
              linkColor={(link: any) => link.color || '#52525b'}
              linkWidth={linkWidth}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              linkCurvature={0.1}
              linkCanvasObjectMode={() => 'after'}
              linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                if (!link.description) return;

                const source = link.source;
                const target = link.target;
                if (!source?.x || !target?.x) return;

                const curvature = 0.1;
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const l = Math.sqrt(dx * dx + dy * dy);

                if (l === 0) return;

                const straightMidX = (source.x + target.x) / 2;
                const straightMidY = (source.y + target.y) / 2;

                const controlPointOffset = curvature * l;
                const controlX = straightMidX + dy / l * controlPointOffset;
                const controlY = straightMidY - dx / l * controlPointOffset;

                const t = 0.5;
                const midX = (1 - t) * (1 - t) * source.x + 2 * (1 - t) * t * controlX + t * t * target.x;
                const midY = (1 - t) * (1 - t) * source.y + 2 * (1 - t) * t * controlY + t * t * target.y;

                const fontSize = Math.max(10 / globalScale, 2);
                ctx.font = `${fontSize}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const padding = 3 / globalScale;
                const textWidth = ctx.measureText(link.description).width;

                ctx.fillStyle = 'rgba(24, 24, 27, 0.9)';
                ctx.beginPath();
                ctx.roundRect(midX - textWidth / 2 - padding, midY - fontSize / 2 - padding, textWidth + padding * 2, fontSize + padding * 2, 3 / globalScale);
                ctx.fill();

                ctx.fillStyle = '#a1a1aa';
                ctx.fillText(link.description, midX, midY);
              }}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              onNodeDrag={handleNodeDrag}
              onNodeDragEnd={handleNodeDragEnd}
              onLinkClick={handleLinkClick}
              onLinkHover={handleLinkHover}
              onBackgroundClick={() => {
                const timeSinceNodeClick = Date.now() - lastNodeClickTimeRef.current;
                if (timeSinceNodeClick < 300) {
                  return;
                }
                setActiveNode(null);
              }}
              onZoom={handleZoom}
              onRenderFramePost={onRenderFramePost}
              enableNodeDrag={!graphSettings.lockAllMovement && !isDrawingTool}
              enableZoomInteraction={false}
              enablePanInteraction={isPanTool}
              cooldownTicks={isPreviewMode ? 100 : 0}
              d3AlphaDecay={isPreviewMode ? 0.02 : 1}
              d3VelocityDecay={isPreviewMode ? 0.3 : 0.9}
              backgroundColor="transparent"
            />
          </div>
          <canvas
            ref={previewCanvasRef}
            width={dimensions.width}
            height={dimensions.height}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 15 }}
          />
          {isDrawingTool && (
            <div
              className="absolute inset-0"
              style={{
                cursor: getToolCursor(),
                pointerEvents: 'auto'
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />
          )}
          {isSelectTool && (
            <div
              className="absolute inset-0"
              style={{
                pointerEvents: 'none',
                cursor: getToolCursor()
              }}

              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const worldPoint = screenToWorld(screenX, screenY);
                const scale = graphTransform.k || 1;

                if (isMiddleMousePanning && middleMouseStartRef.current && graphRef.current) {
                  const dx = e.clientX - middleMouseStartRef.current.x;
                  const dy = e.clientY - middleMouseStartRef.current.y;

                  graphRef.current.centerAt(
                    graphTransform.x - dx,
                    graphTransform.y - dy,
                    0
                  );

                  middleMouseStartRef.current = { x: e.clientX, y: e.clientY };
                  return;
                }

                if (isMarqueeSelecting) {
                  setMarqueeEnd(worldPoint);
                  if (graphRef.current) {
                    const z = graphRef.current.zoom();
                    graphRef.current.zoom(z * 1.00001, 0);
                    graphRef.current.zoom(z, 0);
                  }
                  return;
                }

                if (isResizing && activeResizeHandleRef.current && resizeStartBoundsRef.current && resizeDragStartRef.current && originalShapeRef.current) {
                  const resizedShape = resizeShape(
                    originalShapeRef.current,
                    activeResizeHandleRef.current,
                    worldPoint,
                    resizeDragStartRef.current,
                    resizeStartBoundsRef.current
                  );
                  shapesRef.current = shapesRef.current.map(s => s.id === resizedShape.id ? resizedShape : s);
                  setResizeUpdateCounter(c => c + 1);

                  if (graphRef.current) {
                    const z = graphRef.current.zoom();
                    graphRef.current.zoom(z * 1.00001, 0);
                    graphRef.current.zoom(z, 0);
                  }
                  return;
                }

                if (selectedShapeIds.size === 1 && !isDraggingSelection) {
                  const selectedShape = filteredShapes.find(s => selectedShapeIds.has(s.id));
                  if (selectedShape) {
                    const bounds = getShapeBounds(selectedShape);
                    if (bounds) {
                      const handle = getHandleAtPoint(worldPoint, bounds, scale);
                      setHoveredResizeHandle(handle);
                    } else {
                      setHoveredResizeHandle(null);
                    }
                  }
                } else {
                  setHoveredResizeHandle(null);
                }

                if (!isDraggingSelection || !dragStartWorld || selectedShapeIds.size === 0) return;

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

                  if (selectedNodeIds.size > 0) {
                    const currentGraphNodes = graphData.nodes as Array<{ id: string | number; x?: number; y?: number; fx?: number; fy?: number }>;
                    currentGraphNodes.forEach(n => {
                      if (selectedNodeIds.has(String(n.id))) {
                        const newX = (n.fx ?? n.x ?? 0) + dx;
                        const newY = (n.fy ?? n.y ?? 0) + dy;
                        n.fx = newX;
                        n.fy = newY;
                        n.x = newX;
                        n.y = newY;
                      }
                    });
                  }

                  setDragStartWorld(worldPoint);
                }
              }}
              onMouseUp={() => {
                if (isMiddleMousePanning) {
                  setIsMiddleMousePanning(false);
                  middleMouseStartRef.current = null;
                  return;
                }

                if (isResizing && resizingShapeIdRef.current) {
                  const finalShapes = shapesRef.current;
                  setShapes(finalShapes);

                  const resizedShape = finalShapes.find(s => s.id === resizingShapeIdRef.current);
                  if (resizedShape) {
                    api.drawings.update(resizedShape.id, { points: JSON.stringify(resizedShape.points) })
                      .catch(err => console.error('Failed to update drawing:', err));
                  }

                  setIsResizing(false);
                  activeResizeHandleRef.current = null;
                  resizeStartBoundsRef.current = null;
                  resizeDragStartRef.current = null;
                  resizingShapeIdRef.current = null;
                  originalShapeRef.current = null;
                  return;
                }

                if (isMarqueeSelecting && marqueeStart && marqueeEnd) {
                  const minX = Math.min(marqueeStart.x, marqueeEnd.x);
                  const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
                  const minY = Math.min(marqueeStart.y, marqueeEnd.y);
                  const maxY = Math.max(marqueeStart.y, marqueeEnd.y);

                  const selectedShapeIdsNew = new Set<string>();
                  filteredShapes.forEach(s => {
                    if (isShapeInMarquee(s, marqueeStart, marqueeEnd)) {
                      selectedShapeIdsNew.add(s.id);
                    }
                  });
                  setSelectedShapeIds(prev => {
                    const next = new Set(prev);
                    selectedShapeIdsNew.forEach(id => next.add(id));
                    return next;
                  });

                  const selectedNodeIdsNew = new Set<string>();
                  const currentGraphNodes = graphData.nodes as Array<{ id: string | number; x?: number; y?: number }>;
                  currentGraphNodes.forEach(n => {
                    const x = n.x || 0;
                    const y = n.y || 0;
                    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                      selectedNodeIdsNew.add(String(n.id));
                    }
                  });
                  setSelectedNodeIds(prev => {
                    const next = new Set(prev);
                    selectedNodeIdsNew.forEach(id => next.add(id));
                    return next;
                  });

                  setIsMarqueeSelecting(false);
                  setMarqueeStart(null);
                  setMarqueeEnd(null);
                  if (graphRef.current) {
                    const z = graphRef.current.zoom();
                    graphRef.current.zoom(z * 1.00001, 0);
                    graphRef.current.zoom(z, 0);
                  }
                  return;
                }

                if (isDraggingSelection && selectedShapeIds.size > 0) {
                  filteredShapes.filter(s => selectedShapeIds.has(s.id)).forEach(s => {
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
                setIsMarqueeSelecting(false);
                setMarqueeStart(null);
                setMarqueeEnd(null);
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
                      groupId: activeGroupId ?? undefined,
                    };
                    addShape(newShape);
                    if (currentProject?.id) {
                      api.drawings.create(shapeToApiDrawing(newShape, currentProject.id, activeGroupId ?? undefined))
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
                      groupId: activeGroupId ?? undefined,
                    };
                    addShape(newShape);
                    if (currentProject?.id) {
                      api.drawings.create(shapeToApiDrawing(newShape, currentProject.id, activeGroupId ?? undefined))
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


      <GroupsTabs
        groups={groups}
        activeGroupId={activeGroupId}
        onSelectGroup={setActiveGroupId}
        onAddGroup={async () => {
          const newName = `Group ${groups.length + 1}`;
          const newColor = getNextGroupColor(groups);

          try {
            const newGroup = await api.groups.create({ name: newName, color: newColor });
            const groupWithOrder = { ...newGroup, order: groups.length };
            addGroup(groupWithOrder);
            setActiveGroupId(newGroup.id);
          } catch (err: any) {
            console.error("Failed to create group:", err.message);
            alert("Failed to create group. Please try again.");
          }
        }}
        onRenameGroup={(id, newName) => {
          updateGroup(id, { name: newName });
          api.groups.update(id, { name: newName })
            .catch(err => console.warn("Backend sync failed (Rename Group):", err.message));
        }}
        onDeleteGroup={async (id) => {
          const groupToDelete = groups.find(g => g.id === id);
          const groupOrder = groupToDelete?.order;
          const nodesInGroup = nodes.filter(n => n.groupId === groupOrder);
          const shapesInGroup = shapes.filter(s => s.groupId === groupOrder);
          const nodeCount = nodesInGroup.length;
          const shapeCount = shapesInGroup.length;

          const groupName = groupToDelete?.name || 'this group';
          let message = `Are you sure you want to delete "${groupName}"?`;
          if (nodeCount > 0 || shapeCount > 0) {
            message += '\n\nThis will permanently delete:';
            if (nodeCount > 0) message += `\n• ${nodeCount} node${nodeCount > 1 ? 's' : ''}`;
            if (shapeCount > 0) message += `\n• ${shapeCount} drawing${shapeCount > 1 ? 's' : ''}`;
          }

          if (!window.confirm(message)) {
            return;
          }

          // Delete all nodes in this group
          for (const node of nodesInGroup) {
            deleteNode(node.id);
            api.nodes.delete(node.id).catch(() => { });
          }

          // Delete all shapes/drawings in this group
          for (const shape of shapesInGroup) {
            deleteShape(shape.id);
            api.drawings.delete(shape.id).catch(() => { });
          }

          // Delete the group locally
          deleteGroup(id);

          // Try backend delete silently, fall back to local hide
          try {
            await api.groups.delete(id);
          } catch {
            const hidden = JSON.parse(localStorage.getItem('nexus_hidden_groups') || '[]');
            if (!hidden.includes(id)) {
              hidden.push(id);
              localStorage.setItem('nexus_hidden_groups', JSON.stringify(hidden));
            }
          }
        }}
        onReorderGroups={(newGroups) => {
          setGroups(newGroups);
          api.groups.reorder(newGroups.map(g => g.id))
            .catch(err => console.warn("Backend sync failed (Reorder Groups):", err.message));
        }}
      />

      {isOutsideContent && (
        <button
          onClick={() => {
            if (!graphRef.current) return;

            const allPoints: { x: number; y: number }[] = [];

            const currentGraphNodes = graphData.nodes as Array<{ x?: number; y?: number }>;
            currentGraphNodes.forEach(n => {
              if (n.x !== undefined && n.y !== undefined) {
                allPoints.push({ x: n.x, y: n.y });
              }
            });

            shapesRef.current.forEach(shape => {
              shape.points.forEach(p => {
                allPoints.push({ x: p.x, y: p.y });
              });
            });

            if (allPoints.length === 0) return;

            const sumX = allPoints.reduce((acc, p) => acc + p.x, 0);
            const sumY = allPoints.reduce((acc, p) => acc + p.y, 0);
            const centerX = sumX / allPoints.length;
            const centerY = sumY / allPoints.length;

            graphRef.current.centerAt(centerX, centerY, 500);
            graphRef.current.zoom(1, 500);
          }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-zinc-800/90 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-sm border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Go back to content
        </button>
      )}

      <button
        onClick={() => setShowSelectionPane(!showSelectionPane)}
        className={`absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-lg px-3 py-2 text-sm shadow-lg backdrop-blur-sm border transition-all ${showSelectionPane
          ? 'bg-zinc-700 text-white border-zinc-600'
          : 'bg-zinc-800/90 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white hover:border-zinc-600'
          }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        Objects
      </button>

      {
        showSelectionPane && (
          <SelectionPane
            isPreviewMode={graphSettings.isPreviewMode}
            nodes={nodes}
            shapes={shapes}
            selectedNodeIds={selectedNodeIds}
            selectedShapeIds={selectedShapeIds}
            onClose={() => setShowSelectionPane(false)}
            onLocateNode={(nodeId, x, y) => {
              if (graphRef.current) {
                graphRef.current.centerAt(x, y, 500);
                graphRef.current.zoom(1.5, 500);
              }
            }}
            onLocateShape={(shapeId, x, y) => {
              if (graphRef.current) {
                graphRef.current.centerAt(x, y, 500);
                graphRef.current.zoom(1.5, 500);
              }
            }}
            onSelectNode={(nodeId) => {
              const node = nodes.find(n => n.id === nodeId);
              if (node) {
                setActiveNode(node);
                setSelectedNodeIds(new Set([nodeId]));
                setSelectedShapeIds(new Set());
              }
            }}
            onSelectShape={(shapeId) => {
              setSelectedShapeIds(new Set([shapeId]));
              setSelectedNodeIds(new Set());
              setActiveNode(null);
            }}
            onDeleteNode={(nodeId) => {
              deleteNode(nodeId);
              setSelectedNodeIds(new Set());
              setActiveNode(null);
            }}
            onDeleteShape={(shapeId) => {
              deleteShape(shapeId);
              setSelectedShapeIds(new Set());
            }}
          />
        )
      }

      {
        selectedLink && (
          <ConnectionProperties
            link={selectedLink}
            onClose={() => setSelectedLink(null)}
          />
        )
      }
    </div >
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
