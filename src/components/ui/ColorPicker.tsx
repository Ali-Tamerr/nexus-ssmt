'use client';

interface ColorPickerProps {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({ colors, value, onChange, label }: ColorPickerProps) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          {label}
        </label>
      )}
      <div className="flex gap-2 flex-wrap">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`
              h-8 w-8 rounded-lg transition-all
              ${value === color
                ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110'
                : 'hover:scale-110'
              }
            `}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}
