'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

import { Project } from '@/types/knowledge';

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { name: string; description?: string; projectIds: number[] }) => Promise<void>;
    loading?: boolean;
    availableProjects: Project[];
    initialData?: {
        name: string;
        description?: string;
        projectIds: number[];
    };
}

export function CreateGroupModal({ isOpen, onClose, onSubmit, loading, availableProjects, initialData }: CreateGroupModalProps) {
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set(initialData?.projectIds || []));

    // Reset state when opening/closing or changing mode
    useEffect(() => {
        if (isOpen) {
            setName(initialData?.name || '');
            setDescription(initialData?.description || '');
            setSelectedProjects(new Set(initialData?.projectIds || []));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    console.log('[Modal] initialData.projectIds:', initialData?.projectIds, 'selectedProjects:', Array.from(selectedProjects), 'availableProject IDs:', availableProjects.map(p => ({ id: p.id, type: typeof p.id })));

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        await onSubmit({ name, description, projectIds: Array.from(selectedProjects) });
        // Don't reset here as it might be used for editing, let onClose handle it or unmount
    };

    const toggleProject = (id: number) => {
        const newSelected = new Set(selectedProjects);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedProjects(newSelected);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="mb-6 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-xl font-semibold text-white">
                        {initialData ? 'Edit Collection' : 'Create Collection'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="name" className="text-sm font-medium text-zinc-300">
                                    Collection Name
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Q1 Research"
                                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-[#355ea1] focus:outline-none"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="description" className="text-sm font-medium text-zinc-300">
                                    Description (Optional)
                                </label>
                                <textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="What is this collection about?"
                                    rows={3}
                                    className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-[#355ea1] focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium text-zinc-300">
                                Select Projects
                            </label>

                            {availableProjects.length === 0 ? (
                                <p className="text-sm text-zinc-500 italic">No projects available.</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                                    {availableProjects.map((project) => (
                                        <div
                                            key={project.id}
                                            onClick={() => toggleProject(project.id)}
                                            className={`
                                                cursor-pointer rounded-lg border p-3 flex items-start gap-3 transition-all
                                                ${selectedProjects.has(project.id)
                                                    ? 'bg-[#355ea1]/10 border-[#355ea1] ring-1 ring-[#355ea1]'
                                                    : 'bg-zinc-800/50 border-zinc-800 hover:border-zinc-700'
                                                }
                                            `}
                                        >
                                            <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selectedProjects.has(project.id) ? 'bg-[#355ea1] border-[#355ea1]' : 'border-zinc-600 bg-zinc-900'}`}>
                                                {selectedProjects.has(project.id) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-white line-clamp-1">{project.name}</h4>
                                                {project.description && (
                                                    <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{project.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-zinc-500 text-right">
                                {selectedProjects.size} project{selectedProjects.size !== 1 && 's'} selected
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!name.trim() || loading}
                                className="flex items-center gap-2 rounded-lg bg-[#355ea1] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB] disabled:opacity-50"
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {initialData ? 'Save Changes' : 'Create Collection'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
