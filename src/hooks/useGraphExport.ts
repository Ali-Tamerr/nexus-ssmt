import { useCallback } from 'react';
import { filterNodes } from '@/store/useGraphStore';
import { Node, DrawnShape } from '@/types/knowledge';

export function useGraphExport(
    containerRef: React.RefObject<HTMLDivElement | null>,
    graphRef: React.RefObject<any>,
    nodes: Node[],
    shapes: DrawnShape[],
    searchQuery: string,
    projectName: string
) {
    const processExport = useCallback(async (type: 'png' | 'jpg') => {
        const graphCanvas = containerRef.current?.querySelector('canvas');
        if (!graphCanvas || !graphRef.current) return;

        // 1. Save View
        const prevZoom = graphRef.current.zoom() || 1;
        const prevCenter = graphRef.current.centerAt() || { x: 0, y: 0 };

        // 3. Calc Bounds
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        // Filtered Nodes
        let exportNodes = filterNodes(nodes, searchQuery);

        exportNodes.forEach(n => {
            const x = n.x || 0, y = n.y || 0;
            const r = 20;
            minX = Math.min(minX, x - r);
            maxX = Math.max(maxX, x + r);
            minY = Math.min(minY, y - r);
            maxY = Math.max(maxY, y + r);
        });

        // Filtered Shapes
        shapes.forEach(s => {
            try {
                const pts = s.points;
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
            a.download = `nexus-graph-${projectName || 'export'}.${type}`;
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
                ctx.fillStyle = '#09090b';
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                drawGraph();
                download();
            } else {
                drawGraph();
                download();
            }
        } else {
            graphRef.current.zoom(prevZoom, 0);
            graphRef.current.centerAt(prevCenter.x, prevCenter.y, 0);
        }
    }, [containerRef, graphRef, nodes, shapes, searchQuery, projectName]);

    return {
        exportToPNG: () => processExport('png'),
        exportToJPG: () => processExport('jpg')
    };
}
