'use client';

import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import NextImage from 'next/image';
import NexusLogo from '@/assets/Logo/Logo with no circle.svg';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-16 w-16">

          <NextImage src={NexusLogo} alt="Loading..." fill className="object-contain" priority />
        </div>
        {message && <p className="text-sm text-zinc-400">{message}</p>}
        <div className="h-1 w-24 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return <Loader2 className={`animate-spin text-[#355ea1] ${sizeClasses[size]} ${className}`} />;
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Loading...' }: LoadingOverlayProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-zinc-400">{message}</p>
      </div>
    </div>
  );
}

interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return <div className="min-h-screen bg-zinc-950">{children}</div>;
}
