'use client';

import { X, Link2, FileText, Image, Video, Paperclip } from 'lucide-react';
import { useGraphStore } from '@/store/useGraphStore';
import { Node, Link as LinkType } from '@/types/knowledge';

interface NodePreviewPaneContentProps {
    activeNode: Node;
    nodes: Node[];
    links: LinkType[];
    onClose: () => void;
}

export function NodePreviewPaneContent({ activeNode, nodes, links, onClose }: NodePreviewPaneContentProps) {
        console.log('[NodeEditPanelDebug]', { nodeId: activeNode.id, title: activeNode.title, customColor: activeNode.customColor, color: activeNode.color });
    const attachments = activeNode.attachments || [];
    const nodeConnections = links.filter(l => l.sourceId === activeNode.id || l.targetId === activeNode.id);

    const getConnectedNode = (link: typeof nodeConnections[0]) => {
        const connectedId = link.sourceId === activeNode.id ? link.targetId : link.sourceId;
        return nodes.find(n => n.id === connectedId);
    };

    const getAttachmentIcon = (contentType: string) => {
        if (contentType.startsWith('image/')) return <Image className="h-4 w-4" />;
        if (contentType.startsWith('video/')) return <Video className="h-4 w-4" />;
        if (contentType === 'text/html') return <Link2 className="h-4 w-4" />;
        return <FileText className="h-4 w-4" />;
    };

    return (
        <div className="fixed right-0 top-0 z-30 flex h-full w-96 flex-col border-l border-zinc-800 bg-zinc-900/95 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <h2 className="text-sm font-semibold text-white">Node Details</h2>
                <button
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-bold text-white">{activeNode.title}</h3>
                        {activeNode.content && (
                            <p className="mt-2 text-sm text-zinc-400 whitespace-pre-wrap">{activeNode.content}</p>
                        )}
                        {!activeNode.content && (
                            <p className="mt-2 text-sm text-zinc-500 italic">No description</p>
                        )}
                    </div>

                    {attachments.length > 0 && (
                        <div>
                            <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
                                <Paperclip className="h-4 w-4" />
                                Attachments ({attachments.length})
                            </h4>
                            <div className="space-y-2">
                                {attachments.map((attachment) => (
                                    <a
                                        key={attachment.id}
                                        href={attachment.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                                    >
                                        {getAttachmentIcon(attachment.contentType)}
                                        <span className="flex-1 truncate">{attachment.fileName}</span>
                                        <Link2 className="h-3.5 w-3.5 text-zinc-500" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {nodeConnections.length > 0 && (
                        <div>
                            <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
                                <Link2 className="h-4 w-4" />
                                Connections ({nodeConnections.length})
                            </h4>
                            <div className="space-y-2">
                                {nodeConnections.map((link) => {
                                    const connectedNode = getConnectedNode(link);
                                    const isOutgoing = link.sourceId === activeNode.id;

                                    return (
                                        <div
                                            key={link.id}
                                            className="rounded-lg bg-zinc-800/50 p-3"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="h-2 w-2 rounded-full"
                                                    style={{ backgroundColor: link.color || '#3B82F6' }}
                                                />
                                                <span className="text-xs text-zinc-500">
                                                    {isOutgoing ? 'To' : 'From'}
                                                </span>
                                                <span className="text-sm font-medium text-white">
                                                    {connectedNode?.title || 'Unknown Node'}
                                                </span>
                                            </div>
                                            {link.description && (
                                                <p className="mt-2 text-sm text-zinc-400 pl-4 border-l-2 border-zinc-700">
                                                    {link.description}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {attachments.length === 0 && nodeConnections.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-sm text-zinc-500">No attachments or connections</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function NodePreviewPane() {
    const { activeNode, setActiveNode, nodes, links } = useGraphStore();
    const isEditorOpen = useGraphStore(state => state.isEditorOpen);
    const toggleEditor = useGraphStore(state => state.toggleEditor);

    if (!isEditorOpen || !activeNode) return null;

    const handleClose = () => {
        setActiveNode(null);
        toggleEditor(false);
    };

    return (
        <NodePreviewPaneContent
            activeNode={activeNode}
            nodes={nodes}
            links={links}
            onClose={handleClose}
        />
    );
}
