'use client';

import 'tldraw/tldraw.css';
import { useState, useRef, useEffect, useCallback } from 'react';
import { DefaultStylePanel, Tldraw } from 'tldraw';
import GestureDrawingOverlay from '@/components/GestureDrawingOverlay';
import { useGestureDrawing } from '@/hooks/useGestureDrawing';
import { DrawingGesture } from '@/constants/gestures';

interface WhiteboardProps {
  isOpen: boolean;
  onClose: () => void;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function Whiteboard({
  isOpen,
  onClose,
  localVideoRef,
}: WhiteboardProps) {
  const [gestureDrawingEnabled, setGestureDrawingEnabled] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [isOpen]);

  useEffect(() => {
    const checkCamera = () => {
      const video = localVideoRef.current;
      setCameraAvailable(
        !!video && video.readyState >= 2 && video.videoWidth > 0,
      );
    };

    checkCamera();
    const interval = setInterval(checkCamera, 500);
    return () => clearInterval(interval);
  }, [localVideoRef, gestureDrawingEnabled]);

  const { isDrawing, cursorPosition, currentGesture, strokes, clearStrokes } =
    useGestureDrawing({
      videoRef: localVideoRef,
      enabled: gestureDrawingEnabled && cameraAvailable,
    });

  const handleToggleGestureDrawing = useCallback(() => {
    setGestureDrawingEnabled((prev) => !prev);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-0 z-50 bg-neutral-950 flex flex-col overflow-hidden">
      <div className="h-[45px] flex items-center justify-between px-4 bg-neutral-900 border-b border-neutral-800 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleGestureDrawing}
            disabled={!cameraAvailable}
            className={`text-xs px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-2 ${
              !cameraAvailable
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : gestureDrawingEnabled
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
            }`}
            title={
              !cameraAvailable ? 'Enable camera to use gesture drawing' : ''
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" />
              <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
            </svg>
            {!cameraAvailable
              ? 'Camera required'
              : gestureDrawingEnabled
                ? 'Gesture Draw: ON'
                : 'Gesture Draw'}
          </button>

          {gestureDrawingEnabled && cameraAvailable && (
            <>
              <button
                onClick={clearStrokes}
                className="text-xs px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors cursor-pointer"
              >
                Clear Drawing
              </button>

              <div className="flex items-center gap-2 text-xs text-neutral-400">
                {currentGesture === DrawingGesture.Pointing && (
                  <span className="flex items-center gap-1 text-blue-400">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    Drawing...
                  </span>
                )}
                {currentGesture === DrawingGesture.Fist && (
                  <span className="flex items-center gap-1 text-green-400">
                    <span className="w-2 h-2 bg-green-400 rounded-full" />
                    Stroke saved
                  </span>
                )}
                {!currentGesture && cursorPosition && (
                  <span className="text-neutral-500">Point finger to draw</span>
                )}
              </div>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="text-xs px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 w-full overflow-hidden"
      >
        <div
          style={{
            height: '100%',
            width: '100%',
            position: 'absolute',
            inset: 0,
          }}
        >
          <Tldraw
            components={{
              StylePanel: () => (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    marginTop: 4,
                  }}
                >
                  <DefaultStylePanel />
                </div>
              ),
            }}
            autoFocus
          />
        </div>

        {gestureDrawingEnabled && cameraAvailable && (
          <GestureDrawingOverlay
            cursorPosition={cursorPosition}
            strokes={strokes}
            isDrawing={isDrawing}
            currentGesture={currentGesture}
            width={containerSize.width}
            height={containerSize.height}
          />
        )}

        {gestureDrawingEnabled && cameraAvailable && (
          <div className="absolute bottom-4 left-4 bg-neutral-900/90 backdrop-blur-sm rounded-lg p-3 text-xs text-neutral-300 max-w-[200px] border border-neutral-700">
            <p className="font-semibold mb-2 text-white">Gesture Controls</p>
            <div className="space-y-1">
              <p className="flex items-center gap-2">
                <span className="text-blue-400">Point finger</span>
                <span className="text-neutral-500">= Draw</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-green-400">Make fist</span>
                <span className="text-neutral-500">= Save stroke</span>
              </p>
            </div>
            <p className="mt-2 text-neutral-500 text-[10px]">
              Using meeting camera for tracking
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
