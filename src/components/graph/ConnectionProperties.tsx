'use client';

import { useState } from 'react';
import { X, Pencil, Trash2 } from 'lucide-react';
import { Link } from '@/types/knowledge';
import { useGraphStore } from '@/store/useGraphStore';
import { api } from '@/lib/api';
import { ColorPicker } from '@/components/ui/ColorPicker';

interface ConnectionPropertiesProps {
    link: Link | null;
    onClose: () => void;
}

export function ConnectionProperties({ link, onClose }: ConnectionPropertiesProps) {
    const nodes = useGraphStore((s) => s.nodes);
    const deleteLink = useGraphStore((s) => s.deleteLink);
    const addLink = useGraphStore((s) => s.addLink);

    const [isEditing, setIsEditing] = useState(false);
    const [description, setDescription] = useState(link?.description || '');
    const [color, setColor] = useState(link?.color || '#355ea1');

    if (!link) return null;

    const sourceNode = nodes.find(n => n.id === link.sourceId);
    const targetNode = nodes.find(n => n.id === link.targetId);

    const handleDelete = async () => {
        if (!confirm('Delete this connection?')) return;
        try {
            await api.links.delete(link.id);
            deleteLink(link.id);
            onClose();
        } catch (err) {
            console.error('Failed to delete connection:', err);
        }
    };

    const handleUpdate = async () => {
        try {
            const updatedLink = await api.links.update(link.id, {
                id: link.id,
                sourceId: link.sourceId,
                targetId: link.targetId,
                color: color,
                description: description.trim() || undefined,
                userId: link.userId,
            });

            deleteLink(link.id);
            addLink(updatedLink);
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to update connection:', err);
        }
    };

    const handleCancel = () => {
        setDescription(link.description || '');
        setColor(link.color || '#355ea1');
        setIsEditing(false);
    };

    return (
        <div className="absolute left-4 top-4 z-30 flex flex-col gap-3 rounded-xl bg-zinc-900/90 p-3 backdrop-blur-sm border border-zinc-800 min-w-[280px] max-w-[320px]">
            <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                    Connection
                </div>
                <div className="flex items-center gap-1">
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-blue-400 transition-colors"
                            title="Edit"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button
                        onClick={handleDelete}
                        className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                        title="Close"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-xs text-zinc-500">From</label>
                    <div className="text-sm text-white bg-zinc-800/50 rounded-lg px-3 py-2">
                        {sourceNode?.title || 'Unknown'}
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs text-zinc-500">To</label>
                    <div className="text-sm text-white bg-zinc-800/50 rounded-lg px-3 py-2">
                        {targetNode?.title || 'Unknown'}
                    </div>
                </div>

                <div className="space-y-1">
                    {isEditing ? (
                        <ColorPicker
                            selectedColor={color}
                            onChange={setColor}
                            label="Color"
                        />
                    ) : (
                        <>
                            <label className="text-xs text-zinc-500">Color</label>
                            <div className="text-sm text-white bg-zinc-800/50 rounded-lg px-3 py-2 flex items-center gap-2">
                                <span
                                    className="h-3 w-3 rounded"
                                    style={{ backgroundColor: link.color }}
                                />
                                <span>{link.color}</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Description</label>
                    {isEditing ? (
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe this connection..."
                            className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none"
                        />
                    ) : (
                        <div className="text-sm text-white bg-zinc-800/50 rounded-lg px-3 py-2 min-h-[36px]">
                            {link.description || <span className="text-zinc-500">No description</span>}
                        </div>
                    )}
                </div>

                {isEditing && (
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={handleCancel}
                            className="flex-1 rounded-lg bg-zinc-800 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpdate}
                            className="flex-1 rounded-lg bg-[#355ea1] py-2 text-sm font-medium text-white hover:bg-[#265fbd] transition-colors"
                        >
                            Update
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
