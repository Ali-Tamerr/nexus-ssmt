'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X, GripVertical, Check } from 'lucide-react';

export interface Group {
    id: number;
    name: string;
    color: string;
    order: number;
}

interface GroupsTabsProps {
    groups: Group[];
    activeGroupId: number | null;
    onSelectGroup: (groupId: number) => void;
    onAddGroup: () => void;
    onRenameGroup: (groupId: number, newName: string) => void;
    onDeleteGroup: (groupId: number) => void;
    onReorderGroups: (groups: Group[]) => void;
}

const DEFAULT_COLORS = [
    '#8B5CF6', '#355ea1', '#10B981', '#F59E0B',
    '#EF4444', '#EC4899', '#06B6D4', '#84CC16'
];

export function GroupsTabs({
    groups,
    activeGroupId,
    onSelectGroup,
    onAddGroup,
    onRenameGroup,
    onDeleteGroup,
    onReorderGroups,
}: GroupsTabsProps) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const [draggedId, setDraggedId] = useState<number | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingId]);

    const handleStartEdit = (group: Group) => {
        setEditingId(group.id);
        setEditValue(group.name);
    };

    const handleSaveEdit = () => {
        if (editingId && editValue.trim()) {
            onRenameGroup(editingId, editValue.trim());
        }
        setEditingId(null);
        setEditValue('');
    };

    const handleDragStart = (e: React.DragEvent, groupId: number) => {
        setDraggedId(groupId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, groupId: number) => {
        e.preventDefault();
        if (draggedId !== groupId) {
            setDragOverId(groupId);
        }
    };

    const handleDragEnd = () => {
        if (draggedId && dragOverId && draggedId !== dragOverId) {
            const newGroups = [...groups];
            const draggedIndex = newGroups.findIndex(g => g.id === draggedId);
            const dropIndex = newGroups.findIndex(g => g.id === dragOverId);

            const [draggedGroup] = newGroups.splice(draggedIndex, 1);
            newGroups.splice(dropIndex, 0, draggedGroup);

            const reorderedGroups = newGroups.map((g, i) => ({ ...g, order: i }));
            onReorderGroups(reorderedGroups);
        }
        setDraggedId(null);
        setDragOverId(null);
    };

    const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

    return (

        <div className="absolute bottom-4 left-4 flex items-center gap-1 max-w-[60%] overflow-x-auto">
            {sortedGroups.map((group) => (
                <div
                    key={group.id}
                    draggable={editingId !== group.id}
                    onDragStart={(e) => handleDragStart(e, group.id)}
                    onDragOver={(e) => handleDragOver(e, group.id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs backdrop-blur-sm border cursor-pointer group transition-all ${activeGroupId === group.id
                        ? 'bg-zinc-700/80 border-zinc-600 text-white'
                        : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-300'
                        } ${dragOverId === group.id ? 'border-blue-500' : ''}`}
                    onClick={() => !editingId && onSelectGroup(group.id)}
                    onDoubleClick={() => handleStartEdit(group)}
                >
                    <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-50 cursor-grab" />

                    {editingId === group.id ? (
                        <input
                            ref={inputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') {
                                    setEditingId(null);
                                    setEditValue('');
                                }
                            }}
                            className="bg-transparent border-none outline-none text-white text-xs w-20"
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span className="truncate max-w-24">{group.name}</span>
                    )}

                    {sortedGroups.length > 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteGroup(group.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-600/50 transition-all"
                            title="Delete group"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            ))}

            <button
                onClick={onAddGroup}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs bg-zinc-800/40 border border-dashed border-zinc-700 text-zinc-500 hover:bg-zinc-700/60 hover:text-zinc-300 hover:border-zinc-600 transition-all"
                title="Add new group"
            >
                <Plus className="w-3 h-3" />
            </button>
        </div>
    );
}

// Ensure new groups always get a unique id
let nextGroupId = 1;
export function getNextGroupColor(existingGroups: Group[]): string {
    const usedColors = new Set(existingGroups.map(g => g.color));
    // Find max id to ensure uniqueness
    const maxId = existingGroups.reduce((max, g) => Math.max(max, g.id), 0);
    nextGroupId = maxId + 1;
    return DEFAULT_COLORS.find(c => !usedColors.has(c)) || DEFAULT_COLORS[existingGroups.length % DEFAULT_COLORS.length];
}
