'use client';

import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input, TextArea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from '@/components/ui/ColorPicker';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; color: string }) => Promise<void>;
  loading?: boolean;
}

const PROJECT_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', 
  '#EF4444', '#EC4899', '#06B6D4', '#84CC16'
];

export function CreateProjectModal({ isOpen, onClose, onSubmit, loading }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#8B5CF6');

  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
    });

    setName('');
    setDescription('');
    setColor('#8B5CF6');
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setColor('#8B5CF6');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create new project"
      description="Start building your knowledge graph"
    >
      <div className="space-y-4">
        <Input
          label="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Knowledge Graph"
          autoFocus
        />

        <TextArea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of your project..."
          rows={3}
        />

        <ColorPicker
          label="Color"
          colors={PROJECT_COLORS}
          value={color}
          onChange={setColor}
        />
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="success"
          onClick={handleSubmit}
          disabled={!name.trim()}
          loading={loading}
          icon={<Plus className="h-4 w-4" />}
        >
          Create project
        </Button>
      </div>
    </Modal>
  );
}
