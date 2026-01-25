'use client';

import dynamic from 'next/dynamic';
import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { useGraphStore, filterNodes } from '@/store/useGraphStore';
import { useToast } from '@/context/ToastContext';
import { DrawingProperties } from './DrawingProperties';
import { ConnectionProperties } from './ConnectionProperties';
import { drawShapeOnContext, isPointNearShape, drawSelectionBox, isShapeInMarquee, drawMarquee } from './drawingUtils';
import { getShapeBounds, drawResizeHandles, getHandleAtPoint, resizeShape, rotateShape, getCursorForHandle, ResizeHandle, ShapeBounds, getResizeHandlePosition } from './resizeUtils';
import { SelectionPane } from './SelectionPane';
import { GroupsTabs, getNextGroupColor } from './GroupsTabs';
import { DrawnShape } from '@/types/knowledge';
import { api, ApiDrawing } from '@/lib/api';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
}) as any;

import { forwardRef, useImperativeHandle } from 'react';

export type GraphCanvasHandle = {
  exportToPNG: () => void;
  exportToJPG: () => void;
};

export const GraphCanvas = forwardRef<GraphCanvasHandle>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isMounted, setIsMounted] = useState(false);

  const processExport = async (type: 'png' | 'jpg') => {
    const graphCanvas = containerRef.current?.querySelector('canvas');
    if (!graphCanvas || !graphRef.current) return;

    // 1. Save View
    const prevZoom = graphRef.current.zoom() || 1;
    const prevCenter = graphRef.current.centerAt() || { x: 0, y: 0 };

    // 2. Get Data State
    const state = useGraphStore.getState();
    const { nodes, shapes, activeGroupId, searchQuery, currentProject } = state;

    // 3. Calc Bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    // Filtered Nodes
    let exportNodes = filterNodes(nodes, searchQuery);
    if (activeGroupId !== null && activeGroupId !== undefined) {
      exportNodes = exportNodes.filter(n => n.groupId === activeGroupId);
    }

    exportNodes.forEach(n => {
      const x = n.x || 0, y = n.y || 0;
      const r = 20;
      minX = Math.min(minX, x - r);
      maxX = Math.max(maxX, x + r);
      minY = Math.min(minY, y - r);
      maxY = Math.max(maxY, y + r);
    });

    // Filtered Shapes
    let exportShapes = shapes;
    if (activeGroupId !== null && activeGroupId !== undefined) {
      exportShapes = exportShapes.filter(s => s.groupId === activeGroupId);
    }

    exportShapes.forEach(s => {
      try {
        const pts = typeof s.points === 'string' ? JSON.parse(s.points) : s.points;
        const padding = 5;
        pts.forEach((p: any) => {
          minX = Math.min(minX, p.x - padding);
          maxX = Math.max(maxX, p.x + padding);
          minY = Math.min(minY, p.y - padding);
          maxY = Math.max(maxY, p.y + padding);
        });
      } catch (e) { }
    });

    // 4. Apply Zoom to Fit
    if (minX !== Infinity) {
      const PADDING = 50;
      const rect = containerRef.current!.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width && height) {
        const contentW = maxX - minX;
        const contentH = maxY - minY;
        if (contentW > 0 && contentH > 0) {
          const kx = (width - PADDING * 2) / contentW;
          const ky = (height - PADDING * 2) / contentH;
          const k = Math.min(kx, ky, 2);
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;

          graphRef.current.zoom(k, 0);
          graphRef.current.centerAt(cx, cy, 0);
        }
      }
    }

    // Capture Screen Coords for Crop
    await new Promise(r => setTimeout(r, 100)); // Wait for render

    // We need to calculate screen bounds AFTER the zoom
    const tl = graphRef.current.graph2ScreenCoords(minX, minY);
    const tr = graphRef.current.graph2ScreenCoords(maxX, minY);
    const bl = graphRef.current.graph2ScreenCoords(minX, maxY);
    const br = graphRef.current.graph2ScreenCoords(maxX, maxY);

    // Find bounding box in screen pixels
    const screenMinX = Math.min(tl.x, tr.x, bl.x, br.x);
    const screenMaxX = Math.max(tl.x, tr.x, bl.x, br.x);
    const screenMinY = Math.min(tl.y, tr.y, bl.y, br.y);
    const screenMaxY = Math.max(tl.y, tr.y, bl.y, br.y);

    const dpr = window.devicePixelRatio || 1;
    const cropPadding = 20;

    const sx = (screenMinX - cropPadding) * dpr;
    const sy = (screenMinY - cropPadding) * dpr;
    const sw = (screenMaxX - screenMinX + cropPadding * 2) * dpr;
    const sh = (screenMaxY - screenMinY + cropPadding * 2) * dpr;

    // 5. Draw & Download
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sw;
    tempCanvas.height = sh;
    const ctx = tempCanvas.getContext('2d');

    const download = () => {
      const a = document.createElement('a');
      a.download = `nexus-graph-${currentProject?.name || 'export'}.${type}`;
      a.href = tempCanvas.toDataURL(`image/${type}`);
      a.click();

      // Restore
      graphRef.current.zoom(prevZoom, 0);
      graphRef.current.centerAt(prevCenter.x, prevCenter.y, 0);
    };

    if (ctx) {
      const drawGraph = () => {
        ctx.drawImage(graphCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
      };

      if (type === 'jpg') {
        const wallpaper = currentProject?.wallpaper;
        const drawBg = (color?: string | CanvasImageSource) => {
          if (typeof color === 'string') {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          } else if (color) {
            ctx.drawImage(color as CanvasImageSource, 0, 0, tempCanvas.width, tempCanvas.height);
          }
          drawGraph();
          download();
        };

        if (wallpaper) {
          if (wallpaper.startsWith('#')) {
            drawBg(wallpaper);
          } else {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => drawBg(img);
            img.onerror = () => drawBg('#09090b');
            img.src = wallpaper.startsWith('data:') ? wallpaper : `data:image/png;base64,${wallpaper}`;
          }
        } else {
          drawBg('#09090b');
        }
      } else {
        drawGraph();
        download();
      }
    } else {
      graphRef.current.zoom(prevZoom, 0);
      graphRef.current.centerAt(prevCenter.x, prevCenter.y, 0);
    }
  };

  useImperativeHandle(ref, () => ({
    exportToPNG: () => processExport('png'),
    exportToJPG: () => processExport('jpg'),
  }));

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
  const { showToast, showConfirmation } = useToast();
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
  const wasGlobalDragRef = useRef(false);

  const handleNodeClick = useCallback(
    (nodeObj: { id?: string | number; x?: number; y?: number }, event: MouseEvent) => {
      // Check drag state flags
      if (wasGlobalDragRef.current || isNodeDraggingRef.current || Date.now() - lastDragTimeRef.current < 300) return;

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

      const baseColor = node.customColor || groups.find(g => g.order === nodeGroup)?.color || groups[0]?.color || '#8B5CF6';
      const nodeRadius = isActive ? 8 : 6;
      const x = node.x || 0;
      const y = node.y || 0;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = '#355ea1';
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
    const baseColor = l.color || '#355ea1';

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
    synced: true,
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
      .catch(() => { });
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

          // If renaming, also update backend (skip default group 0)
          if (isColorName && g.name !== newName && g.id !== 0) {
            api.groups.update(g.id, { name: newName })
              .catch(() => { });
          }

          return { ...g, name: newName, order: i };
        });
        setGroups(groupsWithOrder);

        if (groupsWithOrder.length > 0) {
          setActiveGroupId(groupsWithOrder[0].id);
        }
      })
      .catch(() => { });
  }, [setGroups, setActiveGroupId]);

  // Update selected shapes when settings change
  useEffect(() => {
    if (selectedShapeIds.size > 0) {
      selectedShapeIds.forEach(id => {
        updateShape(id, { color: graphSettings.strokeColor });
        // API update
        const s = shapes.find(sh => sh.id === id);
        if (s && s.synced !== false) {
          api.drawings.update(id, { color: graphSettings.strokeColor });
        }
      });
    }
  }, [graphSettings.strokeColor]);

  useEffect(() => {
    if (selectedShapeIds.size > 0) {
      selectedShapeIds.forEach(id => {
        updateShape(id, { width: graphSettings.strokeWidth });
        const s = shapes.find(sh => sh.id === id);
        if (s && s.synced !== false) {
          api.drawings.update(id, { width: graphSettings.strokeWidth });
        }
      });
    }
  }, [graphSettings.strokeWidth]);

  useEffect(() => {
    if (selectedShapeIds.size > 0) {
      selectedShapeIds.forEach(id => {
        updateShape(id, { style: graphSettings.strokeStyle });
        const s = shapes.find(sh => sh.id === id);
        if (s && s.synced !== false) {
          api.drawings.update(id, { style: graphSettings.strokeStyle });
        }
      });
    }
  }, [graphSettings.strokeStyle]);

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
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);

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
        const z = graphRef.current.zoom() || 1;
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

  const [isNodeDragging, setIsNodeDragging] = useState(false);

  useEffect(() => {
    const isInteracting = isMarqueeSelecting || isDraggingSelection || isMiddleMousePanning || isNodeDragging || (activeResizeHandleRef.current !== null);
    if (isInteracting) {
      document.body.classList.add('graph-interacting');
    } else {
      document.body.classList.remove('graph-interacting');
    }
  }, [isMarqueeSelecting, isDraggingSelection, isMiddleMousePanning, isNodeDragging]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!containerRef.current?.contains(e.target as Node) || !graphRef.current) return;
      if ((e.target as HTMLElement).closest('.graph-ui-hide') || (e.target as HTMLElement).closest('button')) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = e.deltaY > 0 ? 0.88 : 1.12;
        const currentZoom = graphRef.current.zoom() || 1;
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
  // Filter shapes strictly by active group (match node filtering)
  const filteredShapes = useMemo(() => {
    if (activeGroupId === null || activeGroupId === undefined) {
      return shapes;
    }
    return shapes.filter(s => s.groupId === activeGroupId);
  }, [shapes, activeGroupId]);

  const editingShape = useMemo(() => {
    return editingShapeId ? shapes.find(s => s.id === editingShapeId) : null;
  }, [shapes, editingShapeId]);

  // On group load, delete any nodes/drawings with a groupId not in the current group list
  useEffect(() => {
    if (!groups || groups.length === 0) return;
    const validGroupIds = new Set(groups.map(g => g.id));
    // Remove nodes with invalid groupId
    const validNodes = nodes.filter(n => n.groupId === undefined || validGroupIds.has(n.groupId));
    if (validNodes.length !== nodes.length) {
      const toDelete = nodes.filter(n => n.groupId !== undefined && !validGroupIds.has(n.groupId));
      toDelete.forEach(n => {
        api.nodes.delete(n.id).catch(
          // err => console.error('Failed to delete node with invalid group:', err)
        );
      });
      useGraphStore.getState().setNodes(validNodes);
    }
    // Remove shapes with invalid groupId
    const validShapes = shapes.filter(s => s.groupId === undefined || validGroupIds.has(s.groupId));
    if (validShapes.length !== shapes.length) {
      const toDelete = shapes.filter(s => s.groupId !== undefined && !validGroupIds.has(s.groupId));
      toDelete.forEach(s => {
        api.drawings.delete(s.id).catch(
          // err => console.error('Failed to delete drawing with invalid group:', err)
        );
      });
      useGraphStore.getState().setShapes(validShapes);
    }
  }, [groups, nodes, shapes]);

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
      const z = graphRef.current.zoom() || 1;
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
              api.drawings.delete(s.id).catch(
                // err => console.error('Failed to delete drawing:', err)
              );
            });
            setSelectedShapeIds(new Set());
          }

          // Delete selected nodes
          if (hasSelectedNodes) {
            const deleteNode = useGraphStore.getState().deleteNode;
            selectedNodeIdsRefForDelete.current.forEach(nodeId => {
              deleteNode(nodeId);
              api.nodes.delete(nodeId).catch(
                // err => console.error('Failed to delete node:', err)
              );
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
    // 1. Middle Mouse Pan (High Priority)
    if (!isMiddleMousePanning && middleMouseStartRef.current) {
      const dx = e.clientX - middleMouseStartRef.current.x;
      const dy = e.clientY - middleMouseStartRef.current.y;
      if (dx * dx + dy * dy > 25) {
        setIsMiddleMousePanning(true);
      }
    }

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

    // 2. Resizing Logic
    if (isResizing && activeResizeHandleRef.current && resizeStartBoundsRef.current && resizeDragStartRef.current && originalShapeRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPoint = screenToWorld(screenX, screenY);

      let transformedShape;
      if (activeResizeHandleRef.current === 'rotate') {
        transformedShape = rotateShape(originalShapeRef.current, worldPoint, resizeDragStartRef.current, resizeStartBoundsRef.current);
      } else {
        transformedShape = resizeShape(originalShapeRef.current, activeResizeHandleRef.current, worldPoint, resizeDragStartRef.current, resizeStartBoundsRef.current);
      }
      shapesRef.current = shapesRef.current.map(s => s.id === transformedShape.id ? transformedShape : s);
      setResizeUpdateCounter(c => c + 1);
      return;
    }

    // 3. Manual Group Drag Logic (Nodes)
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

    // 4. Shape Selection Drag (Select Tool)
    if (isDraggingSelection && dragStartWorld && selectedShapeIds.size > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const worldPoint = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const dx = worldPoint.x - dragStartWorld.x;
      const dy = worldPoint.y - dragStartWorld.y;

      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        const updatedShapes = shapes.map(s => {
          if (selectedShapeIds.has(s.id)) {
            return { ...s, points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
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
              n.fx = newX; n.fy = newY; n.x = newX; n.y = newY;
            }
          });
        }
        setDragStartWorld(worldPoint);
      }
      return;
    }

    // 5. Marquee selection update
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

    // Hover Logic
    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorld(screenX, screenY);
    const scale = graphTransform.k || 1;

    // If dragging a node, do not interfere
    if (dragNodePrevRef.current) return;

    // Hover Resize Handle
    if (selectedShapeIds.size === 1 && !isDraggingSelection) {
      const selectedShape = filteredShapes.find(s => selectedShapeIds.has(s.id));
      if (selectedShape) {
        const bounds = getShapeBounds(selectedShape, scale);
        if (bounds) {
          const handle = getHandleAtPoint(worldPoint, bounds, scale);
          setHoveredResizeHandle(handle);
        } else { setHoveredResizeHandle(null); }
      }
    } else { setHoveredResizeHandle(null); }

    const isNear = filteredShapes.some(s => isPointNearShape(worldPoint, s, scale, 10));
    if (isNear !== isHoveringShape) {
      setIsHoveringShape(isNear);
    }
  }, [graphSettings.activeTool, graphTransform, filteredShapes, screenToWorld, isHoveringShape, isMarqueeSelecting, isMiddleMousePanning, isResizing, isDraggingSelection, dragStartWorld, selectedShapeIds, shapes, setShapes, selectedNodeIds, graphData]);



  const handleContainerMouseDownCapture = useCallback((e: React.MouseEvent) => {
    // Ignore clicks on UI elements
    const target = e.target as HTMLElement;
    if (target.closest('.graph-ui-hide') || target.closest('button') || target.closest('nav') || target.closest('header')) {
      return;
    }

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

    // Check if over a resize handle
    let isOverHandle = false;
    const currentSelectedIds = selectedShapeIdsRef.current;
    if (currentSelectedIds.size === 1) {
      const selectedShape = filteredShapes.find(s => currentSelectedIds.has(s.id));
      if (selectedShape) {
        const bounds = getShapeBounds(selectedShape, scale);
        if (bounds) {
          const handle = getHandleAtPoint(worldPoint, bounds, scale);
          if (handle) isOverHandle = true;
        }
      }
    }

    if (isOverShape || isOverHandle) return;

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



    // If we clicked on a node that is part of selection, start group drag
    // NOTE: Do NOT open editor here - wait for click handler to determine if it was a drag or click
    if (clickedNodeId && selectedNodeIds.has(clickedNodeId)) {
      lastHoveredNodeIdRef.current = clickedNodeId;
      lastNodeClickTimeRef.current = Date.now();

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

    // If we clicked on a node that is NOT in selection, select it
    // NOTE: Do NOT open editor here - wait for click handler to determine if it was a drag or click
    if (clickedNodeId && !selectedNodeIds.has(clickedNodeId)) {
      lastHoveredNodeIdRef.current = clickedNodeId;
      lastNodeClickTimeRef.current = Date.now();

      // Select the node
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

  const handleContainerMouseUpCapture = useCallback((e: React.MouseEvent) => {
    // 1. Pan End
    // 1. Pan End
    if (middleMouseStartRef.current) {
      setIsMiddleMousePanning(false);
      middleMouseStartRef.current = null;
    }

    // 2. Resize End
    if (isResizing && resizingShapeIdRef.current) {
      const finalShapes = shapesRef.current;
      setShapes(finalShapes);
      const resizedShape = finalShapes.find(s => s.id === resizingShapeIdRef.current);
      if (resizedShape && resizedShape.synced !== false) {
        api.drawings.update(resizedShape.id, { points: JSON.stringify(resizedShape.points) })
          .catch(
          // err => console.error('Failed to update drawing:', err)
        );
      }
      setIsResizing(false);
      activeResizeHandleRef.current = null;
      resizeStartBoundsRef.current = null;
      resizeDragStartRef.current = null;
      resizingShapeIdRef.current = null;
    }

    // 3. Shape Drag End (Selection)
    if (isDraggingSelection && selectedShapeIds.size > 0) {
      filteredShapes.filter(s => selectedShapeIds.has(s.id)).forEach(s => {
        if (s.synced !== false) {
          api.drawings.update(s.id, { points: JSON.stringify(s.points) })
            .catch(
            // err => console.error('Failed to update drawing:', err)
          );
        }
      });
      setIsDraggingSelection(false);
      setDragStartWorld(null);
    }

    // Check global drag distance to prevent click triggers
    if (dragStartPosRef.current) {
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        wasGlobalDragRef.current = true;
        // Clear the flag after a short delay to allow click handlers to read it
        setTimeout(() => { wasGlobalDragRef.current = false; }, 100);
      }
    }
    dragStartPosRef.current = null;

    // Finalize group drag
    if (dragGroupRef.current?.active) {
      const selectedShapeIds = selectedShapeIdsRef.current;
      if (selectedShapeIds.size > 0) {
        const finalShapes = shapesRef.current;
        setShapes(finalShapes);
        finalShapes.forEach(s => {
          if (selectedShapeIds.has(s.id) && s.synced !== false) {
            api.drawings.update(s.id, { points: JSON.stringify(s.points) })
              .catch(
              // err => console.error('Failed to update drawing:', err)
            );
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
  }, [setShapes, isMarqueeSelecting, marqueeStart, marqueeEnd, filteredShapes, isResizing, isDraggingSelection, selectedShapeIds]);

  // Handle node drag via ForceGraph - move other selected nodes along
  const handleNodeDrag = useCallback((node: any) => {
    isNodeDraggingRef.current = true;
    setIsNodeDragging(true);
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
      setIsNodeDragging(false);
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
              customColor: fullNode.customColor,
              group: fullNode.group ? { id: fullNode.group.id, name: fullNode.group.name, color: fullNode.group.color, order: fullNode.group.order } : { id: fullNode.groupId ?? 0, name: 'Default', color: '#808080', order: 0 },
              x: n.x,
              y: n.y
            }).catch(() => { });
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
              .catch(() => { });
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
          customColor: fullNode.customColor,
          group: fullNode.group ? { id: fullNode.group.id, name: fullNode.group.name, color: fullNode.group.color, order: fullNode.group.order } : { id: fullNode.groupId ?? 0, name: 'Default', color: '#808080', order: 0 },
          x: node.x,
          y: node.y
        }).catch(() => { });
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
          api.drawings.delete(s.id).catch(
            // err => console.error('Failed to delete drawing:', err)
          );
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
      synced: false,
    };

    addShape(newShape);

    if (currentProject?.id) {
      api.drawings.create(shapeToApiDrawing(newShape, currentProject.id, activeGroupId ?? undefined))
        .then(createdDrawing => {
          updateShape(newShape.id, { id: createdDrawing.id, synced: true });
          setSelectedShapeIds(prev => {
            const next = new Set(prev);
            if (next.has(newShape.id)) {
              next.delete(newShape.id);
              next.add(createdDrawing.id);
            }
            return next;
          });
        })
        .catch(
        // err => console.error('Failed to save drawing:', err)
      );
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoints([]);
    setSelectedShapeIds(new Set([newShape.id]));
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
      if (shape.id === editingShapeId) return;
      drawShapeOnContext(ctx, shape, globalScale);
      if (selectedShapeIds.has(shape.id)) {
        drawSelectionBox(ctx, shape, globalScale);

        if (selectedShapeIds.size === 1) {
          const bounds = getShapeBounds(shape, globalScale);
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
  }, [filteredShapes, isDrawing, currentPoints, graphSettings.activeTool, graphSettings.strokeColor, graphSettings.strokeWidth, graphSettings.strokeStyle, selectedShapeIds, isMarqueeSelecting, marqueeStart, marqueeEnd, isResizing, resizeUpdateCounter, drawPreview, currentProject?.id, shapeToApiDrawing, addShape, editingShapeId]);

  const handleSelectMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isSelectTool) return;
    if (isHoveringNode) return;

    if (e.button === 1) {
      e.preventDefault();
      // Only start tracking - don't enable pan mode until drag threshold met
      middleMouseStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button !== 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorld(screenX, screenY);
    const scale = graphRef.current?.zoom() || graphTransform.k || 1;

    const selectedIds = selectedShapeIdsRef.current;

    if (selectedIds.size === 1) {
      const selectedShape = filteredShapes.find(s => selectedIds.has(s.id));
      if (selectedShape) {
        const bounds = getShapeBounds(selectedShape, scale);
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
            <style>{`
              body.graph-interacting .graph-ui-hide {
                opacity: 0 !important;
                pointer-events: none !important;
                transition: opacity 0.2s;
              }
            `}</style>
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
                const scale = graphRef.current?.zoom() || graphTransform.k || 1;

                // Check if we clicked on an existing text shape
                const clickedTextShape = [...filteredShapes].reverse().find(s =>
                  s.type === 'text' && isPointNearShape(worldPoint, s, scale, 10)
                );

                if (clickedTextShape && graphRef.current) {
                  setEditingShapeId(clickedTextShape.id);
                  setTextInputValue(clickedTextShape.text || '');

                  // Position input at shape anchor
                  const screenPos = graphRef.current.graph2ScreenCoords(clickedTextShape.points[0].x, clickedTextShape.points[0].y);
                  setTextInputPos({
                    x: screenPos.x + rect.left,
                    y: screenPos.y + rect.top,
                    worldX: clickedTextShape.points[0].x,
                    worldY: clickedTextShape.points[0].y
                  });
                } else {
                  setEditingShapeId(null);
                  setTextInputPos({ x: e.clientX, y: e.clientY, worldX: worldPoint.x, worldY: worldPoint.y });
                  setTextInputValue('');
                }
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

                    if (editingShapeId) {
                      updateShape(editingShapeId, { text: textInputValue.trim() });
                      api.drawings.update(editingShapeId, { text: textInputValue.trim() })
                        .catch(() => { });
                    } else {
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
                          .catch(() => { });
                      }
                    }

                    setTextInputPos(null);
                    setTextInputValue('');
                    setEditingShapeId(null);
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
                    setEditingShapeId(null);
                  }
                }}
                onBlur={() => {
                  if (textInputValue.trim()) {
                    if (editingShapeId) {
                      updateShape(editingShapeId, { text: textInputValue.trim() });
                      api.drawings.update(editingShapeId, { text: textInputValue.trim() })
                        .catch(
                        // err => console.error('Failed to update drawing:', err)
                      );
                    } else {
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
                          .catch(
                          // err => console.error('Failed to create drawing:', err)
                        );
                      }
                    }
                  }
                  setTextInputPos(null);
                  setTextInputValue('');
                  setEditingShapeId(null);
                  setTimeout(() => {
                    if (graphRef.current) {
                      const z = graphRef.current.zoom();
                      graphRef.current.zoom(z * 1.00001, 0);
                      graphRef.current.zoom(z, 0);
                    }
                  }, 50);
                }}
                className="bg-transparent border-none outline-none text-white min-w-[100px] p-0 m-0"
                style={{
                  fontSize: ((editingShape?.fontSize || graphSettings.fontSize || 16) * (graphTransform.k || 1)),
                  fontFamily: editingShape?.fontFamily || graphSettings.fontFamily || 'Inter',
                  color: editingShape?.color || graphSettings.strokeColor,
                  lineHeight: 1.2,
                }}
                placeholder="Type here..."
              />
            </div>
          )}
          <div className="graph-ui-hide" onMouseDown={(e) => e.stopPropagation()}>
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
          </div>
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#265fbd]/30 border-t-[#265fbd]" />
            <span className="text-sm text-zinc-400">Loading graph...</span>
          </div>
        </div>
      )}


      <div className="graph-ui-hide" onMouseDown={(e) => e.stopPropagation()}>
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
              // console.error("Failed to create group:", err.message);
              showToast("Failed to create group. Please try again.", "error");
            }
          }}
          onRenameGroup={(id, newName) => {
            updateGroup(id, { name: newName });
            api.groups.update(id, { name: newName })
              .catch(
              // rr => console.warn("Backend sync failed (Rename Group):", err.message)
            );
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

            if (!await showConfirmation(message)) {
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
              .catch(
              // err => console.warn("Backend sync failed (Reorder Groups):", err.message)
            );
          }}
        />
      </div>

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
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-zinc-800/90 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-sm border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 transition-all graph-ui-hide"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Go back to content
        </button>
      )}

      <button
        onClick={() => setShowSelectionPane(!showSelectionPane)}
        onMouseDown={(e) => e.stopPropagation()}
        className={`absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-lg px-3 py-2 text-sm shadow-lg backdrop-blur-sm border transition-all graph-ui-hide ${showSelectionPane
          ? 'bg-zinc-700 text-white border-zinc-600'
          : 'bg-zinc-800/90 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white hover:border-zinc-600'
          }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Selection Pane
      </button>

      {/* Selection Pane */}
      {showSelectionPane && (
        <div className="graph-ui-hide" onMouseDown={(e) => e.stopPropagation()}>
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
            onLocateShape={(shapeId) => {
              const shape = shapes.find(s => s.id === shapeId);
              if (shape && graphRef.current) {
                // Approximate center of shape
                let cx = 0, cy = 0;
                shape.points.forEach(p => { cx += p.x; cy += p.y; });
                cx /= shape.points.length;
                cy /= shape.points.length;
                graphRef.current.centerAt(cx, cy, 500);
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
        </div>
      )}

      {selectedLink && (
        <div className="graph-ui-hide" onMouseDown={(e) => e.stopPropagation()}>
          <ConnectionProperties
            link={selectedLink}
            onClose={() => setSelectedLink(null)}
          />
        </div>
      )}
    </div>
  );
});

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
