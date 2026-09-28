'use client';

import { useRef, useEffect } from 'react';
import type { DrawingPoint, DrawingStroke } from '@/hooks/useGestureDrawing';
import { DrawingGesture } from '@/constants/gestures';

type GestureDrawingOverlayProps = {
  cursorPosition: DrawingPoint | null;
  strokes: DrawingStroke[];
  isDrawing: boolean;
  currentGesture: DrawingGesture | null;
  width: number;
  height: number;
};

export default function GestureDrawingOverlay({
  cursorPosition,
  strokes,
  isDrawing,
  currentGesture,
  width,
  height,
}: GestureDrawingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokes) {
      if (stroke.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(stroke[0].x * width, stroke[0].y * height);

      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x * width, stroke[i].y * height);
      }

      ctx.stroke();
    }

    if (cursorPosition) {
      const x = cursorPosition.x * width;
      const y = cursorPosition.y * height;

      ctx.beginPath();
      ctx.arc(x, y, isDrawing ? 8 : 12, 0, Math.PI * 2);
      ctx.fillStyle = isDrawing
        ? 'rgba(59, 130, 246, 0.8)'
        : 'rgba(255, 255, 255, 0.6)';
      ctx.fill();

      ctx.strokeStyle = isDrawing ? '#2563eb' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (currentGesture === DrawingGesture.Fist) {
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }, [cursorPosition, strokes, isDrawing, currentGesture, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  );
}
