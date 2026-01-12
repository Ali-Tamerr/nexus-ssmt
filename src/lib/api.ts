import type { Project, Node, Link, Tag, Attachment, Profile, RegisterRequest } from '@/types/knowledge';

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://localhost:7007';
const API_BASE_URL = RAW_API_URL.endsWith('/') ? RAW_API_URL.slice(0, -1) : RAW_API_URL;

console.log('[API] Base URL:', API_BASE_URL);

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function transformKeys<T>(obj: unknown, transformer: (key: string) => string): T {
  if (obj === null || obj === undefined) return obj as T;
  if (Array.isArray(obj)) {
    return obj.map(item => transformKeys(item, transformer)) as T;
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[transformer(key)] = transformKeys(value, transformer);
    }
    return result as T;
  }
  return obj as T;
}

function toFrontend<T>(data: unknown): T {
  return transformKeys<T>(data, snakeToCamel);
}

function toApi(data: unknown): unknown {
  return transformKeys(data, camelToSnake);
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`[API] ${options?.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`[API] Error ${response.status}:`, error);
      throw new Error(error.title || error.message || `API Error: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();
    console.log(`[API] Response:`, data);
    return toFrontend<T>(data);
  } catch (err) {
    console.error(`[API] Request failed:`, err);
    throw err;
  }
}

async function fetchApiWithBody<T>(endpoint: string, method: string, body: unknown): Promise<T> {
  const convertedBody = toApi(body);
  console.log('[API] Sending body:', JSON.stringify(convertedBody, null, 2));
  return fetchApi<T>(endpoint, {
    method,
    body: JSON.stringify(convertedBody),
  });
}

export const api = {
  auth: {
    register: (data: RegisterRequest) =>
      fetchApiWithBody<Profile>('/api/auth/register', 'POST', data),
  },

  projects: {
    getByUser: (userId: string) =>
      fetchApi<Project[]>(`/api/projects?userId=${userId}`),
    
    getById: (id: string) =>
      fetchApi<Project>(`/api/projects/${id}`),
    
    create: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) =>
      fetchApiWithBody<Project>('/api/projects', 'POST', data),
    
    update: (id: string, data: Partial<Project>) =>
      fetchApiWithBody<Project>(`/api/projects/${id}`, 'PUT', data),
    
    delete: (id: string) =>
      fetchApi<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  },

  nodes: {
    getByProject: (projectId: string) =>
      fetchApi<Node[]>(`/api/nodes?projectId=${projectId}`),
    
    getByUser: (userId: string) =>
      fetchApi<Node[]>(`/api/nodes/user/${userId}`),
    
    getById: (id: string) =>
      fetchApi<Node>(`/api/nodes/${id}`),
    
    search: (query: string) =>
      fetchApi<Node[]>(`/api/nodes/search?query=${encodeURIComponent(query)}`),
    
    create: (data: Omit<Node, 'id' | 'createdAt' | 'updatedAt'>) =>
      fetchApiWithBody<Node>('/api/nodes', 'POST', data),
    
    update: (id: string, data: Partial<Node>) =>
      fetchApiWithBody<Node>(`/api/nodes/${id}`, 'PUT', data),
    
    delete: (id: string) =>
      fetchApi<void>(`/api/nodes/${id}`, { method: 'DELETE' }),
    
    addTag: (nodeId: string, tagId: string) =>
      fetchApi<void>(`/api/nodes/${nodeId}/tags/${tagId}`, { method: 'POST' }),
    
    removeTag: (nodeId: string, tagId: string) =>
      fetchApi<void>(`/api/nodes/${nodeId}/tags/${tagId}`, { method: 'DELETE' }),
  },

  links: {
    getAll: () =>
      fetchApi<Link[]>('/api/links'),
    
    getByNode: (nodeId: string) =>
      fetchApi<Link[]>(`/api/links/node/${nodeId}`),
    
    getByUser: (userId: string) =>
      fetchApi<Link[]>(`/api/links/user/${userId}`),
    
    getById: (id: string) =>
      fetchApi<Link>(`/api/links/${id}`),
    
    create: (data: { sourceId: string; targetId: string; relationshipType?: string; userId?: string }) =>
      fetchApiWithBody<Link>('/api/links', 'POST', data),
    
    update: (id: string, data: Partial<Link>) =>
      fetchApiWithBody<Link>(`/api/links/${id}`, 'PUT', data),
    
    delete: (id: string) =>
      fetchApi<void>(`/api/links/${id}`, { method: 'DELETE' }),
  },

  tags: {
    getAll: () =>
      fetchApi<Tag[]>('/api/tags'),
    
    getByUser: (userId: string) =>
      fetchApi<Tag[]>(`/api/tags/user/${userId}`),
    
    getById: (id: string) =>
      fetchApi<Tag>(`/api/tags/${id}`),
    
    getByName: (name: string) =>
      fetchApi<Tag>(`/api/tags/name/${encodeURIComponent(name)}`),
    
    create: (data: { name: string; color?: string; userId?: string }) =>
      fetchApiWithBody<Tag>('/api/tags', 'POST', data),
    
    update: (id: string, data: Partial<Tag>) =>
      fetchApiWithBody<Tag>(`/api/tags/${id}`, 'PUT', data),
    
    delete: (id: string) =>
      fetchApi<void>(`/api/tags/${id}`, { method: 'DELETE' }),
  },

  attachments: {
    getByNode: (nodeId: string) =>
      fetchApi<Attachment[]>(`/api/attachments?nodeId=${nodeId}`),
    
    getById: (id: string) =>
      fetchApi<Attachment>(`/api/attachments/${id}`),
    
    create: (data: { nodeId: string; fileName: string; fileUrl: string; contentType: string; fileSize: number; userId?: string }) =>
      fetchApiWithBody<Attachment>('/api/attachments', 'POST', data),
    
    delete: (id: string) =>
      fetchApi<void>(`/api/attachments/${id}`, { method: 'DELETE' }),
  },

  groups: {
    getAll: () =>
      fetchApi<{ id: number; name: string; color: string }[]>('/api/groups'),
    
    getById: (id: number) =>
      fetchApi<{ id: number; name: string; color: string }>(`/api/groups/${id}`),
  },

  profiles: {
    getById: (id: string) =>
      fetchApi<Profile>(`/api/profiles/${id}`),
    
    getByEmail: (email: string) =>
      fetchApi<Profile>(`/api/profiles/email/${encodeURIComponent(email)}`),
    
    update: (id: string, data: Partial<Profile>) =>
      fetchApiWithBody<Profile>(`/api/profiles/${id}`, 'PUT', data),
  },
};
