import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, Node, Link, GraphData, GraphSettings, Tag, Attachment, DrawnShape } from '@/types/knowledge';
import type { Group } from '@/components/graph/GroupsTabs';

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
  
  groups: Group[];
  activeGroupId: number | null;
  
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
  deleteShape: (id: string) => void;
  undo: () => void;
  redo: () => void;
  clearShapes: () => void;
  pushToUndoStack: (shapes: DrawnShape[]) => void;
  
  // Group actions
  setGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
  updateGroup: (id: number, updates: Partial<Group>) => void;
  deleteGroup: (id: number) => void;
  setActiveGroupId: (groupId: number | null) => void;
  
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

      groups: [],
      activeGroupId: null,

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
  
  updateProject: async (id, updates) => {
    const state = useGraphStore.getState();
    const prev = state.projects.find((p) => p.id === id) || state.currentProject;
    if (!prev || !prev.id) return;

    const merged = { ...prev, ...updates, id, updatedAt: new Date().toISOString() };
    set((s) => ({
      projects: s.projects.map((p) => p.id === id ? merged : p),
      currentProject: s.currentProject?.id === id ? merged : s.currentProject
    }));

    const fullProject = {
      id: prev.id,
      name: updates.name ?? prev.name,
      color: updates.color ?? prev.color ?? '',
      userId: updates.userId ?? prev.userId ?? '',
      wallpaper: updates.wallpaper ?? prev.wallpaper ?? '',
      wallpaperBrightness: updates.wallpaperBrightness ?? prev.wallpaperBrightness,
      description: updates.description ?? prev.description ?? '',
    };

    try {
      const updated = await import('@/lib/api').then(m => m.api.projects.update(id, fullProject));
      const cleanUpdated = Object.fromEntries(
        Object.entries(updated || {}).filter(([, v]) => v !== undefined && v !== null)
      );
      set((s) => {
        const current = s.projects.find((p) => p.id === id) || s.currentProject;
        if (!current) return {};
        const finalMerged = { ...current, ...cleanUpdated, id } as Project;
        return {
          projects: s.projects.map((p) => p.id === id ? finalMerged : p),
          currentProject: s.currentProject?.id === id ? finalMerged : s.currentProject
        };
      });
    } catch (err) {
      // Revert optimistic update on failure
      const state = useGraphStore.getState();
      const current = state.projects.find((p) => p.id === id) || state.currentProject;
      
      // Only revert if we found the project and it was the one we tried to update
      if (current) {
        set((s) => ({
          projects: s.projects.map((p) => p.id === id ? prev : p),
          currentProject: s.currentProject?.id === id ? prev : s.currentProject
        }));
      }
      console.error('Failed to update project:', err);
    }
  },
  
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

  setNodes: (nodes) => {
    const NODE_COLORS = [
      '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
      '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
    ];
    const hashString = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    };
    const isValid = (c: unknown): c is string => typeof c === 'string' && !!c.trim() && c !== 'null' && c !== 'undefined';
    const fixedNodes = nodes.map((n) => {
      let customColor = n.customColor;
      if (!isValid(customColor)) {
        customColor = NODE_COLORS[hashString(n.id) % NODE_COLORS.length];
      }
      return { ...n, customColor };
    });
    set({ nodes: fixedNodes });
  },
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
  
  deleteShape: (id) => set((state) => ({
    undoStack: [...state.undoStack, state.shapes],
    redoStack: [],
    shapes: state.shapes.filter(s => s.id !== id),
  })),

  setGroups: (groups) => set({ groups }),
  
  addGroup: (group) => set((state) => ({
    groups: [...state.groups, group],
  })),
  
  updateGroup: (id, updates) => set((state) => ({
    groups: state.groups.map(g => g.id === id ? { ...g, ...updates } : g),
  })),
  
  deleteGroup: (id) => set((state) => {
    if (state.groups.length <= 1) {
      // Prevent deleting the last group
      return {};
    }
    const sortedGroups = [...state.groups].sort((a, b) => a.order - b.order);
    const idx = sortedGroups.findIndex(g => g.id === id);
    const newGroups = state.groups.filter(g => g.id !== id);
    let newActiveGroupId = state.activeGroupId;
    if (state.activeGroupId === id) {
      // Try to go to the previous group in order, or next if no previous, or null if none remain
      let fallback = null;
      if (idx > 0) fallback = sortedGroups[idx - 1].id;
      else if (idx === 0 && sortedGroups.length > 1) fallback = sortedGroups[1].id;
      newActiveGroupId = newGroups.find(g => g.id === fallback)?.id || (newGroups[0]?.id ?? null);
    }
    return {
      groups: newGroups,
      activeGroupId: newActiveGroupId,
    };
  }),
  
  ensureAtLeastOneGroup: () => set((state) => {
    if (state.groups.length === 0) {
      return { groups: [{ id: 0, name: 'Default', color: '#808080', order: 0 }] };
    }
    return {};
  }),
  
  setActiveGroupId: (groupId) => set({ activeGroupId: groupId }),
  
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
        currentProject: state.currentProject ? {
            ...state.currentProject,
            wallpaper: state.currentProject.wallpaper?.startsWith('url(data:') ? undefined : state.currentProject.wallpaper
        } : null,
        projects: state.projects.map(p => ({
            ...p,
            wallpaper: p.wallpaper?.startsWith('url(data:') ? undefined : p.wallpaper
        })),
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
