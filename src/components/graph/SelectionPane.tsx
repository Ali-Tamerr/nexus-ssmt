'use client';

import { useState } from 'react';
import { X, Layers, Circle, Square, Diamond, Minus, ArrowRight, Type, PenTool, ChevronDown, ChevronRight, MapPin, Trash2 } from 'lucide-react';
import { DrawnShape, Node as NodeType } from '@/types/knowledge';

interface SelectionPaneProps {
    nodes: NodeType[];
    shapes: DrawnShape[];
    onLocateNode: (nodeId: string, x: number, y: number) => void;
    onLocateShape: (shapeId: string, x: number, y: number) => void;
    onSelectNode: (nodeId: string) => void;
    onSelectShape: (shapeId: string) => void;
    onDeleteNode: (nodeId: string) => void;
    onDeleteShape: (shapeId: string) => void;
    selectedNodeIds: Set<string>;
    selectedShapeIds: Set<string>;
    onClose: () => void;
    isPreviewMode?: boolean;
}

function getShapeIcon(type: string) {
    switch (type) {
        case 'rectangle':
            return <Square className="w-4 h-4" />;
        case 'circle':
            return <Circle className="w-4 h-4" />;
        case 'diamond':
            return <Diamond className="w-4 h-4" />;
        case 'line':
            return <Minus className="w-4 h-4" />;
        case 'arrow':
            return <ArrowRight className="w-4 h-4" />;
        case 'text':
            return <Type className="w-4 h-4" />;
        case 'pen':
            return <PenTool className="w-4 h-4" />;
        default:
            return <Square className="w-4 h-4" />;
    }
}

function getShapeCenter(shape: DrawnShape): { x: number; y: number } {
    if (shape.points.length === 0) return { x: 0, y: 0 };

    const sumX = shape.points.reduce((acc, p) => acc + p.x, 0);
    const sumY = shape.points.reduce((acc, p) => acc + p.y, 0);

    return {
        x: sumX / shape.points.length,
        y: sumY / shape.points.length,
    };
}

function getShapeName(shape: DrawnShape): string {
    if (shape.type === 'text' && shape.text) {
        return shape.text.length > 20 ? shape.text.substring(0, 20) + '...' : shape.text;
    }
    return shape.type.charAt(0).toUpperCase() + shape.type.slice(1);
}

export function SelectionPane({
    nodes,
    shapes,
    onLocateNode,
    onLocateShape,
    onSelectNode,
    onSelectShape,
    onDeleteNode,
    onDeleteShape,
    selectedNodeIds,
    selectedShapeIds,
    onClose,
    isPreviewMode = false,
}: SelectionPaneProps) {
    const [nodesExpanded, setNodesExpanded] = useState(true);
    const [shapesExpanded, setShapesExpanded] = useState(true);

    return (
        <div className="absolute right-4 bottom-16 z-40 w-56 max-h-80 rounded-xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-sm shadow-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-zinc-400" />
                    <h3 className="text-sm font-semibold text-white">Selection Pane</h3>
                </div>
                <button
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                <div className="mb-2">
                    <button
                        onClick={() => setNodesExpanded(!nodesExpanded)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-zinc-300 hover:bg-zinc-800"
                    >
                        {nodesExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <Circle className="w-4 h-4 text-blue-400" />
                        <span>Nodes ({nodes.length})</span>
                    </button>

                    {nodesExpanded && (
                        <div className="mt-1 space-y-1 pl-4">
                            {nodes.length === 0 ? (
                                <div className="px-2 py-2 text-xs text-zinc-500 italic">No nodes</div>
                            ) : (
                                nodes.map((node) => (
                                    <div
                                        key={node.id}
                                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer group ${selectedNodeIds.has(node.id)
                                            ? 'bg-blue-600/20 text-white'
                                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                            }`}
                                        onClick={() => onSelectNode(node.id)}
                                    >
                                        <span
                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: node.customColor || '#355ea1' }}
                                        />
                                        <span className="flex-1 truncate">{node.title || 'Untitled Node'}</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onLocateNode(node.id, node.x ?? 0, node.y ?? 0);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700 transition-all"
                                            title="Locate"
                                        >
                                            <MapPin className="w-3.5 h-3.5" />
                                        </button>
                                        {!isPreviewMode && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteNode(node.id);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-600 transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <button
                        onClick={() => setShapesExpanded(!shapesExpanded)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-zinc-300 hover:bg-zinc-800"
                    >
                        {shapesExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <PenTool className="w-4 h-4 text-purple-400" />
                        <span>Drawings ({shapes.length})</span>
                    </button>

                    {shapesExpanded && (
                        <div className="mt-1 space-y-1 pl-4">
                            {shapes.length === 0 ? (
                                <div className="px-2 py-2 text-xs text-zinc-500 italic">No drawings</div>
                            ) : (
                                shapes.map((shape) => {
                                    const center = getShapeCenter(shape);
                                    return (
                                        <div
                                            key={shape.id}
                                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer group ${selectedShapeIds.has(shape.id)
                                                ? 'bg-purple-600/20 text-white'
                                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                                }`}
                                            onClick={() => onSelectShape(shape.id)}
                                        >
                                            <span style={{ color: shape.color }}>
                                                {getShapeIcon(shape.type)}
                                            </span>
                                            <span className="flex-1 truncate">{getShapeName(shape)}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onLocateShape(shape.id, center.x, center.y);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700 transition-all"
                                                title="Locate"
                                            >
                                                <MapPin className="w-3.5 h-3.5" />
                                            </button>
                                            {!isPreviewMode && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteShape(shape.id);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-600 transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-zinc-700 px-4 py-2">
                <div className="text-xs text-zinc-500">
                    {nodes.length + shapes.length} objects total
                </div>
            </div>
        </div>
    );
}
