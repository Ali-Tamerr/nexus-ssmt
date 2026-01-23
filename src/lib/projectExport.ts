import type { Project, Node, Link, DrawnShape } from '@/types/knowledge';
import type { Group } from '@/components/graph/GroupsTabs';

export interface NexusProjectFile {
  version: string;
  exportDate: string;
  project: Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
  nodes: Omit<Node, 'id' | 'userId' | 'projectId' | 'createdAt' | 'updatedAt'>[];
  links: Omit<Link, 'id' | 'userId' | 'createdAt'>[];
  shapes: DrawnShape[];
  groups: Omit<Group, 'id'>[];
}

export async function exportProjectAsNxus(
  project: Project,
  nodes: Node[],
  links: Link[],
  shapes: DrawnShape[],
  groups: Group[]
): Promise<void> {
  const nexusFile: NexusProjectFile = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    project: {
      name: project.name,
      description: project.description,
      color: project.color,
      wallpaper: project.wallpaper,
    },
    nodes: nodes.map(node => ({
      title: node.title,
      content: node.content,
      excerpt: node.excerpt,
      groupId: node.groupId,
      customColor: node.customColor,
      x: node.x,
      y: node.y,
      tags: node.tags,
      attachments: node.attachments,
    })),
    links: links.map(link => ({
      sourceId: link.sourceId,
      targetId: link.targetId,
      color: link.color,
      description: link.description,
    })),
    shapes,
    groups: groups.map(group => ({
      name: group.name,
      color: group.color,
      order: group.order,
    })),
  };

  const fileName = `${project.name.replace(/[^a-zA-Z0-9\s-]/g, '').trim()}.nxus`;
  const jsonContent = JSON.stringify(nexusFile, null, 2);

  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importNxusFile(file: File): Promise<NexusProjectFile> {
  if (!file.name.endsWith('.nxus')) {
    throw new Error('Invalid file format. Please select a .nxus file.');
  }

  const text = await file.text();
  const data = JSON.parse(text);

  if (!data.version || !data.project) {
    throw new Error('Invalid project file format.');
  }

  return data as NexusProjectFile;
}

export function generateProjectName(originalName: string, existingProjects: Project[]): string {
  const existingNames = new Set(existingProjects.map(p => p.name.toLowerCase()));

  if (!existingNames.has(originalName.toLowerCase())) {
    return originalName;
  }

  let counter = 1;
  let newName;
  do {
    newName = `${originalName} (${counter})`;
    counter++;
  } while (existingNames.has(newName.toLowerCase()));

  return newName;
}
