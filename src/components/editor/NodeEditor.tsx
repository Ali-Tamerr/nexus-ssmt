'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Save, Trash2, Plus, Image, Video, Link2, FileText, ExternalLink, Tag, Loader2 } from 'lucide-react';
import { useGraphStore } from '@/store/useGraphStore';
import { Attachment, Tag as TagType, GROUP_COLORS } from '@/types/knowledge';
import { api } from '@/lib/api';

export function NodeEditor() {
  const activeNode = useGraphStore((s) => s.activeNode);
  const updateNode = useGraphStore((s) => s.updateNode);
  const deleteNode = useGraphStore((s) => s.deleteNode);
  const setActiveNode = useGraphStore((s) => s.setActiveNode);
  const isEditorOpen = useGraphStore((s) => s.isEditorOpen);
  const toggleEditor = useGraphStore((s) => s.toggleEditor);
  const addAttachmentToNode = useGraphStore((s) => s.addAttachmentToNode);
  const removeAttachmentFromNode = useGraphStore((s) => s.removeAttachmentFromNode);
  const addTagToNode = useGraphStore((s) => s.addTagToNode);
  const removeTagFromNode = useGraphStore((s) => s.removeTagFromNode);
  const currentUserId = useGraphStore((s) => s.currentUserId);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [groupId, setGroupId] = useState(0);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#8B5CF6');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeNode) {
      setTitle(activeNode.title);
      setContent(activeNode.content || '');
      setGroupId(activeNode.groupId);
    }
  }, [activeNode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target as Node)) {
        setShowAttachmentMenu(false);
      }
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node)) {
        setShowTagMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async () => {
    if (!activeNode) return;

    setIsSaving(true);
    setError(null);

    try {
      await api.nodes.update(activeNode.id, {
        title,
        content: content || undefined,
        groupId,
      });
      updateNode(activeNode.id, { title, content, groupId });
    } catch (err) {
      console.error('Failed to save node:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeNode) return;
    if (!confirm('Are you sure you want to delete this node?')) return;

    setIsDeleting(true);
    try {
      await api.nodes.delete(activeNode.id);
      deleteNode(activeNode.id);
      toggleEditor(false);
    } catch (err) {
      console.error('Failed to delete node:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setActiveNode(null);
    toggleEditor(false);
  };

  const handleAddAttachment = async () => {
    if (!newAttachmentUrl.trim() || !activeNode) return;

    try {
      const contentType = getContentTypeFromUrl(newAttachmentUrl);
      const attachment = await api.attachments.create({
        nodeId: activeNode.id,
        fileName: newAttachmentName.trim() || newAttachmentUrl.split('/').pop() || 'attachment',
        fileUrl: newAttachmentUrl.trim(),
        contentType,
        fileSize: 0,
        userId: currentUserId || undefined,
      });
      addAttachmentToNode(activeNode.id, attachment);
      setNewAttachmentUrl('');
      setNewAttachmentName('');
      setShowAttachmentMenu(false);
    } catch (err) {
      console.error('Failed to add attachment:', err);
      setError(err instanceof Error ? err.message : 'Failed to add attachment');
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!activeNode) return;
    try {
      await api.attachments.delete(attachmentId);
      removeAttachmentFromNode(activeNode.id, attachmentId);
    } catch (err) {
      console.error('Failed to remove attachment:', err);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim() || !activeNode) return;

    try {
      let tag: TagType;
      try {
        tag = await api.tags.getByName(newTagName.trim());
      } catch {
        tag = await api.tags.create({
          name: newTagName.trim(),
          color: newTagColor,
          userId: currentUserId || undefined,
        });
      }

      await api.nodes.addTag(activeNode.id, tag.id);
      addTagToNode(activeNode.id, tag);
      setNewTagName('');
      setShowTagMenu(false);
    } catch (err) {
      console.error('Failed to add tag:', err);
      setError(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!activeNode) return;
    try {
      await api.nodes.removeTag(activeNode.id, tagId);
      removeTagFromNode(activeNode.id, tagId);
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  const getContentTypeFromUrl = (url: string): string => {
    const ext = url.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
      mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
      pdf: 'application/pdf', doc: 'application/msword',
    };
    return mimeTypes[ext || ''] || 'text/html';
  };

  const getAttachmentIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (contentType.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (contentType === 'text/html') return <Link2 className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  if (!isEditorOpen || !activeNode) return null;

  const attachments = activeNode.attachments || [];
  const tags = activeNode.tags || [];

  return (
    <div className="fixed right-0 top-0 z-30 flex h-full w-96 flex-col border-l border-zinc-800 bg-zinc-900/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Edit Node</h2>
        <button
          onClick={handleClose}
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Node title"
              className="mt-2 w-full rounded-lg bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-700 transition-all focus:ring-[#265fbd]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Content (optional)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add content..."
              rows={6}
              className="mt-2 w-full resize-none rounded-lg bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-700 transition-all focus:ring-[#265fbd]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Color Group</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(GROUP_COLORS).map(([groupNum, color]) => (
                <button
                  key={groupNum}
                  onClick={() => setGroupId(Number(groupNum))}
                  className={`h-8 w-8 rounded-lg transition-all ${groupId === Number(groupNum)
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                    : 'hover:scale-110'
                    }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-300">Tags</label>
              <div className="relative" ref={tagMenuRef}>
                <button
                  onClick={() => setShowTagMenu(!showTagMenu)}
                  className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>

                {showTagMenu && (
                  <div className="absolute right-0 top-8 z-10 w-64 rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-xl">
                    <div className="mb-2">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Tag name"
                        className="w-full rounded-lg bg-zinc-700 px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none"
                      />
                    </div>
                    <div className="mb-3 flex gap-1">
                      {['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewTagColor(c)}
                          className={`h-6 w-6 rounded ${newTagColor === c ? 'ring-2 ring-white' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={handleAddTag}
                      disabled={!newTagName.trim()}
                      className="w-full rounded-lg bg-[#3B82F6] py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#265fbd] disabled:opacity-50"
                    >
                      Add Tag
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {tags.length === 0 ? (
                <p className="text-xs text-zinc-500">No tags yet</p>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-white"
                    style={{ backgroundColor: tag.color || '#6B7280' }}
                  >
                    <Tag className="h-3 w-3" />
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="ml-1 hover:text-red-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-300">Attachments</label>
              <div className="relative" ref={attachmentMenuRef}>
                <button
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>

                {showAttachmentMenu && (
                  <div className="absolute right-0 top-8 z-10 w-72 rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-xl">
                    <div className="mb-2">
                      <label className="text-xs text-zinc-400">URL</label>
                      <input
                        type="text"
                        value={newAttachmentUrl}
                        onChange={(e) => setNewAttachmentUrl(e.target.value)}
                        placeholder="https://..."
                        className="mt-1 w-full rounded-lg bg-zinc-700 px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="text-xs text-zinc-400">Name (optional)</label>
                      <input
                        type="text"
                        value={newAttachmentName}
                        onChange={(e) => setNewAttachmentName(e.target.value)}
                        placeholder="Display name"
                        className="mt-1 w-full rounded-lg bg-zinc-700 px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none"
                      />
                    </div>
                    <button
                      onClick={handleAddAttachment}
                      disabled={!newAttachmentUrl.trim()}
                      className="w-full rounded-lg bg-[#3B82F6] py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#265fbd] disabled:opacity-50"
                    >
                      Add Attachment
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 space-y-2">
              {attachments.length === 0 ? (
                <p className="text-xs text-zinc-500">No attachments yet</p>
              ) : (
                attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-zinc-400">{getAttachmentIcon(attachment.contentType)}</span>
                      <span className="truncate text-sm text-white">{attachment.fileName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={attachment.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => handleRemoveAttachment(attachment.id)}
                        className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-red-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#265fbd] disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}
