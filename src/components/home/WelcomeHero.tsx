'use client';

import Image from 'next/image';
import NexusLogo from '@/assets/Logo/Logo with no circle.svg';

export function WelcomeHero({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  return (
    <div className="flex min-h-[calc(100vh-15rem)] flex-col items-center justify-center">
      <div className="relative mb-4 h-24 w-24">
        <div className="absolute -inset-1 rounded-ful" />
        <Image src={NexusLogo} alt="Nexus Logo" fill className="object-contain" />
      </div>
      <h2 className="text-center text-3xl font-bold text-white">
        Welcome to <span className="font-ka1 text-white font-light">Nexus</span>
      </h2>
      <p className="mt-3 max-w-md text-center text-zinc-400">
        Build and explore interconnected knowledge graphs. Organize your thoughts,
        ideas, and research in a visual, non-linear way.
      </p>
      <div className="mt-8 flex gap-4">
        <button
          onClick={onSignup}
          className="rounded-lg bg-[#355ea1] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#265fbd]"
        >
          Create free account
        </button>
        <button
          onClick={onLogin}
          className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
