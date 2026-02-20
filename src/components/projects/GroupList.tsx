'use client';

import { ProjectCollection } from '@/types/knowledge';
import { Folder, Trash2, Share2, Pencil, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShareModal } from '@/components/ui/ShareModal';

interface GroupListProps {
    groups: ProjectCollection[];
    onDelete: (group: ProjectCollection) => void;
    onEdit: (group: ProjectCollection) => void;
    viewMode: 'grid' | 'list';
}

export function GroupList({ groups, onDelete, onEdit, viewMode }: GroupListProps) {
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const router = useRouter();
    const isListView = viewMode === 'list';

    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Folder className="h-16 w-16 text-zinc-700" />
                <p className="mt-4 text-lg text-zinc-400">No collections found</p>
                <p className="text-sm text-zinc-500">Create a collection to make a group with your projects</p>
            </div>
        );
    }

    const handleShare = (e: React.MouseEvent, group: ProjectCollection) => {
        e.preventDefault();
        e.stopPropagation();
        const url = `${window.location.origin}/collections/${group.id}/preview`;
        setShareUrl(url);
    };

    const handleOpenGroup = (group: ProjectCollection) => {
        router.push(`/collections/${group.id}/preview`);
    };

    return (
        <>
            <div className={
                viewMode === 'grid'
                    ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
                    : 'flex flex-col gap-3'
            }>
                {groups.filter(g => g && g.id).map((group) => (
                    <div
                        key={group.id}
                        onClick={() => handleOpenGroup(group)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleOpenGroup(group);
                            }
                        }}
                        className={`
                            group relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left 
                            transition-all cursor-pointer
                            hover:border-zinc-700 hover:bg-zinc-900
                            flex items-center justify-between ${!isListView ? 'sm:block' : ''}
                        `}
                    >
                        <div className="flex max-sm:flex-col h-24 gap-4 sm:flex-col justify-between">
                            <div className="flex flex-col items-start gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-full flex-shrink-0 bg-[#355ea1]" />
                                    <h3 className="font-semibold text-white group-hover:text-[#355ea1] transition-colors">
                                        {group.name}
                                    </h3>
                                    <ChevronRight className="h-5 w-5 -ml-1 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400" />
                                </div>
                                {group.description && (
                                    <p className="mt-1 text-sm text-zinc-500 line-clamp-2">
                                        {group.description}
                                    </p>
                                )}
                            </div>

                            <div className="flex max-sm:self-start items-center gap-3 text-xs text-zinc-500">
                                <span>{group.items?.length || group.projects?.length || 0} Projects</span>
                                <span className="text-zinc-600">
                                    {group.updatedAt && !isNaN(new Date(group.updatedAt).getTime())
                                        ? new Date(group.updatedAt).toLocaleDateString()
                                        : ''}
                                </span>
                                <button
                                    onClick={(e) => handleShare(e, group)}
                                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 transition-colors"
                                    title="Share Collection"
                                    type="button"
                                >
                                    <Share2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onEdit(group);
                                    }}
                                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                    title="Edit Collection"
                                    type="button"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onDelete(group);
                                    }}
                                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
                                    title="Delete Collection"
                                    type="button"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <ShareModal
                isOpen={!!shareUrl}
                onClose={() => setShareUrl(null)}
                shareUrl={shareUrl || ''}
            />
        </>
    );
}
