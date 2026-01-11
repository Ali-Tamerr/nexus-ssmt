'use client';

import { Lock, Unlock, Snowflake, Flame } from 'lucide-react';
import { GraphSettings } from '@/types/knowledge';

interface GraphControlsProps {
  settings: GraphSettings;
  onSettingsChange: (settings: Partial<GraphSettings>) => void;
}

export function GraphControls({ settings, onSettingsChange }: GraphControlsProps) {
  return (
    <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl bg-zinc-900/90 p-2 backdrop-blur-sm border border-zinc-800">
      <FreezeControl
        enabled={settings.freezeOthersOnDrag}
        onToggle={() => onSettingsChange({ freezeOthersOnDrag: !settings.freezeOthersOnDrag })}
      />

      <div className="h-6 w-px bg-zinc-700" />

      <LockControl
        enabled={settings.lockAllMovement}
        onToggle={() => onSettingsChange({ lockAllMovement: !settings.lockAllMovement })}
      />
    </div>
  );
}

interface FreezeControlProps {
  enabled: boolean;
  onToggle: () => void;
}

function FreezeControl({ enabled, onToggle }: FreezeControlProps) {
  return (
    <div className="flex items-center gap-2 px-2">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
          enabled
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-800 text-zinc-400 hover:text-white'
        }`}
        title="When enabled, other nodes stay in place when you drag one node"
      >
        {enabled ? (
          <Snowflake className="h-3.5 w-3.5" />
        ) : (
          <Flame className="h-3.5 w-3.5" />
        )}
        <span>Freeze Others</span>
      </button>
    </div>
  );
}

interface LockControlProps {
  enabled: boolean;
  onToggle: () => void;
}

function LockControl({ enabled, onToggle }: LockControlProps) {
  return (
    <div className="flex items-center gap-2 px-2">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
          enabled
            ? 'bg-red-600 text-white'
            : 'bg-zinc-800 text-zinc-400 hover:text-white'
        }`}
        title="When enabled, all nodes are locked and cannot be moved"
      >
        {enabled ? (
          <Lock className="h-3.5 w-3.5" />
        ) : (
          <Unlock className="h-3.5 w-3.5" />
        )}
        <span>Lock All</span>
      </button>
    </div>
  );
}
