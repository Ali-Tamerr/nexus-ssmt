export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  wallpaper?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  nodes?: Node[];
}

export interface Attachment {
  id: string;
  nodeId: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  fileSize: number;
  userId?: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  userId?: string;
  createdAt: string;
}

export interface Node {
  id: string;
  projectId?: string;
  title: string;
  content?: string;
  excerpt?: string;
  groupId: number;
  customColor?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  x?: number;
  y?: number;
  tags?: Tag[];
  attachments?: Attachment[];
}

export interface Link {
  id: string;
  sourceId: string;
  targetId: string;
  color: string;
  description?: string;
  userId?: string;
  createdAt?: string;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

export type DrawingTool = 
  | 'pan' 
  | 'select' 
  | 'rectangle' 
  | 'diamond' 
  | 'circle' 
  | 'arrow' 
  | 'line' 
  | 'pen' 
  | 'text' 
  | 'eraser';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export interface DrawnShape {
  id: string;
  type: DrawingTool;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  style: StrokeStyle;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  groupId?: number;
}

export interface GraphSettings {
  isPreviewMode: boolean;
  lockAllMovement: boolean;
  activeTool: DrawingTool;
  strokeWidth: number;
  strokeColor: string;
  strokeStyle: StrokeStyle;
  fontSize: number;
  fontFamily: string;
}

export interface PresenceState {
  sessionId: string;
  nodeId: string;
  userId: string;
  lastSeen: string;
}

export interface Profile {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterRequest {
  email: string;
  displayName?: string;
  avatarUrl?: string;
  password: string;
}

export { GROUP_COLORS, BRAND_COLOR, NODE_COLORS, COLOR_PALETTE } from '@/lib/constants';
