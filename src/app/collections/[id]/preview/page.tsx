'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Link2, ExternalLink, Info, X } from 'lucide-react';
import { ProjectCollection, Project, ProjectCollectionItem, Profile } from '@/types/knowledge';
import { api } from '@/lib/api';
import { Navbar } from '@/components/layout';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { useAuthStore } from '@/store/useAuthStore';

export default function CollectionPreviewPage() {
    const params = useParams();
    const router = useRouter();
    const id = Number(params?.id);

    const [collection, setCollection] = useState<ProjectCollection | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [owner, setOwner] = useState<Profile | null>(null);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [projectInfo, setProjectInfo] = useState<Project | null>(null);

    useEffect(() => {
        const fetchCollection = async () => {
            if (!id) return;

            try {
                const data = await api.projectCollections.getById(id);
                setCollection(data);
                // If the backend returns populated projects, use them. 
                // Otherwise we might need to fetch them if only IDs are returned.
                // Assuming backend returns populated projects as per spec:
                if (data.projects) {
                    setProjects(data.projects);
                } else if (data.items) {
                    // Fallback if projects are nested in items
                    setProjects(data.items.map((i: ProjectCollectionItem) => i.project).filter(Boolean) as Project[]);
                }

                // Prefer owner object from collection payload (new backend contract)
                const { user } = useAuthStore.getState();
                if (data.owner) {
                    setOwner(data.owner);
                } else if (data.userId && user?.id === data.userId) {
                    setOwner(user);
                } else {
                    setOwner(null);
                }
            } catch (err) {
                console.error('Failed to fetch collection:', err);
                setError('Failed to load group. It may have been deleted or does not exist.');
            } finally {
                setLoading(false);
            }
        };

        fetchCollection();
    }, [id]);

    const handleProjectClick = (project: Project) => {
        // Open project in preview mode or editor
        // Since this is a public view, maybe open in a read-only preview? 
        // For now, redirect to project preview if possible, or editor.
        // Ideally: /project/[id]/preview
        router.push(`/project/${project.id}/preview`);
    };

    const resolveOwnerDisplayName = (profile: Profile | null): string => {
        if (!profile) return 'Unknown User';

        const emailLocalPart = profile.email?.split('@')[0]?.trim().toLowerCase() || '';
        const candidates = [
            profile.displayName,
            (profile as any).fullName,
            (profile as any).name,
            (profile as any).display_name,
            (profile as any).full_name,
            (profile as any).userMetadata?.full_name,
            (profile as any).userMetadata?.name,
            (profile as any).user_metadata?.full_name,
            (profile as any).user_metadata?.name,
        ]
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter(Boolean);

        const nonEmailLike = candidates.find((value) => {
            if (!emailLocalPart) return true;
            return value.toLowerCase() !== emailLocalPart;
        });

        return nonEmailLike || candidates[0] || 'Unknown User';
    };

    const ownerDisplayName = resolveOwnerDisplayName(owner);

    const ownerInitials = ownerDisplayName
        .split(' ')
        .filter(Boolean)
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
                <Loader2 className="h-8 w-8 animate-spin text-[#355ea1]" />
            </div>
        );
    }

    if (error || !collection) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-zinc-950 text-white">
                <h1 className="text-2xl font-bold">Error</h1>
                <p className="text-zinc-400">{error || 'Group not found'}</p>
                <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-2 text-[#355ea1] hover:underline"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to Home
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950">
            <Navbar showSearch={false}>
                <button
                    onClick={() => router.push('/')}
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                >
                    Back to Dashboard
                </button>
            </Navbar>

            <main className="mx-auto max-w-6xl px-6 py-8">
                <div className="mb-8 space-y-4">
                    <div className="flex items-center gap-3">
                        <Link2 className="h-6 w-6 text-[#355ea1]" />
                        <h1 className="text-3xl font-bold text-white max-w-2xl truncate" title={collection.name}>
                            {collection.name}
                        </h1>
                        <button
                            onClick={() => setShowGroupInfo(true)}
                            className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                            title="View Description"
                        >
                            <Info className="h-5 w-5" />
                        </button>
                    </div>

                    {owner && (
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-zinc-500 text-sm">by</span>
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-[#355ea1]/20 flex items-center justify-center overflow-hidden border border-[#355ea1]/30">
                                    {owner.avatarUrl ? (
                                        <img
                                            src={owner.avatarUrl}
                                            alt={ownerDisplayName}
                                            className="h-full w-full object-cover"
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <span className="text-[10px] font-medium text-[#355ea1]">
                                            {ownerInitials}
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm font-medium text-zinc-200">
                                    {ownerDisplayName}
                                </span>
                            </div>
                        </div>
                    )}

                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            onClick={handleProjectClick}
                            onInfoClick={setProjectInfo}
                            viewMode="grid"
                        // Read only view, no delete/edit
                        />
                    ))}
                </div>

                {projects.length === 0 && (
                    <div className="text-center py-20 text-zinc-500">
                        This group has no projects.
                    </div>
                )}

                {/* Group Info Modal */}
                {showGroupInfo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowGroupInfo(false)} />
                        <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
                            <button
                                onClick={() => setShowGroupInfo(false)}
                                className="absolute top-4 right-4 rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            <h3 className="mb-4 text-xl font-bold text-white pr-8">{collection.name}</h3>
                            <div className="max-h-[60vh] overflow-y-auto">
                                {collection.description ? (
                                    <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{collection.description}</p>
                                ) : (
                                    <p className="text-zinc-500 italic">No description provided.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Project Info Modal */}
                {projectInfo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setProjectInfo(null)} />
                        <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
                            <button
                                onClick={() => setProjectInfo(null)}
                                className="absolute top-4 right-4 rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            <h3 className="mb-4 text-xl font-bold text-white pr-8">{projectInfo.name}</h3>
                            <div className="max-h-[60vh] overflow-y-auto">
                                {projectInfo.description ? (
                                    <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{projectInfo.description}</p>
                                ) : (
                                    <p className="text-zinc-500 italic">No description provided.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
