'use client';

import 'tldraw/tldraw.css';
import { useState, useRef, useEffect, useCallback } from 'react';
import { DefaultStylePanel, Tldraw, Editor } from 'tldraw';
import GestureDrawingOverlay from '@/components/GestureDrawingOverlay';
import {
  useGestureDrawing,
  type DrawingStroke,
} from '@/hooks/useGestureDrawing';
import { DrawingGesture } from '@/constants/gestures';
import { addStrokeToTldraw } from '@/helpers/gestures/strokeToTldraw';

interface WhiteboardProps {
  isOpen: boolean;
  onClose: () => void;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraEnabled: boolean;
}

export default function Whiteboard({
  isOpen,
  onClose,
  localVideoRef,
  isCameraEnabled,
}: WhiteboardProps) {
  const [gestureDrawingEnabled, setGestureDrawingEnabled] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

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

  const handleStrokeComplete = useCallback(
    (stroke: DrawingStroke) => {
      if (editorRef.current && stroke.length >= 2) {
        addStrokeToTldraw(
          editorRef.current,
          stroke,
          containerSize.width,
          containerSize.height,
        );
      }
      setCurrentStroke([]);
    },
    [containerSize.width, containerSize.height],
  );

  const handleStrokeUpdate = useCallback((stroke: DrawingStroke) => {
    setCurrentStroke(stroke);
  }, []);

  const { isDrawing, cursorPosition, currentGesture } = useGestureDrawing({
    videoRef: localVideoRef,
    enabled: isOpen && gestureDrawingEnabled && isCameraEnabled,
    onStrokeComplete: handleStrokeComplete,
    onStrokeUpdate: handleStrokeUpdate,
  });

  const handleToggleGestureDrawing = useCallback(() => {
    setGestureDrawingEnabled((prev) => !prev);
    setCurrentStroke([]);
  }, []);

  const handleEditorMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-0 z-50 bg-neutral-950 flex flex-col overflow-hidden">
      <div className="h-[45px] flex items-center justify-between px-4 bg-neutral-900 border-b border-neutral-800 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleGestureDrawing}
            className={`text-xs px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-2 ${
              gestureDrawingEnabled
                ? isCameraEnabled
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
            }`}
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
            {gestureDrawingEnabled ? 'Gesture Draw: ON' : 'Gesture Draw'}
          </button>

          {gestureDrawingEnabled && isCameraEnabled && (
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
                  Saved to canvas
                </span>
              )}
              {!currentGesture && cursorPosition && (
                <span className="text-neutral-500">Point finger to draw</span>
              )}
            </div>
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
            onMount={handleEditorMount}
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

        {gestureDrawingEnabled && isCameraEnabled && (
          <GestureDrawingOverlay
            cursorPosition={cursorPosition}
            strokes={currentStroke.length > 0 ? [currentStroke] : []}
            isDrawing={isDrawing}
            currentGesture={currentGesture}
            width={containerSize.width}
            height={containerSize.height}
          />
        )}

        {gestureDrawingEnabled && !isCameraEnabled && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/90 backdrop-blur-sm rounded-lg px-4 py-3 text-sm text-black flex items-center gap-3 shadow-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.5 22H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10" />
              <circle cx="12" cy="11" r="3" />
              <path d="m17 17 5 5m-5 0 5-5" />
            </svg>
            <span className="font-medium">
              Camera is off — turn on your camera to use gesture drawing
            </span>
          </div>
        )}

        {gestureDrawingEnabled && isCameraEnabled && (
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
