'use client';

export function WelcomeHero({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative mb-8">
        <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-violet-600/30 to-indigo-600/30 blur-xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600">
          <span className="text-4xl font-bold text-white">N</span>
        </div>
      </div>
      <h2 className="text-3xl font-bold text-white">Welcome to Nexus</h2>
      <p className="mt-3 max-w-md text-center text-zinc-400">
        Build and explore interconnected knowledge graphs. Organize your thoughts, 
        ideas, and research in a visual, non-linear way.
      </p>
      <div className="mt-8 flex gap-4">
        <button
          onClick={onSignup}
          className="rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
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
