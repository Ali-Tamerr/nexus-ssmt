'use client';
// Refactored for Optimistic UI

import { useState, useEffect, useRef } from 'react';
import { X, Save, Trash2, Plus, Image, Video, Link2, FileText, ExternalLink, Tag, Loader2, ArrowRight, Pencil } from 'lucide-react';
import { useGraphStore } from '@/store/useGraphStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/context/ToastContext';
import { Attachment, Tag as TagType, Link as LinkType, GROUP_COLORS } from '@/types/knowledge';
import { api } from '@/lib/api';
import { ColorPicker } from '@/components/ui/ColorPicker';

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
  const nodes = useGraphStore((s) => s.nodes);
  const links = useGraphStore((s) => s.links);
  const addLink = useGraphStore((s) => s.addLink);
  const updateLink = useGraphStore((s) => s.updateLink);
  const deleteLink = useGraphStore((s) => s.deleteLink);
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery);

  const isConnectionPickerActive = useGraphStore(s => s.isConnectionPickerActive);
  const setConnectionPickerActive = useGraphStore(s => s.setConnectionPickerActive);
  const connectionPickerResult = useGraphStore(s => s.connectionPickerResult);
  const setConnectionPickerResult = useGraphStore(s => s.setConnectionPickerResult);
  const { user } = useAuthStore();
  const { showToast, showConfirmation } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [customColor, setCustomColor] = useState<string | undefined>(undefined);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showConnectionMenu, setShowConnectionMenu] = useState(false);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#8B5CF6');
  const [selectedTargetNodeId, setSelectedTargetNodeId] = useState<number | ''>('');
  const [connectionDescription, setConnectionDescription] = useState('');
  const [connectionColor, setConnectionColor] = useState('#355ea1');
  const [editingConnectionId, setEditingConnectionId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const connectionMenuRef = useRef<HTMLDivElement>(null);
  const customColorPickerRef = useRef<HTMLDivElement>(null);

  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [tempCustomColor, setTempCustomColor] = useState('#355ea1');
  const [showUnsavedPopup, setShowUnsavedPopup] = useState(false);

  // Buffer State for Deferred Saving & Revert
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [deletedAttachments, setDeletedAttachments] = useState<Map<number, Attachment>>(new Map());

  const [pendingLinks, setPendingLinks] = useState<LinkType[]>([]);
  const [deletedLinks, setDeletedLinks] = useState<Map<number, LinkType>>(new Map());
  const [editedLinks, setEditedLinks] = useState<Map<number, LinkType>>(new Map());
  const [originalLinks, setOriginalLinks] = useState<Map<number, LinkType>>(new Map());

  // Track original color to revert on cancel
  const originalColorRef = useRef<string | undefined>(undefined);

  // Reset buffers when switching nodes
  useEffect(() => {
    setPendingAttachments([]);
    setDeletedAttachments(new Map());
    setPendingLinks([]);
    setDeletedLinks(new Map());
    setEditedLinks(new Map());
    setOriginalLinks(new Map());
  }, [activeNode?.id]);

  useEffect(() => {
    if (connectionPickerResult !== null) {
      setSelectedTargetNodeId(connectionPickerResult);
      setConnectionPickerResult(null); // Reset after using
    }
  }, [connectionPickerResult, setConnectionPickerResult]);

  useEffect(() => {
    if (activeNode) {
      setTitle(activeNode.title);
      setContent(activeNode.content || '');
      // Ensure null becomes undefined for the state
      setCustomColor(activeNode.customColor || undefined);
    }
  }, [activeNode]);

  // Capture original color when node/selection changes
  useEffect(() => {
    if (activeNode?.id) {
      originalColorRef.current = activeNode.customColor || undefined;
    }
  }, [activeNode?.id]);

  // Revert changes on unmount/selection change if not saved
  useEffect(() => {
    const nodeId = activeNode?.id;
    if (!nodeId) return;

    return () => {
      const currentNode = useGraphStore.getState().nodes.find(n => n.id === nodeId);
      // If node exists and color is different from original, revert it
      if (currentNode && currentNode.customColor !== originalColorRef.current) {
        useGraphStore.getState().updateNode(nodeId, { customColor: originalColorRef.current });
      }
    };
  }, [activeNode?.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target as Node)) {
        setShowAttachmentMenu(false);
      }
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node)) {
        setShowTagMenu(false);
      }
      if (connectionMenuRef.current && !connectionMenuRef.current.contains(e.target as Node)) {
        setShowConnectionMenu(false);
      }
      if (customColorPickerRef.current && !customColorPickerRef.current.contains(e.target as Node)) {
        setShowCustomColorPicker(false);
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
      // 1. Save Node Properties
      if (title !== activeNode.title || content !== (activeNode.content || '') || customColor !== originalColorRef.current) {
        await api.nodes.update(activeNode.id, {
          id: activeNode.id,
          title,
          content: content || '',
          groupId: activeNode.groupId,
          customColor,
          projectId: activeNode.projectId,
          userId: activeNode.userId,
          group: activeNode.group ? { id: activeNode.group.id, name: activeNode.group.name, color: activeNode.group.color, order: activeNode.group.order } : { id: activeNode.groupId ?? 0, name: 'Default', color: '#808080', order: 0 },
          x: activeNode.x,
          y: activeNode.y,
        });
        updateNode(activeNode.id, { title, content, customColor });
      }

      // 2. Attachments
      for (const [id] of deletedAttachments) {
        await api.attachments.delete(id);
      }
      for (const att of pendingAttachments) {
        const newAtt = await api.attachments.create({
          nodeId: activeNode.id,
          fileName: att.fileName,
          fileUrl: att.fileUrl
        });
        removeAttachmentFromNode(activeNode.id, att.id);
        addAttachmentToNode(activeNode.id, newAtt);
      }

      // 3. Links
      for (const [id] of deletedLinks) {
        await api.links.delete(id);
      }
      for (const link of pendingLinks) {
        const newLink = await api.links.create({
          sourceId: link.sourceId,
          targetId: link.targetId,
          color: link.color,
          description: link.description || undefined,
          userId: link.userId || activeNode.userId || user?.id || ''
        });
        deleteLink(link.id);
        addLink(newLink);
      }
      for (const [id, link] of editedLinks) {
        const updated = await api.links.update(id, {
          id: id,
          sourceId: link.sourceId,
          targetId: link.targetId,
          color: link.color,
          description: link.description || undefined,
          userId: link.userId || activeNode.userId || user?.id || ''
        });
        updateLink(id, updated);
      }

      // Reset Buffers
      setPendingAttachments([]);
      setDeletedAttachments(new Map());
      setPendingLinks([]);
      setDeletedLinks(new Map());
      setEditedLinks(new Map());
      setOriginalLinks(new Map());

      // Update Ref
      originalColorRef.current = customColor;

      setSearchQuery('');
      showToast('Node saved successfully');
      toggleEditor(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      showToast('Failed to save node', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeNode) return;

    if (!await showConfirmation('Are you sure you want to delete this node?')) return;

    setIsDeleting(true);
    try {
      await api.nodes.delete(activeNode.id);
      deleteNode(activeNode.id);
      toggleEditor(false);
      showToast('Node deleted successfully',);
    } catch (err) {
      // console.error('Failed to delete node:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
      showToast('Failed to delete node', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const isTitleDirty = activeNode ? title !== activeNode.title : false;
  const isContentDirty = activeNode ? content !== (activeNode.content || '') : false;
  const isColorDirty = activeNode ? activeNode.customColor !== originalColorRef.current : false;
  const isAttachmentsDirty = pendingAttachments.length > 0 || deletedAttachments.size > 0;
  const isLinksDirty = pendingLinks.length > 0 || deletedLinks.size > 0 || editedLinks.size > 0;
  const isDirty = (isTitleDirty || isContentDirty || isColorDirty || isAttachmentsDirty || isLinksDirty);

  const handleDiscardAndClose = () => {
    if (activeNode && activeNode.customColor !== originalColorRef.current) {
      useGraphStore.getState().updateNode(activeNode.id, { customColor: originalColorRef.current });
    }

    // Revert Optimistic Updates
    if (activeNode) {
      pendingAttachments.forEach(a => removeAttachmentFromNode(activeNode.id, a.id));
      deletedAttachments.forEach(a => addAttachmentToNode(activeNode.id, a));
    }

    pendingLinks.forEach(l => deleteLink(l.id));
    deletedLinks.forEach(l => addLink(l));
    originalLinks.forEach((l, id) => updateLink(id, l));

    setPendingAttachments([]);
    setDeletedAttachments(new Map());
    setPendingLinks([]);
    setDeletedLinks(new Map());
    setEditedLinks(new Map());
    setOriginalLinks(new Map());

    setActiveNode(null);
    toggleEditor(false);
    setShowUnsavedPopup(false);
  };

  const handleClose = () => {
    if (isDirty) {
      setShowUnsavedPopup(true);
      return;
    }
    setActiveNode(null);
    toggleEditor(false);
  };

  const handleAddAttachment = () => {
    if (!newAttachmentUrl.trim() || !activeNode) return;

    let url = newAttachmentUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    // Simple content type detection
    let contentType = 'text/html';
    const ext = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) contentType = 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
    else if (['mp4', 'webm'].includes(ext || '')) contentType = 'video/' + ext;
    else if (ext === 'pdf') contentType = 'application/pdf';

    const attachment: Attachment = {
      id: -Date.now(),
      nodeId: activeNode.id,
      fileName: newAttachmentName.trim() || url.split('/').pop() || 'attachment.file',
      fileUrl: url,
      contentType,
      createdAt: new Date().toISOString(),
      fileSize: 0
    };

    setPendingAttachments(prev => [...prev, attachment]);
    // Optimistic Update
    addAttachmentToNode(activeNode.id, attachment);

    setNewAttachmentUrl('');
    setNewAttachmentName('');
    setShowAttachmentMenu(false);
  };

  const handleRemoveAttachment = (attachmentId: number) => {
    if (!activeNode) return;

    if (attachmentId < 0) {
      setPendingAttachments(prev => prev.filter(a => a.id !== attachmentId));
      removeAttachmentFromNode(activeNode.id, attachmentId);
    } else {
      const att = activeNode.attachments?.find(a => a.id === attachmentId);
      if (att) {
        setDeletedAttachments(prev => new Map(prev).set(attachmentId, att));
        removeAttachmentFromNode(activeNode.id, attachmentId);
      }
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
          userId: currentUserId || user?.id || undefined,
        });
      }

      await api.nodes.addTag(activeNode.id, tag.id);
      addTagToNode(activeNode.id, tag);
      setNewTagName('');
      setShowTagMenu(false);
    } catch (err) {
      // console.error('Failed to add tag:', err);
      setError(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    if (!activeNode) return;
    try {
      await api.nodes.removeTag(activeNode.id, tagId);
      removeTagFromNode(activeNode.id, tagId);
    } catch (err) {
      // console.error('Failed to remove tag:', err);
    }
  };

  const handleAddConnection = () => {
    if (!activeNode || !selectedTargetNodeId) return;

    const userId = currentUserId || user?.id;
    if (!userId) {
      setError('User ID is required to create connections');
      return;
    }

    const targetNode = nodes.find(n => n.id === selectedTargetNodeId);
    if (!targetNode) {
      setError('Target node not found');
      return;
    }

    const sanitizeNode = (n: any) => ({
      id: n.id,
      title: n.title,
      groupId: n.groupId ?? 0,
      projectId: n.projectId,
      userId: n.userId,
      group: n.group ? { id: n.group.id, name: n.group.name, color: n.group.color, order: n.group.order } : { id: n.groupId ?? 0, name: 'Default', color: '#808080', order: 0 },
      createdAt: n.createdAt || new Date().toISOString(),
      updatedAt: n.updatedAt || new Date().toISOString()
    });

    const link: LinkType = {
      id: -Date.now(),
      sourceId: activeNode.id,
      targetId: selectedTargetNodeId as number,
      source: sanitizeNode(activeNode),
      target: sanitizeNode(targetNode),
      color: connectionColor,
      description: connectionDescription.trim() || undefined,
      userId: userId,
      createdAt: new Date().toISOString()
    };

    setPendingLinks(prev => [...prev, link]);
    addLink(link); // Optimistic Update

    setSelectedTargetNodeId('');
    setConnectionDescription('');
    setConnectionColor('#355ea1');
    setShowConnectionMenu(false);
    setError(null);
  };

  const handleRemoveConnection = (linkId: number) => {
    if (linkId < 0) {
      setPendingLinks(prev => prev.filter(l => l.id !== linkId));
      deleteLink(linkId);
    } else {
      const link = links.find(l => l.id === linkId);
      if (link) {
        setDeletedLinks(prev => new Map(prev).set(linkId, link));
        deleteLink(linkId);
      }
    }
  };

  const handleEditConnection = (link: LinkType) => {
    setEditingConnectionId(link.id);
    const connectedNodeId = link.sourceId === activeNode?.id ? link.targetId : link.sourceId;
    setSelectedTargetNodeId(connectedNodeId);
    setConnectionDescription(link.description || '');
    setConnectionColor(link.color || '#355ea1');
    setShowConnectionMenu(true);
  };

  const handleUpdateConnection = () => {
    if (!editingConnectionId || !activeNode) return;

    const link = links.find(l => l.id === editingConnectionId);
    if (!link) return;

    // Use current state for updates
    const updatedLink: LinkType = {
      ...link,
      color: connectionColor,
      description: connectionDescription.trim() || undefined,
    };

    if (editingConnectionId < 0) {
      setPendingLinks(prev => prev.map(l => l.id === editingConnectionId ? updatedLink : l));
      updateLink(editingConnectionId, updatedLink); // Optimistic
    } else {
      // Track Original if not tracked
      // Note: We need the value BEFORE we updated it in store. But if we edit multiple times, we need the VERY FIRST original.
      // Since editingConnectionId > 0, it exists in originalLinks map if we edited it before.
      if (!originalLinks.has(editingConnectionId)) {
        setOriginalLinks(prev => new Map(prev).set(editingConnectionId, link));
      }

      setEditedLinks(prev => new Map(prev).set(editingConnectionId, updatedLink));
      updateLink(editingConnectionId, updatedLink); // Optimistic
    }

    setSelectedTargetNodeId('');
    setConnectionDescription('');
    setConnectionColor('#355ea1');
    setEditingConnectionId(null);
    setShowConnectionMenu(false);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingConnectionId(null);
    setSelectedTargetNodeId('');
    setConnectionDescription('');
    setConnectionColor('#355ea1');
    setShowConnectionMenu(false);
  };

  const getContentTypeFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const ext = pathname.split('.').pop()?.toLowerCase();

      const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
        mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
        pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        txt: 'text/plain',
      };

      if (ext && mimeTypes[ext]) return mimeTypes[ext];
    } catch (e) {
      // console.warn('Invalid URL for content type detection:', e);
    }
    return 'text/html';
  };

  const getAttachmentIcon = (contentType?: string) => {
    if (!contentType) return <Link2 className="h-4 w-4" />;
    if (contentType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (contentType.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (contentType === 'text/html') return <Link2 className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  if (!isEditorOpen || !activeNode) return null;

  const attachments = activeNode.attachments || [];
  const tags = activeNode.tags || [];
  const nodeConnections = links.filter(l => l.sourceId === activeNode.id || l.targetId === activeNode.id);
  const connectedNodeIds = new Set(nodeConnections.flatMap(l => [l.sourceId, l.targetId]));
  const availableNodes = nodes.filter(n => n.id !== activeNode.id && !connectedNodeIds.has(n.id));

  return (
    <>
      <div className="fixed right-0 top-0 z-50 flex h-full w-full sm:w-96 flex-col border-l border-zinc-800 bg-zinc-900/95">
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
              <label className="block text-sm font-medium text-zinc-300 mb-2">Color</label>
              <div className="flex flex-wrap gap-2 items-center">
                {Object.entries(GROUP_COLORS).map(([groupNum, color]) => (
                  <button
                    key={groupNum}
                    onClick={() => {
                      // Set as custom color instead of changing group
                      setCustomColor(color);
                      if (activeNode) {
                        updateNode(activeNode.id, { customColor: color });
                      }
                    }}
                    className={`h-8 w-8 rounded-lg transition-all ${customColor === color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                      : 'hover:scale-110'
                      }`}
                    style={{ backgroundColor: color }}
                    title={`Select color`}
                  />
                ))}

                <div className="relative" ref={customColorPickerRef}>
                  <button
                    onClick={() => {
                      setTempCustomColor(customColor || '#355ea1');
                      setShowCustomColorPicker(!showCustomColorPicker);
                    }}
                    className={`h-8 w-8 rounded-lg border-2 transition-all flex items-center justify-center ${customColor && !Object.values(GROUP_COLORS).includes(customColor)
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                      : 'border-zinc-700 hover:border-zinc-500'
                      }`}
                    style={{
                      backgroundColor: (customColor && !Object.values(GROUP_COLORS).includes(customColor)) ? customColor : 'transparent'
                    }}
                    title="Custom color"
                  >
                    {(!customColor || Object.values(GROUP_COLORS).includes(customColor)) && <Plus className="h-4 w-4 text-zinc-400" />}
                  </button>

                  {showCustomColorPicker && (
                    <div className="absolute left-0 top-10 z-50 rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-xl w-48">
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-zinc-400 mb-1 block">Color Picker</label>
                          <input
                            type="color"
                            value={tempCustomColor}
                            onChange={(e) => setTempCustomColor(e.target.value)}
                            className="w-full h-10 rounded cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 mb-1 block">Hex Code</label>
                          <input
                            type="text"
                            value={tempCustomColor}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                                setTempCustomColor(value);
                              }
                            }}
                            placeholder="#355ea1"
                            className="w-full rounded-lg bg-zinc-700 px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none uppercase"
                            maxLength={7}
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (tempCustomColor.length === 7) {
                              setCustomColor(tempCustomColor);
                              if (activeNode) {
                                updateNode(activeNode.id, { customColor: tempCustomColor });
                              }
                            }
                            setShowCustomColorPicker(false);
                          }}
                          className="w-full mt-2 rounded-lg bg-[#355ea1] py-1.5 text-xs font-medium text-white hover:bg-[#265fbd] transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}

                  {customColor && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomColor(undefined);
                        if (activeNode) {
                          updateNode(activeNode.id, { customColor: undefined });
                        }
                      }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center text-white text-xs hover:bg-zinc-600"
                      title="Reset to default group color"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* <div>
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
                      {['#8B5CF6', '#355ea1', '#10B981', '#F59E0B', '#EF4444', '#EC4899'].map((c) => (
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
                      className="w-full rounded-lg bg-[#355ea1] py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#265fbd] disabled:opacity-50"
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
          </div> */}

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
                        className="w-full rounded-lg bg-[#355ea1] py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#265fbd] disabled:opacity-50"
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

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-300">Connections</label>
                <div className="relative" ref={connectionMenuRef}>
                  <button
                    onClick={() => setShowConnectionMenu(!showConnectionMenu)}
                    className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>

                  {showConnectionMenu && (
                    <div className="absolute right-0 top-8 z-10 w-72 rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-xl">
                      <div className="mb-2">
                        <label className="text-xs text-zinc-400">Connect to Node</label>
                        <div className="flex gap-2">
                          <select
                            value={selectedTargetNodeId}
                            onChange={(e) => setSelectedTargetNodeId(e.target.value ? Number(e.target.value) : '')}
                            disabled={!!editingConnectionId}
                            className="mt-1 w-full rounded-lg bg-zinc-700 px-3 py-1.5 text-sm text-white outline-none disabled:opacity-50"
                          >
                            <option value="">Select a node...</option>
                            {availableNodes.map(n => (
                              <option key={n.id} value={n.id}>{n.title}</option>
                            ))}
                            {editingConnectionId && (
                              <option key={selectedTargetNodeId} value={selectedTargetNodeId}>
                                {nodes.find(n => n.id === selectedTargetNodeId)?.title}
                              </option>
                            )}
                          </select>
                          <button
                            onClick={() => {
                              setConnectionPickerActive(!isConnectionPickerActive);
                              // We could potentially keep the menu open or let the effect handle things.
                              // The user asked for a button to click and then "just after that click on any node".
                            }}
                            className={`mt-1 flex items-center justify-center rounded-lg px-2 py-1.5 transition-colors ${isConnectionPickerActive ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-white'}`}
                            title="Pick from graph"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>                      </div>
                      <div className="mb-2">
                        <ColorPicker
                          selectedColor={connectionColor}
                          onChange={setConnectionColor}
                          label="Color"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="text-xs text-zinc-400">Description (optional)</label>
                        <input
                          type="text"
                          value={connectionDescription}
                          onChange={(e) => setConnectionDescription(e.target.value)}
                          placeholder="Describe this connection..."
                          className="mt-1 w-full rounded-lg bg-zinc-700 px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none"
                        />
                      </div>
                      {editingConnectionId ? (
                        <div className="flex gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="flex-1 rounded-lg bg-zinc-700 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-600"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleUpdateConnection}
                            className="flex-1 rounded-lg bg-[#355ea1] py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#265fbd]"
                          >
                            Update
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleAddConnection}
                          disabled={!selectedTargetNodeId}
                          className="w-full rounded-lg bg-[#355ea1] py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#265fbd] disabled:opacity-50"
                        >
                          Add Connection
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 space-y-2">
                {nodeConnections.length === 0 ? (
                  <p className="text-xs text-zinc-500">No connections yet</p>
                ) : (
                  nodeConnections.map((link) => {
                    const isSource = link.sourceId === activeNode.id;
                    const connectedNodeId = isSource ? link.targetId : link.sourceId;
                    const connectedNode = nodes.find(n => n.id === connectedNodeId);
                    return (
                      <div
                        key={link.id}
                        className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: link.color || '#355ea1' }}
                          />
                          <span className="text-xs text-zinc-400">{isSource ? 'to' : 'from'}</span>
                          <span className="truncate text-sm text-white">{connectedNode?.title || 'Unknown'}</span>
                          {link.description && (
                            <span className="truncate text-xs text-zinc-500">({link.description})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditConnection(link)}
                            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-blue-400"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveConnection(link.id)}
                            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-red-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
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
            className="flex items-center gap-2 rounded-lg bg-[#355ea1] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#265fbd] disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {isDirty && !showUnsavedPopup && !isConnectionPickerActive && (
        <div
          className="fixed inset-0 z-40 cursor-pointer"
          onClick={() => setShowUnsavedPopup(true)}
          title="You have unsaved changes"
        />
      )}

      {showUnsavedPopup && (
        <div className="fixed bottom-4 left-4 z-[60] w-80 rounded-lg border border-red-500/20 bg-zinc-900 p-4 shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-200">
          <p className="text-sm font-medium text-zinc-200 mb-4">
            Do you want to leave unsaved changes?
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDiscardAndClose}
              className="flex-1 rounded-md bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/20"
            >
              Yes
            </button>
            <button
              onClick={() => setShowUnsavedPopup(false)}
              className="flex-1 rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              No
            </button>
          </div>
        </div>
      )}
    </>
  );
}
