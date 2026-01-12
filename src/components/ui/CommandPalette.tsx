'use client';

import { useEffect, useState, useRef } from 'react';
import { Search, Plus, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { useGraphStore } from '@/store/useGraphStore';
import { Node } from '@/types/knowledge';
import { api } from '@/lib/api';

export function CommandPalette() {
  const isOpen = useGraphStore((s) => s.isCommandPaletteOpen);
  const toggleCommandPalette = useGraphStore((s) => s.toggleCommandPalette);
  const nodes = useGraphStore((s) => s.nodes);
  const addNode = useGraphStore((s) => s.addNode);
  const setActiveNode = useGraphStore((s) => s.setActiveNode);
  const currentProject = useGraphStore((s) => s.currentProject);
  const currentUserId = useGraphStore((s) => s.currentUserId);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredNodes = nodes.filter((n) =>
    n.title.toLowerCase().includes(query.toLowerCase()) ||
    n.content?.toLowerCase().includes(query.toLowerCase())
  );

  const showCreateOption = query.trim().length > 0 && !filteredNodes.some(
    (n) => n.title.toLowerCase() === query.toLowerCase()
  );

  const totalItems = filteredNodes.length + (showCreateOption ? 1 : 0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }

      if (!isOpen) return;

      if (e.key === 'Escape') {
        toggleCommandPalette(false);
        setQuery('');
        setSelectedIndex(0);
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % totalItems);
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + totalItems) % totalItems);
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (showCreateOption && selectedIndex === 0) {
          handleCreateNode();
        } else {
          const nodeIndex = showCreateOption ? selectedIndex - 1 : selectedIndex;
          if (filteredNodes[nodeIndex]) {
            handleSelectNode(filteredNodes[nodeIndex]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, query, selectedIndex, filteredNodes, showCreateOption, totalItems, toggleCommandPalette]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleCreateNode = async () => {
    if (!query.trim() || !currentProject) return;

    setIsCreating(true);
    try {
      const newNode = await api.nodes.create({
        title: query.trim(),
        content: '',
        projectId: currentProject.id,
        groupId: Math.floor(Math.random() * 8),
        userId: currentUserId || undefined,
      });

      addNode(newNode);
      setActiveNode(newNode);
      toggleCommandPalette(false);
      setQuery('');
      setSelectedIndex(0);
    } catch (err) {
      console.error('Failed to create node:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectNode = (node: Node) => {
    setActiveNode(node);
    toggleCommandPalette(false);
    setQuery('');
    setSelectedIndex(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          toggleCommandPalette(false);
          setQuery('');
          setSelectedIndex(0);
        }}
      />

      <div className="relative w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <Search className="h-5 w-5 text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes or create new..."
            className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none"
          />
          <kbd className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {showCreateOption && (
            <button
              onClick={handleCreateNode}
              disabled={isCreating}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${selectedIndex === 0 ? 'bg-[#3B82F6] text-white' : 'text-zinc-300 hover:bg-zinc-800'
                }`}
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>Create "{query}"</span>
              <ArrowRight className="ml-auto h-4 w-4 opacity-50" />
            </button>
          )}

          {filteredNodes.length > 0 ? (
            <div className={showCreateOption ? 'mt-1 border-t border-zinc-800 pt-1' : ''}>
              {filteredNodes.map((node, index) => {
                const itemIndex = showCreateOption ? index + 1 : index;
                return (
                  <button
                    key={node.id}
                    onClick={() => handleSelectNode(node)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${selectedIndex === itemIndex
                        ? 'bg-[#3B82F6] text-white'
                        : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                  >
                    <FileText className="h-4 w-4" />
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate font-medium">{node.title}</p>
                      {node.content && (
                        <p className={`truncate text-xs ${selectedIndex === itemIndex ? 'text-white/70' : 'text-zinc-500'}`}>
                          {node.content.substring(0, 100)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : !showCreateOption && (
            <div className="py-8 text-center text-sm text-zinc-500">
              No nodes found. Type to create a new one.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5">↵</kbd> Select
            </span>
          </div>
          <span>{filteredNodes.length} nodes</span>
        </div>
      </div>
    </div>
  );
}
