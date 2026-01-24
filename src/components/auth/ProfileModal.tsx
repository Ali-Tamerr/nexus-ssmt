'use client';

import { useState, useEffect } from 'react';
import { X, User, Lock, Camera, Loader2, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { user, login } = useAuthStore();
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            setDisplayName(user.displayName || '');
            setAvatarUrl(user.avatarUrl || '');
            setIsEditing(false);
        }
    }, [isOpen, user]);

    if (!isOpen || !user) return null;

    const handleUpdate = async () => {
        setIsLoading(true);
        try {
            const updatedUser = await api.profiles.update(user.id, {
                displayName,
                avatarUrl,
            });
            login(updatedUser);
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update profile:', error);
            // In a real app we'd show a toast error here
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="mb-6 text-center">
                    <div className="relative mx-auto mb-4 h-24 w-24 group">
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt="Profile"
                                className="h-full w-full rounded-full object-cover ring-4 ring-zinc-800"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-800 text-3xl font-bold text-zinc-400">
                                {displayName ? displayName.charAt(0).toUpperCase() : <User className="h-10 w-10" />}
                            </div>
                        )}
                        {isEditing && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <Camera className="h-6 w-6 text-white" />
                            </div>
                        )}
                    </div>

                    {!isEditing && (
                        <>
                            <h2 className="text-2xl font-bold text-white">{user.displayName || 'User'}</h2>
                            <div className="mt-1 flex items-center justify-center gap-2 text-sm text-zinc-400">
                                <Mail className="h-3.5 w-3.5" />
                                <span>{user.email}</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="space-y-4">
                    {isEditing ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Display Name</label>
                                <input
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full rounded-lg bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-700 transition-all focus:ring-blue-500"
                                    placeholder="Your Name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Avatar URL</label>
                                <input
                                    value={avatarUrl}
                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                    className="w-full rounded-lg bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-700 transition-all focus:ring-blue-500"
                                    placeholder="https://example.com/photo.jpg"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-800/30 p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full bg-zinc-800 p-2.5 text-zinc-400 group-hover:text-blue-400 transition-colors">
                                    <Lock className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">Password</p>
                                    <p className="text-xs text-zinc-500">*************</p>
                                </div>
                            </div>
                            <button className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors border border-zinc-700">
                                Change
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex justify-end pt-4 border-t border-zinc-800/50">
                    {isEditing ? (
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdate}
                                disabled={isLoading}
                                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
                        >
                            Edit Profile
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
