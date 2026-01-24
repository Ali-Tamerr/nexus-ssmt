'use client';

import { DrawingTool, COLOR_PALETTE } from '@/types/knowledge';
import { ColorPicker } from '@/components/ui/ColorPicker';

interface DrawingPropertiesProps {
    activeTool: DrawingTool;
    strokeWidth: number;
    strokeColor: string;
    strokeStyle: 'solid' | 'dashed' | 'dotted';
    fontSize: number;
    fontFamily: string;
    onStrokeWidthChange: (width: number) => void;
    onStrokeColorChange: (color: string) => void;
    onStrokeStyleChange: (style: 'solid' | 'dashed' | 'dotted') => void;
    onFontSizeChange: (size: number) => void;
    onFontFamilyChange: (family: string) => void;
}

const widths = [1, 2, 3, 5, 8];
const fontSizes = [12, 16, 20, 24, 32];
const fonts = [
    { id: 'Inter', label: 'Inter' },
    { id: 'Georgia', label: 'Georgia' },
];

const isDrawingTool = (tool: DrawingTool) =>
    ['pen', 'rectangle', 'diamond', 'circle', 'arrow', 'line'].includes(tool);

const isTextTool = (tool: DrawingTool) => tool === 'text';

export function DrawingProperties({
    activeTool,
    strokeWidth,
    strokeColor,
    strokeStyle,
    fontSize,
    fontFamily,
    onStrokeWidthChange,
    onStrokeColorChange,
    onStrokeStyleChange,
    onFontSizeChange,
    onFontFamilyChange,
}: DrawingPropertiesProps) {
    const showDrawingProps = isDrawingTool(activeTool);
    const showTextProps = isTextTool(activeTool);

    if (!showDrawingProps && !showTextProps) {
        return null;
    }

    return (
        <div className="absolute left-4 top-4 z-30 flex flex-col gap-3 rounded-xl bg-zinc-900/90 p-3 backdrop-blur-sm border border-zinc-800 min-w-[180px]">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                {showTextProps ? 'Text Properties' : 'Properties'}
            </div>

            <ColorPicker
                selectedColor={strokeColor}
                onChange={onStrokeColorChange}
                label="Color"
            />

            {showTextProps && (
                <>
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500">Font</label>
                        <div className="flex gap-1">
                            {fonts.map((font) => (
                                <button
                                    key={font.id}
                                    onClick={() => onFontFamilyChange(font.id)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${fontFamily === font.id
                                        ? 'bg-[#355ea1] text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                        }`}
                                    style={{ fontFamily: font.id }}
                                >
                                    {font.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500">Size</label>
                        <div className="flex gap-1">
                            {fontSizes.map((size) => (
                                <button
                                    key={size}
                                    onClick={() => onFontSizeChange(size)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${fontSize === size
                                        ? 'bg-[#355ea1] text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {showDrawingProps && (
                <>
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500">Stroke Width</label>
                        <div className="flex gap-1">
                            {widths.map((w) => (
                                <button
                                    key={w}
                                    onClick={() => onStrokeWidthChange(w)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${strokeWidth === w
                                        ? 'bg-[#355ea1] text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    {w}px
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500">Style</label>
                        <div className="flex gap-1">
                            <button
                                onClick={() => onStrokeStyleChange('solid')}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${strokeStyle === 'solid'
                                    ? 'bg-[#355ea1] text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                    }`}
                            >
                                ━━━
                            </button>
                            <button
                                onClick={() => onStrokeStyleChange('dashed')}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${strokeStyle === 'dashed'
                                    ? 'bg-[#355ea1] text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                    }`}
                            >
                                ┅┅┅
                            </button>
                            <button
                                onClick={() => onStrokeStyleChange('dotted')}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${strokeStyle === 'dotted'
                                    ? 'bg-[#355ea1] text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                    }`}
                            >
                                ┈┈┈
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
