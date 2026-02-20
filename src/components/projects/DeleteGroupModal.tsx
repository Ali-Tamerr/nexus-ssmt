'use client';

import { X, Loader2 } from 'lucide-react';
import { ProjectCollection } from '@/types/knowledge';

interface DeleteGroupModalProps {
    group: ProjectCollection;
    isOpen: boolean;
    onClose: () => void;
    onDelete: (withProjects: boolean) => Promise<void>;
    loading?: boolean;
}

export function DeleteGroupModal({ group, isOpen, onClose, onDelete, loading }: DeleteGroupModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">Delete Collection</h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        disabled={loading}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <p className="mb-6 text-zinc-400">
                    You are about to delete <strong>{group.name}</strong>.
                    <br />
                    There are {group.projects?.length || 0} projects in this collection.
                </p>

                <div className="space-y-3">
                    <button
                        onClick={() => onDelete(true)}
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/20 disabled:opacity-50 border border-red-500/20"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Delete Collection AND Projects
                    </button>

                    <button
                        onClick={() => onDelete(false)}
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 border border-zinc-700"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Delete Collection Only (Keep Projects)
                    </button>

                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
