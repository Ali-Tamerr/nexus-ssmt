'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { COLOR_PALETTE } from '@/types/knowledge';

interface ColorPickerProps {
  selectedColor: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({ selectedColor, onChange, label }: ColorPickerProps) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customColor, setCustomColor] = useState(selectedColor);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCustomPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    onChange(color);
  };

  const isColorInPalette = COLOR_PALETTE.includes(selectedColor);

  return (
    <div className="space-y-2">
      {label && <label className="text-xs text-zinc-500">{label}</label>}
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`w-6 h-6 rounded-md border-2 transition-all ${selectedColor === color
              ? 'border-white scale-110'
              : 'border-zinc-700 hover:border-zinc-500'
              }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}

        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowCustomPicker(!showCustomPicker)}
            className={`w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center ${!isColorInPalette
              ? 'border-white scale-110'
              : 'border-zinc-700 hover:border-zinc-500'
              }`}
            style={{
              backgroundColor: !isColorInPalette ? selectedColor : 'transparent',
              position: 'relative'
            }}
            title="Custom color"
          >
            {isColorInPalette && <Plus className="h-3.5 w-3.5 text-zinc-400" />}
          </button>

          {showCustomPicker && (
            <div className="absolute left-0 top-8 z-50 rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-xl w-48">
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Color Picker</label>
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => handleCustomColorChange(e.target.value)}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Hex Code</label>
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                        setCustomColor(value);
                        if (value.length === 7) {
                          onChange(value);
                        }
                      }
                    }}
                    placeholder="#355ea1"
                    className="w-full rounded-lg bg-zinc-700 px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none uppercase"
                    maxLength={7}
                  />
                </div>
                <button
                  onClick={() => setShowCustomPicker(false)}
                  className="w-full mt-2 rounded-lg bg-[#355ea1] py-1.5 text-xs font-medium text-white hover:bg-[#265fbd] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
