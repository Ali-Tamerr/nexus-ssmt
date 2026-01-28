'use client';

import { useState, useRef, useEffect } from 'react';
import { X, User, Camera, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/utils/errorUtils';

export type ModalMode = 'edit_profile' | 'change_password';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: ModalMode;
}

import { useToast } from '@/context/ToastContext';

export function ProfileModal({ isOpen, onClose, initialMode = 'edit_profile' }: ProfileModalProps) {
    const { user, login } = useAuthStore();
    const { showToast } = useToast();
    const [mode, setMode] = useState<ModalMode>(initialMode);
    const [isLoading, setIsLoading] = useState(false);

    // Edit Profile State
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');

    // Change Password State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && user) {
            setDisplayName(user.displayName || '');
            setEmail(user.email || '');
            setAvatarUrl(user.avatarUrl || '');
            if (initialMode) setMode(initialMode);
            setNewPassword('');
            setConfirmPassword('');
        }
    }, [isOpen, user, initialMode]);

    if (!isOpen || !user) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                showToast('File size too large (max 5MB)', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpdateProfile = async () => {
        setIsLoading(true);
        try {
            const payload = {
                id: user.id,
                email: email || user.email || '',
                displayName,
                avatarUrl,
            };
            const response = await api.profiles.update(user.id, payload);

            // Safe merge in case API returns empty (204) or partial
            const mergedUser = {
                ...user,
                ...payload,
                ...(response || {})
            };

            login(mergedUser);
            onClose();
        } catch (error) {
            showToast(getFriendlyErrorMessage(error), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                id: user.id,
                email: user.email || '',
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                password: newPassword
            };

            const response = await api.profiles.update(user.id, payload as any);

            // Safe merge
            const mergedUser = {
                ...user,
                ...payload,
                ...(response || {})
            };
            // Don't store password in local user object usually, but spread might include it. 
            // It's harmless in memory usually, but cleaner to remove it.
            if ('password' in mergedUser) delete (mergedUser as any).password;

            login(mergedUser);
            showToast('Password updated successfully', 'success');
            onClose();
        } catch (error) {
            showToast(getFriendlyErrorMessage(error), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const renderContent = () => {
        switch (mode) {
            case 'change_password':
                return (
                    <div className="flex flex-col gap-5">
                        <h3 className="text-lg font-semibold text-white px-1">Change Password</h3>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-medium text-zinc-500 mb-1.5 ml-1">New Password</p>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-sm text-white outline-none ring-1 ring-zinc-700 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
                                />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-zinc-500 mb-1.5 ml-1">Confirm Password</p>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-sm text-white outline-none ring-1 ring-zinc-700 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-2">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-lg border border-zinc-700 bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleChangePassword}
                                disabled={isLoading}
                                className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                Confirm
                            </button>
                        </div>
                    </div>
                );

            case 'edit_profile':
            default:
                return (
                    <div className="flex flex-col gap-6">
                        {/* Avatar Centered */}
                        <div className="flex justify-center py-2">
                            <div
                                className="relative h-24 w-24 cursor-pointer group"
                                onClick={() => fileInputRef.current?.click()}
                                title="Click to change photo"
                            >
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Profile" className="h-full w-full rounded-full object-cover ring-4 ring-zinc-800" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-800 text-3xl font-bold text-zinc-400">
                                        {displayName ? displayName.charAt(0).toUpperCase() : <User className="h-10 w-10" />}
                                    </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                    <Camera className="h-8 w-8 text-white drop-shadow-md" />
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-medium text-zinc-500 mb-1.5 ml-1">Display Name</p>
                                <input
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-sm text-white outline-none ring-1 ring-zinc-700 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
                                    placeholder="Your Name"
                                />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-zinc-500 mb-1.5 ml-1">Email</p>
                                <input
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-sm text-white outline-none ring-1 ring-zinc-700 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-2">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-lg border border-zinc-700 bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateProfile}
                                disabled={isLoading}
                                className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                Confirm
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white z-10"
                >
                    <X className="h-5 w-5" />
                </button>

                {renderContent()}

            </div>
        </div>
    );
}
