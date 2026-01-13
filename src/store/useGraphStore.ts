import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, Node, Link, GraphData, GraphSettings, Tag, Attachment, DrawnShape } from '@/types/knowledge';

interface AppState {
  projects: Project[];
  currentProject: Project | null;
  nodes: Node[];
  links: Link[];
  tags: Tag[];
  activeNode: Node | null;
  hoveredNode: Node | null;
  searchQuery: string;
  isEditorOpen: boolean;
  isCommandPaletteOpen: boolean;
  isCreateProjectOpen: boolean;
  isLoading: boolean;
  graphSettings: GraphSettings;
  currentUserId: string | null;
  hasHydrated: boolean;
  
  // Drawing state
  shapes: DrawnShape[];
  undoStack: DrawnShape[][];
  redoStack: DrawnShape[][];

  setHasHydrated: (hydrated: boolean) => void;
  setCurrentUserId: (userId: string | null) => void;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (project: Project | null) => void;
  
  // Drawing actions
  setShapes: (shapes: DrawnShape[]) => void;
  addShape: (shape: DrawnShape) => void;
  updateShape: (id: string, updates: Partial<DrawnShape>) => void;
  undo: () => void;
  redo: () => void;
  clearShapes: () => void;
  pushToUndoStack: (shapes: DrawnShape[]) => void;
  
  setNodes: (nodes: Node[]) => void;
  setLinks: (links: Link[]) => void;
  setTags: (tags: Tag[]) => void;
  setGraphData: (data: GraphData) => void;
  addNode: (node: Node) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  deleteNode: (id: string) => void;
  addLink: (link: Link) => void;
  deleteLink: (id: string) => void;
  addTagToNode: (nodeId: string, tag: Tag) => void;
  removeTagFromNode: (nodeId: string, tagId: string) => void;
  addAttachmentToNode: (nodeId: string, attachment: Attachment) => void;
  removeAttachmentFromNode: (nodeId: string, attachmentId: string) => void;
  setActiveNode: (node: Node | null) => void;
  setHoveredNode: (node: Node | null) => void;
  setSearchQuery: (query: string) => void;
  toggleEditor: (open?: boolean) => void;
  toggleCommandPalette: (open?: boolean) => void;
  toggleCreateProject: (open?: boolean) => void;
  setLoading: (loading: boolean) => void;
  setGraphSettings: (settings: Partial<GraphSettings>) => void;
}

export const useGraphStore = create<AppState>()(
  persist(
    (set) => ({
      projects: [],
      currentProject: null,
      nodes: [],
      links: [],
      tags: [],
      activeNode: null,
      hoveredNode: null,
      searchQuery: '',
      isEditorOpen: false,
      isCommandPaletteOpen: false,
      isCreateProjectOpen: false,
      isLoading: false,
      graphSettings: {
        isPreviewMode: false,
        lockAllMovement: false,
        activeTool: 'select',
        strokeWidth: 2,
        strokeColor: '#3B82F6',
        strokeStyle: 'solid',
        fontSize: 16,
        fontFamily: 'Inter',
      },
      currentUserId: null,
      hasHydrated: false,

      // Drawing state
      shapes: [],
      undoStack: [],
      redoStack: [],

      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),

  setCurrentUserId: (userId) => set({ currentUserId: userId }),
  setProjects: (projects) => set({ projects }),
  
  addProject: (project) => set((state) => ({ 
    projects: [...state.projects, project] 
  })),
  
  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map((p) => 
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    ),
    currentProject: state.currentProject?.id === id 
      ? { ...state.currentProject, ...updates, updatedAt: new Date().toISOString() } 
      : state.currentProject
  })),
  
  deleteProject: (id) => set((state) => ({
    projects: state.projects.filter((p) => p.id !== id),
    currentProject: state.currentProject?.id === id ? null : state.currentProject,
    nodes: state.currentProject?.id === id ? [] : state.nodes,
    links: state.currentProject?.id === id ? [] : state.links,
  })),
  
  setCurrentProject: (project) => set({ 
    currentProject: project,
    nodes: [],
    links: [],
    activeNode: null,
  }),

  setNodes: (nodes) => set({ nodes }),
  setLinks: (links) => set({ links }),
  setTags: (tags) => set({ tags }),
  setGraphData: (data) => set({ nodes: data.nodes, links: data.links }),
  
  addNode: (node) => set((state) => ({ 
    nodes: [...state.nodes, node] 
  })),
  
  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map((n) => 
      n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    ),
    activeNode: state.activeNode?.id === id 
      ? { ...state.activeNode, ...updates, updatedAt: new Date().toISOString() } 
      : state.activeNode
  })),
  
  deleteNode: (id) => set((state) => ({
    nodes: state.nodes.filter((n) => n.id !== id),
    links: state.links.filter((l) => l.sourceId !== id && l.targetId !== id),
    activeNode: state.activeNode?.id === id ? null : state.activeNode
  })),
  
  addLink: (link) => set((state) => ({ 
    links: [...state.links, link] 
  })),
  
  deleteLink: (id) => set((state) => ({
    links: state.links.filter((l) => l.id !== id)
  })),

  addTagToNode: (nodeId, tag) => set((state) => ({
    nodes: state.nodes.map((n) => 
      n.id === nodeId 
        ? { ...n, tags: [...(n.tags || []), tag] }
        : n
    ),
    activeNode: state.activeNode?.id === nodeId
      ? { ...state.activeNode, tags: [...(state.activeNode.tags || []), tag] }
      : state.activeNode
  })),

  removeTagFromNode: (nodeId, tagId) => set((state) => ({
    nodes: state.nodes.map((n) => 
      n.id === nodeId 
        ? { ...n, tags: (n.tags || []).filter((t) => t.id !== tagId) }
        : n
    ),
    activeNode: state.activeNode?.id === nodeId
      ? { ...state.activeNode, tags: (state.activeNode.tags || []).filter((t) => t.id !== tagId) }
      : state.activeNode
  })),

  addAttachmentToNode: (nodeId, attachment) => set((state) => ({
    nodes: state.nodes.map((n) => 
      n.id === nodeId 
        ? { ...n, attachments: [...(n.attachments || []), attachment] }
        : n
    ),
    activeNode: state.activeNode?.id === nodeId
      ? { ...state.activeNode, attachments: [...(state.activeNode.attachments || []), attachment] }
      : state.activeNode
  })),

  removeAttachmentFromNode: (nodeId, attachmentId) => set((state) => ({
    nodes: state.nodes.map((n) => 
      n.id === nodeId 
        ? { ...n, attachments: (n.attachments || []).filter((a) => a.id !== attachmentId) }
        : n
    ),
    activeNode: state.activeNode?.id === nodeId
      ? { ...state.activeNode, attachments: (state.activeNode.attachments || []).filter((a) => a.id !== attachmentId) }
      : state.activeNode
  })),
  
  setActiveNode: (node) => set({ activeNode: node, isEditorOpen: node !== null }),
  setHoveredNode: (node) => set({ hoveredNode: node }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleEditor: (open) => set((state) => ({ 
    isEditorOpen: open ?? !state.isEditorOpen 
  })),
  toggleCommandPalette: (open) => set((state) => ({ 
    isCommandPaletteOpen: open ?? !state.isCommandPaletteOpen 
  })),
  toggleCreateProject: (open) => set((state) => ({ 
    isCreateProjectOpen: open ?? !state.isCreateProjectOpen 
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  setGraphSettings: (settings) => set((state) => ({
    graphSettings: { ...state.graphSettings, ...settings }
  })),

  // Drawing actions
  setShapes: (shapes) => set({ shapes }),
  
  pushToUndoStack: (shapes) => set((state) => ({
    undoStack: [...state.undoStack, shapes],
    redoStack: [],
  })),
  
  addShape: (shape) => set((state) => ({
    undoStack: [...state.undoStack, state.shapes],
    redoStack: [],
    shapes: [...state.shapes, shape],
  })),

  updateShape: (id, updates) => set((state) => ({
    shapes: state.shapes.map(s => s.id === id ? { ...s, ...updates } : s),
  })),
  
  undo: () => set((state) => {
    if (state.undoStack.length === 0) return state;
    const prevState = state.undoStack[state.undoStack.length - 1];
    return {
      redoStack: [...state.redoStack, state.shapes],
      shapes: prevState,
      undoStack: state.undoStack.slice(0, -1),
    };
  }),
  
  redo: () => set((state) => {
    if (state.redoStack.length === 0) return state;
    const nextState = state.redoStack[state.redoStack.length - 1];
    return {
      undoStack: [...state.undoStack, state.shapes],
      shapes: nextState,
      redoStack: state.redoStack.slice(0, -1),
    };
  }),
  
  clearShapes: () => set((state) => ({
    undoStack: [...state.undoStack, state.shapes],
    redoStack: [],
    shapes: [],
  })),
    }),
    {
      name: 'nexus-graph',
      partialize: (state) => ({
        currentProject: state.currentProject,
        projects: state.projects,
        graphSettings: state.graphSettings,
      }),

      merge: (persistedState: any, currentState) => {
        return {
          ...currentState,
          ...persistedState,
          graphSettings: {
            ...currentState.graphSettings,
            ...(persistedState?.graphSettings || {}),
          },
        };
      },

      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export function filterNodes(nodes: Node[], searchQuery: string): Node[] {
  if (!searchQuery) return nodes;
  
  const query = searchQuery.toLowerCase();
  return nodes.filter(
    (n) =>
      n.title.toLowerCase().includes(query) ||
      (n.content?.toLowerCase().includes(query) ?? false) ||
      (n.tags?.some((t) => t.name.toLowerCase().includes(query)) ?? false)
  );
}
