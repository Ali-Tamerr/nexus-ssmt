'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Link2, QrCode, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
}

export function ShareModal({ isOpen, onClose, shareUrl }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'qr'>('link');
  const [qrSize, setQrSize] = useState(200);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted on client before using portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate max QR size based on viewport
  const getMaxQrSize = useCallback(() => {
    if (typeof window !== 'undefined') {
      return Math.min(window.innerHeight - 200, window.innerWidth - 100);
    }
    return 600;
  }, []);

  const [maxQrSize, setMaxQrSize] = useState(600);

  useEffect(() => {
    const updateMaxSize = () => {
      setMaxQrSize(getMaxQrSize());
    };

    updateMaxSize();
    window.addEventListener('resize', updateMaxSize);
    return () => window.removeEventListener('resize', updateMaxSize);
  }, [getMaxQrSize]);

  // Handle fullscreen toggle
  useEffect(() => {
    if (isFullscreen) {
      setQrSize(maxQrSize);
    } else {
      setQrSize(200);
    }
  }, [isFullscreen, maxQrSize]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, isFullscreen, onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={isFullscreen ? () => setIsFullscreen(false) : onClose}
      />

      {/* Modal */}
      <div
        className={`relative z-10 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl transition-all duration-300 ${isFullscreen
          ? 'w-auto h-auto p-8'
          : 'w-full max-w-md p-6 mx-4'
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Share Project</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setActiveTab('link');
              setIsFullscreen(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'link'
              ? 'bg-[#355ea1] text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
          >
            <Link2 className="h-4 w-4" />
            <span>Link</span>
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'qr'
              ? 'bg-[#355ea1] text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
          >
            <QrCode className="h-4 w-4" />
            <span>QR Code</span>
          </button>
        </div>

        {/* Content */}
        {activeTab === 'link' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Share this link with others to let them view your project:
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 bg-zinc-800 rounded-lg border border-zinc-700 text-sm text-zinc-300 truncate">
                {shareUrl}
              </div>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${copied
                  ? 'bg-green-600 text-white'
                  : 'bg-[#355ea1] text-white hover:bg-[#2563EB]'
                  }`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">
                Scan this QR code to access the project:
              </p>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen QR code'}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5" />
                    <span>Minimize</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>Fullscreen</span>
                  </>
                )}
              </button>
            </div>

            {/* QR Code Display */}
            <div className="flex flex-col items-center gap-4">
              <div
                className="bg-white p-4 rounded-xl transition-all duration-300"
                style={{ width: qrSize + 32, height: qrSize + 32 }}
              >
                <QRCodeSVG
                  value={shareUrl}
                  size={qrSize}
                  level="H"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>

              {/* Size Slider */}
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Size</span>
                  <span>{qrSize}px</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max={maxQrSize}
                  value={qrSize}
                  onChange={(e) => {
                    setQrSize(Number(e.target.value));
                    if (Number(e.target.value) < maxQrSize * 0.9) {
                      setIsFullscreen(false);
                    }
                  }}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#355ea1] 
                    [&::-webkit-slider-thumb]:appearance-none 
                    [&::-webkit-slider-thumb]:w-4 
                    [&::-webkit-slider-thumb]:h-4 
                    [&::-webkit-slider-thumb]:bg-[#355ea1] 
                    [&::-webkit-slider-thumb]:rounded-full 
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:transition-all
                    [&::-webkit-slider-thumb]:hover:bg-[#2563EB]
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-moz-range-thumb]:w-4 
                    [&::-moz-range-thumb]:h-4 
                    [&::-moz-range-thumb]:bg-[#355ea1] 
                    [&::-moz-range-thumb]:rounded-full 
                    [&::-moz-range-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:border-0"
                />
                <div className="flex items-center justify-between text-xs text-zinc-600">
                  <span>Small</span>
                  <span>Large</span>
                </div>
              </div>
            </div>

            {/* Copy button for QR tab too */}
            <div className="pt-2 border-t border-zinc-800">
              <button
                onClick={handleCopy}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${copied
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                  }`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
