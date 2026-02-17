import type {
  Project,
  Node,
  Link,
  Tag,
  Attachment,
  Profile,
  RegisterRequest,
  DrawnShape,
  ProjectCollection,
} from "@/types/knowledge";

const RAW_API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PRIVATE_API_URL?.trim() ||
  "";

if (!RAW_API_URL && typeof window !== "undefined") {
  console.warn(
    "API URL is not defined. Requests will be relative to the domain and may fail if not proxying.",
  );
}
const API_BASE_URL = RAW_API_URL.endsWith("/")
  ? RAW_API_URL.slice(0, -1)
  : RAW_API_URL;

function pascalToCamel(str: string): string {
  if (!str) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function camelToPascal(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function transformKeys<T>(
  obj: unknown,
  transformer: (key: string) => string,
): T {
  if (obj === null || obj === undefined) return obj as T;
  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeys(item, transformer)) as T;
  }
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[transformer(key)] = transformKeys(value, transformer);
    }
    return result as T;
  }
  return obj as T;
}

function toFrontend<T>(data: unknown): T {
  return transformKeys<T>(data, pascalToCamel);
}

function toApi(data: unknown): unknown {
  return transformKeys(data, camelToPascal);
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { suppressLog?: boolean },
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const { suppressLog, ...fetchOptions } = options || {};

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (fetchOptions.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      let error;
      try {
        error = JSON.parse(text);
      } catch {
        error = { message: text };
      }

      if (!suppressLog) {
        console.error("[API] Backend error:", response.status, error);
      }

      if (error.errors) {
        throw new Error(JSON.stringify(error.errors));
      }
      throw new Error(
        error.title || error.message || `API Error: ${response.status}`,
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();
    return toFrontend<T>(data);
  } catch (err) {
    if (!suppressLog) {
      // console.error(`[API] Request failed:`, err);
    }
    throw err;
  }
}

async function fetchApiWithBody<T>(
  endpoint: string,
  method: string,
  body: unknown,
  suppressLog?: boolean,
): Promise<T> {
  // We need to be careful not to double stringify if body is already prepared, but transformKeys expects object
  // For drawings points, we already stringified it in the caller.
  const convertedBody = toApi(body);

  return fetchApi<T>(endpoint, {
    method,
    body: JSON.stringify(convertedBody),
    suppressLog,
  });
}

// Helper to pick fields
function pick<T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  const ret: any = {};
  keys.forEach((key) => {
    if (obj[key] !== undefined) ret[key] = obj[key];
  });
  return ret;
}

export const api = {
  auth: {
    register: (data: RegisterRequest) =>
      fetchApiWithBody<Profile>("/api/auth/register", "POST", data),

    login: (data: Pick<RegisterRequest, "email" | "password">) =>
      fetchApiWithBody<Profile>("/api/auth/login", "POST", data),
  },

  projects: {
    getByUser: (userId: string) =>
      fetchApi<Project[]>(`/api/projects?userId=${userId}`),

    getById: (id: number) => fetchApi<Project>(`/api/projects/${id}`),

    create: (data: Omit<Project, "id" | "createdAt" | "updatedAt">) => {
      const payload = pick(
        data,
        "name",
        "description",
        "color",
        "userId",
        "wallpaper",
      );
      return fetchApiWithBody<Project>("/api/projects", "POST", payload);
    },

    update: (id: number, data: Partial<Project>) => {
      const payload = pick(
        data,
        "id",
        "name",
        "description",
        "color",
        "userId",
        "wallpaper",
      );
      return fetchApiWithBody<Project>(`/api/projects/${id}`, "PUT", payload);
    },

    delete: (id: number) =>
      fetchApi<void>(`/api/projects/${id}`, { method: "DELETE" }),
  },

  nodes: {
    getByProject: (projectId: number) =>
      fetchApi<Node[]>(`/api/nodes?projectId=${projectId}`),

    getByUser: (userId: string) =>
      fetchApi<Node[]>(`/api/nodes/user/${userId}`),

    getById: (id: number) => fetchApi<Node>(`/api/nodes/${id}`),

    search: (query: string) =>
      fetchApi<Node[]>(`/api/nodes/search?query=${encodeURIComponent(query)}`),

    create: (data: Omit<Node, "id" | "createdAt" | "updatedAt">) => {
      const payload = pick(
        data,
        "title",
        "content",
        "groupId",
        "projectId",
        "userId",
        "x",
        "y",
        "customColor",
      );
      return fetchApiWithBody<Node>("/api/nodes", "POST", payload);
    },

    update: (id: number, data: Partial<Node>) => {
      const payload = pick(
        data,
        "id",
        "title",
        "content",
        "groupId",
        "projectId",
        "userId",
        "x",
        "y",
        "customColor",
      );
      return fetchApiWithBody<Node>(`/api/nodes/${id}`, "PUT", payload);
    },

    updatePosition: (id: number, x: number, y: number) =>
      fetchApiWithBody<Node>(`/api/nodes/${id}`, "PUT", { id, x, y }),

    delete: (id: number) =>
      fetchApi<void>(`/api/nodes/${id}`, {
        method: "DELETE",
        suppressLog: true,
      }),

    addTag: (nodeId: number, tagId: number) =>
      fetchApi<void>(`/api/nodes/${nodeId}/tags/${tagId}`, { method: "POST" }),

    removeTag: (nodeId: number, tagId: number) =>
      fetchApi<void>(`/api/nodes/${nodeId}/tags/${tagId}`, {
        method: "DELETE",
      }),
  },

  links: {
    getAll: () => fetchApi<Link[]>("/api/links"),

    getByNode: (nodeId: number) =>
      fetchApi<Link[]>(`/api/links/node/${nodeId}`),

    getByUser: (userId: string) =>
      fetchApi<Link[]>(`/api/links/user/${userId}`),

    getById: (id: number) => fetchApi<Link>(`/api/links/${id}`),

    create: (data: {
      sourceId: number;
      targetId: number;
      description?: string;
      userId?: string;
      color?: string;
    }) => fetchApiWithBody<Link>("/api/links", "POST", data),

    update: (id: number, data: Partial<Link>) => {
      const payload = pick(
        data,
        "id",
        "sourceId",
        "targetId",
        "color",
        "description",
        "userId",
      );
      return fetchApiWithBody<Link>(`/api/links/${id}`, "PUT", payload);
    },

    delete: (id: number) =>
      fetchApi<void>(`/api/links/${id}`, { method: "DELETE" }),
  },

  tags: {
    getAll: () => fetchApi<Tag[]>("/api/tags"),

    getByUser: (userId: string) => fetchApi<Tag[]>(`/api/tags/user/${userId}`),

    getById: (id: number) => fetchApi<Tag>(`/api/tags/${id}`),

    getByName: (name: string) =>
      fetchApi<Tag>(`/api/tags/name/${encodeURIComponent(name)}`),

    create: (data: { name: string; color?: string; userId?: string }) =>
      fetchApiWithBody<Tag>("/api/tags", "POST", data),

    update: (id: number, data: Partial<Tag>) => {
      const payload = pick(data, "id", "name", "color", "userId");
      return fetchApiWithBody<Tag>(`/api/tags/${id}`, "PUT", payload);
    },

    delete: (id: number) =>
      fetchApi<void>(`/api/tags/${id}`, { method: "DELETE" }),
  },

  attachments: {
    getByNode: (nodeId: number) =>
      fetchApi<Attachment[]>(`/api/attachments?nodeId=${nodeId}`),

    getById: (id: number) => fetchApi<Attachment>(`/api/attachments/${id}`),

    create: (data: { nodeId: number; fileName: string; fileUrl: string }) =>
      fetchApiWithBody<Attachment>("/api/attachments", "POST", data),

    delete: (id: number) =>
      fetchApi<void>(`/api/attachments/${id}`, { method: "DELETE" }),
  },

  groups: {
    getByProject: (projectId: number) =>
      fetchApi<
        {
          id: number;
          name: string;
          color: string;
          order: number;
          projectId: number | null;
        }[]
      >(`/api/groups?projectId=${projectId}`),

    getById: (id: number) =>
      fetchApi<{
        id: number;
        name: string;
        color: string;
        order: number;
        projectId: number | null;
      }>(`/api/groups/${id}`),

    create: (data: {
      name: string;
      color: string;
      order?: number;
      projectId: number;
    }) =>
      fetchApiWithBody<{
        id: number;
        name: string;
        color: string;
        order: number;
        projectId: number;
      }>("/api/groups", "POST", {
        name: data.name,
        color: data.color,
        order: data.order ?? 0,
        projectId: data.projectId,
      }),

    update: (
      id: number,
      data: Partial<{
        name: string;
        color: string;
        order: number;
        projectId: number;
      }>,
    ) =>
      fetchApiWithBody<{
        id: number;
        name: string;
        color: string;
        order: number;
        projectId: number;
      }>(
        `/api/groups/${id}`,
        "PUT",
        {
          id: id,
          ...data,
        },
        true,
      ),

    delete: (id: number) =>
      fetchApi<void>(`/api/groups/${id}`, {
        method: "DELETE",
        suppressLog: true,
      }),

    reorder: (sortedIds: number[]) =>
      fetchApiWithBody<void>("/api/groups/reorder", "PUT", sortedIds, true),
  },

  profiles: {
    getById: (id: string) => fetchApi<Profile>(`/api/profiles/${id}`),

    getByEmail: (
      email: string,
      provider?: string,
      suppressLog: boolean = false,
    ) => {
      let url = `/api/profiles/email/${encodeURIComponent(email)}`;
      if (provider) url += `?provider=${encodeURIComponent(provider)}`;
      return fetchApi<Profile>(url, { suppressLog });
    },

    update: (id: string, data: Partial<Profile>) =>
      fetchApiWithBody<Profile>(`/api/profiles/${id}`, "PUT", data),
  },

  drawings: {
    getByProject: async (projectId: number, groupId?: number) => {
      let url = `/api/drawings?projectId=${projectId}`;
      if (groupId !== undefined) url += `&groupId=${groupId}`;
      const drawings = await fetchApi<DrawnShape[]>(url);
      return drawings.map((d) => ({
        ...d,
        points: typeof d.points === "string" ? JSON.parse(d.points) : d.points,
      }));
    },

    getById: async (id: number) => {
      const d = await fetchApi<DrawnShape>(`/api/drawings/${id}`);
      return {
        ...d,
        points: typeof d.points === "string" ? JSON.parse(d.points) : d.points,
      };
    },

    create: (data: {
      projectId: number;
      type: string;
      points: { x: number; y: number }[];
      color: string;
      width?: number;
      style: string;
      text?: string;
      fontSize?: number;
      fontFamily?: string;
      groupId?: number;
    }) => {
      // API expects Points as a JSON string
      const payload = {
        ...data,
        points: JSON.stringify(data.points),
      };

      return fetchApiWithBody<any>("/api/drawings", "POST", payload).then(
        (d) => ({
          ...d,
          points:
            typeof d.points === "string" ? JSON.parse(d.points) : d.points,
        }),
      ) as Promise<DrawnShape>;
    },

    update: (
      id: number,
      data: Partial<{
        type: string;
        points: { x: number; y: number }[];
        color: string;
        width: number;
        style: string;
        text: string;
        fontSize: number;
        fontFamily: string;
        groupId: number;
      }>,
    ) => {
      const payload: any = { ...data };
      if (data.points) {
        payload.points = JSON.stringify(data.points);
      }
      return fetchApiWithBody<any>(`/api/drawings/${id}`, "PUT", payload).then(
        (d) => ({
          ...d,
          points:
            typeof d.points === "string" ? JSON.parse(d.points) : d.points,
        }),
      ) as Promise<DrawnShape>;
    },

    delete: (id: number) =>
      fetchApi<void>(`/api/drawings/${id}`, { method: "DELETE" }),
  },

  projectCollections: {
    getByUser: (userId: string) =>
      fetchApi<ProjectCollection[]>(`/api/ProjectCollections?userId=${userId}`),

    getById: (id: number) =>
      fetchApi<ProjectCollection>(`/api/ProjectCollections/${id}`),

    create: (data: {
      name: string;
      description?: string;
      userId: string;
      projectIds: number[];
    }) =>
      fetchApiWithBody<ProjectCollection>(
        "/api/ProjectCollections",
        "POST",
        data,
      ),

    update: (
      id: number,
      data: {
        id?: number;
        name?: string;
        description?: string;
        projectIds?: number[];
        userId?: string;
      },
    ) =>
      fetchApiWithBody<ProjectCollection>(
        `/api/ProjectCollections/${id}`,
        "PUT",
        data,
      ),

    delete: (id: number) =>
      fetchApi<void>(`/api/ProjectCollections/${id}`, { method: "DELETE" }),
  },
};

export type ApiDrawing = DrawnShape;
