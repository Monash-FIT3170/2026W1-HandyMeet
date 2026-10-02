'use client';

import '@livekit/components-styles';
import { useRoomContext, useTranscriptions } from '@livekit/components-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import type { CaptionSettings } from './TranscriptionSettings';
import { useGestureCaptions } from '@/hooks/useGestureCaptions';

type Point = { x: number; y: number };
type DragState = {
  pointerId: number;
  pointerStart: Point;
  offsetStart: Point;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

const DRAG_MARGIN = 16;
const CONTROL_BAR_HEIGHT = 64;
const DEFAULT_DRAG_OFFSET = { x: 0, y: 0 };

type Props = {
  settings: CaptionSettings;
  position?: 'default' | 'whiteboard';
};

export default function Captions({ settings, position = 'default' }: Props) {
  const [expandCaptions, setExpandCaptions] = useState(false);
  const captionRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>(DEFAULT_DRAG_OFFSET);

  useEffect(() => {
    const resetPosition = () => {
      dragStateRef.current = null;
      setDragOffset(DEFAULT_DRAG_OFFSET);
    };
    resetPosition();
    window.addEventListener('resize', resetPosition);
    return () => window.removeEventListener('resize', resetPosition);
  }, [position]);

  // Check that caption box is in the boundary when expanded
  useLayoutEffect(() => {
    const keepInBounds = () => {
      const box = captionRef.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const right = window.innerWidth - DRAG_MARGIN;
      const bottom = window.innerHeight - CONTROL_BAR_HEIGHT - DRAG_MARGIN;
      const dx =
        rect.left < DRAG_MARGIN
          ? DRAG_MARGIN - rect.left
          : Math.min(0, right - rect.right);
      const dy =
        rect.top < DRAG_MARGIN
          ? DRAG_MARGIN - rect.top
          : Math.min(0, bottom - rect.bottom);
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      dragStateRef.current = null;
      setDragOffset((offset) => ({ x: offset.x + dx, y: offset.y + dy }));
    };
    keepInBounds();
  });

  function handleDragStart(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as Element).closest('button')) {
      return;
    }
    const box = captionRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const minX = dragOffset.x + DRAG_MARGIN - rect.left;
    const minY = dragOffset.y + DRAG_MARGIN - rect.top;
    dragStateRef.current = {
      pointerId: event.pointerId,
      pointerStart: { x: event.clientX, y: event.clientY },
      offsetStart: dragOffset,
      bounds: {
        minX,
        maxX: Math.max(
          minX,
          dragOffset.x + window.innerWidth - DRAG_MARGIN - rect.right,
        ),
        minY,
        maxY: Math.max(
          minY,
          dragOffset.y +
            window.innerHeight -
            CONTROL_BAR_HEIGHT -
            DRAG_MARGIN -
            rect.bottom,
        ),
      },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handleDragMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDragOffset({
      x: Math.min(
        drag.bounds.maxX,
        Math.max(
          drag.bounds.minX,
          drag.offsetStart.x + event.clientX - drag.pointerStart.x,
        ),
      ),
      y: Math.min(
        drag.bounds.maxY,
        Math.max(
          drag.bounds.minY,
          drag.offsetStart.y + event.clientY - drag.pointerStart.y,
        ),
      ),
    });
  }

  function handleDragEnd(event: PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current?.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const dragHandleProps = {
    'data-drag-handle': true,
    title: 'Drag to move captions',
    onPointerDown: handleDragStart,
    onPointerMove: handleDragMove,
    onPointerUp: handleDragEnd,
    onPointerCancel: handleDragEnd,
    onLostPointerCapture: () => {
      dragStateRef.current = null;
    },
  };
  const dragHandle = (
    <div
      {...dragHandleProps}
      className="mr-auto flex h-6 w-6 shrink-0 touch-none cursor-grab select-none items-center justify-center rounded bg-black/20 text-white/90 hover:bg-black/50 active:cursor-grabbing"
      aria-label="Drag to move captions"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 122.88 122.88"
        width="16"
        height="16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M30.73,70.08h0V81.63A4.43,4.43,0,0,1,29,85.39a4.85,4.85,0,0,1-4.36.19,1.53,1.53,0,0,1-.52-.28C15.43,78.51,10.42,71.73,1.76,64.93l-.12-.1a4.32,4.32,0,0,1,0-6.78l.12-.1c8.66-6.8,13.67-13.59,22.33-20.37a1.75,1.75,0,0,1,.52-.29,4.82,4.82,0,0,1,4.35.2,4.41,4.41,0,0,1,1.77,3.76V52.8H52.88V30.73H41.25A4.43,4.43,0,0,1,37.49,29a4.85,4.85,0,0,1-.2-4.36,1.75,1.75,0,0,1,.29-.52C44.37,15.43,51.15,10.42,58,1.76l.1-.12a4.32,4.32,0,0,1,6.78,0l.1.12c6.8,8.66,13.58,13.67,20.37,22.33a1.53,1.53,0,0,1,.28.52A4.82,4.82,0,0,1,85.39,29a4.41,4.41,0,0,1-3.76,1.77H70V52.8H92.15V41.25a4.43,4.43,0,0,1,1.76-3.76,4.85,4.85,0,0,1,4.36-.2,1.88,1.88,0,0,1,.52.29c8.66,6.78,13.67,13.57,22.33,20.37l.12.1a4.32,4.32,0,0,1,0,6.78l-.12.1c-8.66,6.8-13.67,13.58-22.33,20.37a1.63,1.63,0,0,1-.52.28,4.85,4.85,0,0,1-4.36-.19,4.43,4.43,0,0,1-1.76-3.76V70.08H70V92.15H81.63a4.43,4.43,0,0,1,3.76,1.76,4.85,4.85,0,0,1,.19,4.36,1.63,1.63,0,0,1-.28.52c-6.79,8.66-13.57,13.67-20.37,22.33l-.1.12a4.32,4.32,0,0,1-6.78,0l-.1-.12c-6.8-8.66-13.58-13.67-20.37-22.33a1.88,1.88,0,0,1-.29-.52,4.85,4.85,0,0,1,.2-4.36,4.43,4.43,0,0,1,3.76-1.76H52.88V70.08Z" />
      </svg>
    </div>
  );
  const dragStyle = {
    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
  };

  const room = useRoomContext();
  const { gestureCaptions } = useGestureCaptions(room);

  const transcriptions = useTranscriptions();

  const captions = [
    ...transcriptions.slice(expandCaptions ? -8 : -2),
    ...gestureCaptions,
  ];

  const style =
    position === 'whiteboard'
      ? 'z-[100] w-[500px] max-w-[calc(100vw-2rem)] fixed left-[calc(((100vw-320px)/2)-60px)] -translate-x-1/2 bottom-30'
      : 'z-[100] w-[500px] max-w-[calc(100vw-2rem)] fixed left-1/2 -translate-x-1/2 bottom-20';

  if (!captions.length) {
    return null;
  }

  if (!settings.visible) {
    return;
  }

  return (
    <div ref={captionRef} className={style} style={dragStyle}>
      <div className="flex gap-2 w-full mb-2 self-start items-center px-1">
        {dragHandle}
        <button
          onClick={() => setExpandCaptions(!expandCaptions)}
          className="px-2 h-6 flex items-center justify-center rounded bg-black/20 text-[13px] font-bold tracking-wider hover:bg-black/50 transition text-white/90"
        >
          {expandCaptions ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <div
        className={`flex max-h-[calc(100dvh-128px)] flex-col gap-2 overflow-y-auto text-center rounded-lg px-3 py-2 ${expandCaptions ? 'h-64 overflow-y-auto' : 'h-auto'}`}
        style={{ backgroundColor: settings.bgColor }}
      >
        {captions.map((caption, index) => {
          const isLatest = index === captions.length - 1;
          return (
            <div
              key={index}
              className={`animate-in fade-in duration-300 ${isLatest ? 'font-bold' : 'opacity-60'}`}
              style={{
                fontSize: `${settings.fontSize}px`,
                color: settings.textColor,
              }}
            >
              <span>
                {caption.participantInfo?.identity ?? 'Unknown'}: {caption.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
