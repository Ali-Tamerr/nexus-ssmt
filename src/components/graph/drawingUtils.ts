'use client';

import { DrawingTool, StrokeStyle, DrawnShape } from '@/types/knowledge';
import { getShapeBounds } from './resizeUtils';

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
            if (points.length > 2) {
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.closePath();
                ctx.stroke();
            } else {
                const rectWidth = points[1].x - points[0].x;
                const rectHeight = points[1].y - points[0].y;
                ctx.strokeRect(points[0].x, points[0].y, rectWidth, rectHeight);
            }
            break;

        case 'circle':
            if (points.length > 2) {
                // Rotated ellipse (4 cardinal points: Top, Right, Bottom, Left)
                const p0 = points[0]; // Top
                const p1 = points[1]; // Right
                const p2 = points[2]; // Bottom
                
                // Center is midpoint of Top/Bottom
                const centerX = (p0.x + p2.x) / 2;
                const centerY = (p0.y + p2.y) / 2;

                // Radius X (Center -> Right)
                const dx = p1.x - centerX;
                const dy = p1.y - centerY;
                const radiusX = Math.sqrt(dx * dx + dy * dy);

                // Radius Y (Center -> Top)
                const hx = p0.x - centerX;
                const hy = p0.y - centerY;
                const radiusY = Math.sqrt(hx * hx + hy * hy);

                const rotation = Math.atan2(dy, dx);

                ctx.ellipse(centerX, centerY, radiusX, radiusY, rotation, 0, 2 * Math.PI);
                ctx.stroke();
            } else {
                const radiusX = Math.abs(points[1].x - points[0].x) / 2;
                const radiusY = Math.abs(points[1].y - points[0].y) / 2;
                const centerX = points[0].x + (points[1].x - points[0].x) / 2;
                const centerY = points[0].y + (points[1].y - points[0].y) / 2;
                ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                ctx.stroke();
            }
            break;

        case 'diamond':
            if (points.length > 2) {
                // Rotated diamond (connect cardinal points directly)
                ctx.moveTo(points[0].x, points[0].y);
                ctx.lineTo(points[1].x, points[1].y);
                ctx.lineTo(points[2].x, points[2].y);
                ctx.lineTo(points[3].x, points[3].y);
                ctx.closePath();
                ctx.stroke();
            } else {
                const midX = (points[0].x + points[1].x) / 2;
                const midY = (points[0].y + points[1].y) / 2;

                ctx.moveTo(midX, points[0].y);
                ctx.lineTo(points[1].x, midY);
                ctx.lineTo(midX, points[1].y);
                ctx.lineTo(points[0].x, midY);
                ctx.closePath();
                ctx.stroke();
            }
            break;

        case 'text':
            if (shape.text && points.length > 0) {
                const fontSize = shape.fontSize || 16;
                ctx.font = `${fontSize}px ${shape.fontFamily || 'Inter'}, sans-serif`;
                ctx.fillStyle = shape.color;
                ctx.textBaseline = 'top';
                ctx.textAlign = 'left';
                
                if (points.length >= 2) {
                    const angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
                    ctx.save();
                    ctx.translate(points[0].x, points[0].y);
                    ctx.rotate(angle);
                    ctx.fillText(shape.text, 0, 0);
                    ctx.restore();
                } else {
                    ctx.fillText(shape.text, points[0].x, points[0].y);
                }
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
    const bounds = getShapeBounds(shape, globalScale);
    if (!bounds) return false;

    const margin = tolerance / globalScale;

    return point.x >= bounds.minX - margin && 
           point.x <= bounds.maxX + margin && 
           point.y >= bounds.minY - margin && 
           point.y <= bounds.maxY + margin;
}



export function drawSelectionBox(ctx: CanvasRenderingContext2D, shape: DrawnShape, globalScale: number) {
    const bounds = getShapeBounds(shape, globalScale);
    if (!bounds) return;

    const padding = 5 / globalScale;
    const { minX, maxX, minY, maxY } = bounds;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    ctx.save();
    
    ctx.strokeStyle = '#0D99FF';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.setLineDash([]);
    ctx.strokeRect(minX - padding, minY - padding, width, height);

    const rotationHandleY = minY - padding - 25 / globalScale;
    const centerX = minX - padding + width / 2;
    
    ctx.beginPath();
    ctx.moveTo(centerX, minY - padding);
    ctx.lineTo(centerX, rotationHandleY + 8 / globalScale);
    ctx.strokeStyle = '#0D99FF';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(centerX, rotationHandleY, 8 / globalScale, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#0D99FF';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(centerX, rotationHandleY, 3 / globalScale, -Math.PI * 0.7, Math.PI * 0.3);
    ctx.strokeStyle = '#0D99FF';
    ctx.lineWidth = 1 / globalScale;
    ctx.stroke();
    
    const arrowSize = 2 / globalScale;
    const arrowAngle = Math.PI * 0.3;
    const arrowX = centerX + 3 / globalScale * Math.cos(arrowAngle);
    const arrowY = rotationHandleY + 3 / globalScale * Math.sin(arrowAngle);
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX + arrowSize, arrowY - arrowSize);
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX + arrowSize, arrowY + arrowSize);
    ctx.stroke();
    
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
    ctx.strokeStyle = '#355ea1';
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
