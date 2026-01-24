import { DrawnShape } from '@/types/knowledge';

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'rotate';

export interface ShapeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

// Helper for text measurement
const tempCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;

export function getShapeBounds(shape: DrawnShape, globalScale: number = 1): ShapeBounds | null {
  if (shape.points.length === 0) return null;

  if (shape.type === 'text' && shape.text) {
    const fontSize = (shape.fontSize || 16) / globalScale;
    let textWidth = shape.text.length * fontSize * 0.6; // Fallback
    const textHeight = fontSize * 1.2;

    if (tempCtx) {
        tempCtx.font = `${fontSize}px ${shape.fontFamily || 'Inter'}, sans-serif`;
        const metrics = tempCtx.measureText(shape.text);
        textWidth = metrics.width;
    }
    
    const angle = shape.points.length >= 2 
      ? Math.atan2(shape.points[1].y - shape.points[0].y, shape.points[1].x - shape.points[0].x)
      : 0;

    const p0 = shape.points[0];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Calculate vectors for width and height edges
    // Width vector
    const wx = textWidth * cos;
    const wy = textWidth * sin;
    // Height vector (rotated 90 degrees clockwise)
    const hx = -textHeight * sin;
    const hy = textHeight * cos;

    // Calculate 4 corners
    const x1 = p0.x;
    const y1 = p0.y;
    const x2 = p0.x + wx;
    const y2 = p0.y + wy;
    const x3 = p0.x + wx + hx;
    const y3 = p0.y + wy + hy;
    const x4 = p0.x + hx;
    const y4 = p0.y + hy;

    const xs = [x1, x2, x3, x4];
    const ys = [y1, y2, y3, y4];

    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }

  const xs = shape.points.map(p => p.x);
  const ys = shape.points.map(p => p.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getResizeHandlePosition(
  bounds: ShapeBounds,
  handle: ResizeHandle,
  globalScale: number = 1
): { x: number; y: number } {
  const { minX, minY, maxX, maxY, width, height } = bounds;
  const padding = 5 / globalScale;
  
  switch (handle) {
    case 'nw': return { x: minX - padding, y: minY - padding };
    case 'ne': return { x: maxX + padding, y: minY - padding };
    case 'sw': return { x: minX - padding, y: maxY + padding };
    case 'se': return { x: maxX + padding, y: maxY + padding };
    case 'n': return { x: minX + width / 2, y: minY - padding };
    case 's': return { x: minX + width / 2, y: maxY + padding };
    case 'e': return { x: maxX + padding, y: minY + height / 2 };
    case 'w': return { x: minX - padding, y: minY + height / 2 };
    case 'rotate': return { x: minX + width / 2, y: minY - padding - 25 / globalScale };
  }
}

export function drawResizeHandles(
  ctx: CanvasRenderingContext2D,
  bounds: ShapeBounds,
  globalScale: number
) {
  ctx.save();
  
  const handleRadius = 4 / globalScale;
  const handles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
  
  handles.forEach(handle => {
    const pos = getResizeHandlePosition(bounds, handle, globalScale);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, handleRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#0D99FF';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();
  });
  
  ctx.restore();
}

export function getHandleAtPoint(
  point: { x: number; y: number },
  bounds: ShapeBounds,
  globalScale: number
): ResizeHandle | null {
  const handles: ResizeHandle[] = ['rotate', 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
  
  for (const handle of handles) {
    const pos = getResizeHandlePosition(bounds, handle, globalScale);
    const dx = point.x - pos.x;
    const dy = point.y - pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check radius based on handle type
    const threshold = handle === 'rotate' ? 30 / globalScale : 10 / globalScale;
    
    if (distance <= threshold) {
      return handle;
    }
  }
  
  return null;
}

export function resizeShape(
  shape: DrawnShape,
  handle: ResizeHandle,
  currentPoint: { x: number; y: number },
  startPoint: { x: number; y: number },
  startBounds: ShapeBounds
): DrawnShape {
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;
  
  let newMinX = startBounds.minX;
  let newMinY = startBounds.minY;
  let newMaxX = startBounds.maxX;
  let newMaxY = startBounds.maxY;
  
  switch (handle) {
    case 'se':
      newMaxX = startBounds.maxX + dx;
      newMaxY = startBounds.maxY + dy;
      break;
    case 'sw':
      newMinX = startBounds.minX + dx;
      newMaxY = startBounds.maxY + dy;
      break;
    case 'ne':
      newMaxX = startBounds.maxX + dx;
      newMinY = startBounds.minY + dy;
      break;
    case 'nw':
      newMinX = startBounds.minX + dx;
      newMinY = startBounds.minY + dy;
      break;
    case 'e':
      newMaxX = startBounds.maxX + dx;
      break;
    case 'w':
      newMinX = startBounds.minX + dx;
      break;
    case 's':
      newMaxY = startBounds.maxY + dy;
      break;
    case 'n':
      newMinY = startBounds.minY + dy;
      break;
  }
  
  const MIN_SIZE = 20;
  if (newMaxX - newMinX < MIN_SIZE) {
    if (handle.includes('e')) {
      newMaxX = newMinX + MIN_SIZE;
    } else if (handle.includes('w')) {
      newMinX = newMaxX - MIN_SIZE;
    }
  }
  
  if (newMaxY - newMinY < MIN_SIZE) {
    if (handle.includes('s')) {
      newMaxY = newMinY + MIN_SIZE;
    } else if (handle.includes('n')) {
      newMinY = newMaxY - MIN_SIZE;
    }
  }
  
  const newPoints = shape.points.map(p => {
    const relX = startBounds.width > 0 ? (p.x - startBounds.minX) / startBounds.width : 0.5;
    const relY = startBounds.height > 0 ? (p.y - startBounds.minY) / startBounds.height : 0.5;
    return {
      x: newMinX + relX * (newMaxX - newMinX),
      y: newMinY + relY * (newMaxY - newMinY),
    };
  });
  
  return {
    ...shape,
    points: newPoints,
  };
}

export function rotateShape(
  shape: DrawnShape,
  currentPoint: { x: number; y: number },
  startPoint: { x: number; y: number },
  bounds: ShapeBounds
): DrawnShape {
  const centerX = bounds.minX + bounds.width / 2;
  const centerY = bounds.minY + bounds.height / 2;
  
  const startAngle = Math.atan2(startPoint.y - centerY, startPoint.x - centerX);
  const currentAngle = Math.atan2(currentPoint.y - centerY, currentPoint.x - centerX);
  const deltaAngle = currentAngle - startAngle;
  
  // If text has only 1 point, upgrade it to 2 points to support rotation
  let pointsToRotate = shape.points;
  if (shape.type === 'text' && shape.points.length === 1) {
    pointsToRotate = [
      shape.points[0],
      { x: shape.points[0].x + 10, y: shape.points[0].y } // Initial horizontal vector
    ];
  } else if (shape.type === 'rectangle' && shape.points.length === 2) {
    // Upgrade 2-point axis-aligned rect to 4-point polygon
    const p0 = shape.points[0];
    const p1 = shape.points[1];
    pointsToRotate = [
       { x: p0.x, y: p0.y },
       { x: p1.x, y: p0.y },
       { x: p1.x, y: p1.y },
       { x: p0.x, y: p1.y }
    ];
  }

  const newPoints = pointsToRotate.map(p => {
    const dx = p.x - centerX;
    const dy = p.y - centerY;
    const cos = Math.cos(deltaAngle);
    const sin = Math.sin(deltaAngle);
    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos,
    };
  });
  
  return {
    ...shape,
    points: newPoints,
  };
}

export function getCursorForHandle(handle: ResizeHandle | null): string {
  if (!handle) return 'default';
  
  switch (handle) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'rotate':
      return 'grab';
    default:
      return 'default';
  }
}
