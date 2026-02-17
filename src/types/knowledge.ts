export interface Project {
  id: number;
  name: string;
  description?: string;
  color?: string;
  wallpaper?: string | null;
  userId: string; // UUID from auth.users.id
  createdAt: string;
  updatedAt: string;
  nodes?: Node[];
}

export interface Attachment {
  id: number;
  nodeId: number;
  fileName: string;
  fileUrl: string;
  // Extra fields that might come from joins or logical extensions, keeping them optional if unsure
  contentType?: string;
  fileSize?: number;
  createdAt?: string;
}

export interface Tag {
  id: number;
  name: string;
  color?: string;
  userId?: string;
  createdAt: string;
  nodes?: Node[];
}

export interface Group {
  id: number;
  name: string;
  color: string;
  order: number;
  nodes?: Node[];
}

export interface Node {
  id: number;
  title: string;
  content?: string | null;
  groupId: number; // Required in API
  projectId?: number | null;
  userId?: string | null;
  x?: number | null;
  y?: number | null;
  customColor?: string | null;
  createdAt: string;
  updatedAt: string;

  // Relations
  group?: Group;
  project?: Project;
  tags?: Tag[];
  linkSources?: Link[];
  linkTargets?: Link[];
  attachments?: Attachment[];
}

export interface Link {
  id: number;
  sourceId: number;
  targetId: number;
  color: string;
  description?: string | null;
  userId?: string | null;
  createdAt: string;
  source?: Node;
  target?: Node;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

export type DrawingTool =
  | "pan"
  | "select"
  | "rectangle"
  | "diamond"
  | "circle"
  | "arrow"
  | "line"
  | "pen"
  | "text"
  | "eraser";

export type StrokeStyle = "solid" | "dashed" | "dotted";

export interface DrawnShape {
  id: number; // API uses int. Frontend temp IDs might need management elsewhere.
  projectId: number;
  type: DrawingTool; // API uses string, but constrained to tool types
  points: { x: number; y: number }[];
  color: string;
  width: number;
  style: StrokeStyle;
  text?: string | null;
  fontSize?: number | null;
  fontFamily?: string | null;
  groupId?: number | null;
  synced?: boolean; // Frontend only
  createdAt?: string;
  updatedAt?: string;
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
  nodeId: number;
  userId: string;
  lastSeen: string;
}

export interface Profile {
  id: string; // UUID
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  passwordHash?: string; // Should not be exposed ideally
  provider?: string; // 'email' | 'google'
}

export interface RegisterRequest {
  email: string;
  displayName?: string;
  avatarUrl?: string;
  password: string;
  provider?: string;
}

export interface ProjectCollection {
  id: number;
  name: string;
  description?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  owner?: Profile;
  items?: ProjectCollectionItem[];
  // Helper for frontend convenience, populated from items
  projects?: Project[];
  projectIds?: number[];
}

export interface ProjectCollectionItem {
  collectionId: number;
  projectId: number;
  order: number;
  project?: Project;
}

export {
  GROUP_COLORS,
  BRAND_COLOR,
  NODE_COLORS,
  COLOR_PALETTE,
} from "@/lib/constants";
