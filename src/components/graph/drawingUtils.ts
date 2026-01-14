'use client';

import { DrawingTool, StrokeStyle, DrawnShape } from '@/types/knowledge';

export function drawShapeOnContext(
    ctx: CanvasRenderingContext2D, 
    shape: DrawnShape, 
    globalScale: number,
    isPreview = false
) {
    ctx.save();
    
    if (isPreview) {
        ctx.globalAlpha = 0.3;
    }
    
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = 'transparent';
    ctx.lineWidth = shape.width / globalScale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (shape.style) {
        case 'dashed':
            ctx.setLineDash([10 / globalScale, 5 / globalScale]);
            break;
        case 'dotted':
            ctx.setLineDash([2 / globalScale, 4 / globalScale]);
            break;
        default:
            ctx.setLineDash([]);
    }

    const points = shape.points;
    if (points.length < 2 && shape.type !== 'pen' && shape.type !== 'text') {
        ctx.restore();
        return;
    }

    ctx.beginPath();

    switch (shape.type) {
        case 'pen':
            if (points.length === 0) break;
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            break;

        case 'line':
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.stroke();
            break;

        case 'arrow':
            const [start, end] = [points[0], points[1]];
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const headLen = 15 / globalScale;

            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(
                end.x - headLen * Math.cos(angle - Math.PI / 6),
                end.y - headLen * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(
                end.x - headLen * Math.cos(angle + Math.PI / 6),
                end.y - headLen * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
            break;

        case 'rectangle':
            const rectWidth = points[1].x - points[0].x;
            const rectHeight = points[1].y - points[0].y;
            ctx.strokeRect(points[0].x, points[0].y, rectWidth, rectHeight);
            break;

        case 'circle':
            const radiusX = Math.abs(points[1].x - points[0].x) / 2;
            const radiusY = Math.abs(points[1].y - points[0].y) / 2;
            const centerX = points[0].x + (points[1].x - points[0].x) / 2;
            const centerY = points[0].y + (points[1].y - points[0].y) / 2;
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
            ctx.stroke();
            break;

        case 'diamond':
            const midX = (points[0].x + points[1].x) / 2;
            const midY = (points[0].y + points[1].y) / 2;

            ctx.moveTo(midX, points[0].y);
            ctx.lineTo(points[1].x, midY);
            ctx.lineTo(midX, points[1].y);
            ctx.lineTo(points[0].x, midY);
            ctx.closePath();
            ctx.stroke();
            break;

        case 'text':
            if (shape.text && points.length > 0) {
                const fontSize = (shape.fontSize || 16) / globalScale;
                ctx.font = `${fontSize}px ${shape.fontFamily || 'Inter'}, sans-serif`;
                ctx.fillStyle = shape.color;
                ctx.textBaseline = 'top';
                ctx.fillText(shape.text, points[0].x, points[0].y);
            }
            break;
    }

    ctx.restore();
}

function distanceToSegment(p: {x: number, y: number}, a: {x: number, y: number}, b: {x: number, y: number}) {
    const l2 = (a.x - b.x)**2 + (a.y - b.y)**2;
    if (l2 === 0) return Math.sqrt((p.x - a.x)**2 + (p.y - a.y)**2);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    return Math.sqrt((p.x - proj.x)**2 + (p.y - proj.y)**2);
}

export function isPointNearShape(point: {x: number, y: number}, shape: DrawnShape, globalScale = 1, tolerance = 25): boolean {
    const { type, points } = shape;
    if (!points || points.length === 0) return false;

    const margin = tolerance / globalScale;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    }

    minX -= margin;
    maxX += margin;
    minY -= margin;
    maxY += margin;

    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

export function getShapeBounds(shape: DrawnShape): { minX: number; maxX: number; minY: number; maxY: number } | null {
    const { points } = shape;
    if (!points || points.length === 0) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    }

    return { minX, maxX, minY, maxY };
}

export function drawSelectionBox(ctx: CanvasRenderingContext2D, shape: DrawnShape, globalScale: number) {
    const bounds = getShapeBounds(shape);
    if (!bounds) return;

    const padding = 5 / globalScale;
    const { minX, maxX, minY, maxY } = bounds;

    ctx.save();
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2 / globalScale;
    ctx.setLineDash([5 / globalScale, 3 / globalScale]);
    ctx.strokeRect(minX - padding, minY - padding, maxX - minX + padding * 2, maxY - minY + padding * 2);
    
    const handleSize = 8 / globalScale;
    ctx.fillStyle = '#3B82F6';
    ctx.setLineDash([]);
    
    const corners = [
        { x: minX - padding, y: minY - padding },
        { x: maxX + padding, y: minY - padding },
        { x: minX - padding, y: maxY + padding },
        { x: maxX + padding, y: maxY + padding },
    ];
    
    for (const corner of corners) {
        ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
    }
    
    ctx.restore();
}

export function isShapeInMarquee(
    shape: DrawnShape, 
    marqueeStart: { x: number; y: number }, 
    marqueeEnd: { x: number; y: number }
): boolean {
    const bounds = getShapeBounds(shape);
    if (!bounds) return false;

    const minMarqueeX = Math.min(marqueeStart.x, marqueeEnd.x);
    const maxMarqueeX = Math.max(marqueeStart.x, marqueeEnd.x);
    const minMarqueeY = Math.min(marqueeStart.y, marqueeEnd.y);
    const maxMarqueeY = Math.max(marqueeStart.y, marqueeEnd.y);

    return bounds.minX >= minMarqueeX && bounds.maxX <= maxMarqueeX &&
           bounds.minY >= minMarqueeY && bounds.maxY <= maxMarqueeY;
}

export function drawMarquee(
    ctx: CanvasRenderingContext2D, 
    start: { x: number; y: number }, 
    end: { x: number; y: number },
    globalScale: number
) {
    ctx.save();
    ctx.strokeStyle = '#3B82F6';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.lineWidth = 1 / globalScale;
    ctx.setLineDash([5 / globalScale, 3 / globalScale]);
    
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
}
