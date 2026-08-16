'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { LiveActionItem } from '@/hooks/useLiveActionItems';
import ActionItemCard from './ActionItemCard';
import type { ActionItemActionHandlers } from './ActionItemCard';
import { ParticipantOption } from '@/hooks/useMeetingParticipants';

const SOFT_GLASS_SURFACE =
  'border border-white/15 backdrop-blur-xl backdrop-saturate-125';
const SOFT_GLASS_BACKGROUND = {
  backgroundColor: 'rgba(7,10,15,0.75)',
  backgroundImage:
    'linear-gradient(145deg,rgba(255,255,255,0.03),transparent 20%)',
};
const DEFAULT_DRAG_OFFSET = { x: 0, y: 0 };
const DRAG_MARGIN = 16;

type Point = { x: number; y: number };
type DragBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};
type DragState = {
  pointerId: number;
  pointerStart: Point;
  offsetStart: Point;
  bounds: DragBounds;
};

export function clampDragOffset(
  start: Point,
  movement: Point,
  bounds: DragBounds,
): Point {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, start.x + movement.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, start.y + movement.y)),
  };
}

type ActionItemSidebarProps = ActionItemActionHandlers & {
  open: boolean;
  chatOpen: boolean;
  isLoading: boolean;
  error: string | null;
  unreadCount: number;
  items: LiveActionItem[];
  onCollapse: () => void;
  onExpand: () => void;
  children?: ReactNode;
  participants?: ParticipantOption[];
};

export default function ActionItemSidebar({
  open,
  chatOpen,
  isLoading,
  error,
  unreadCount,
  items,
  onCollapse,
  onExpand,
  onAccept,
  onEdit,
  onDismiss,
  onAssign,
  participants,
  children,
}: ActionItemSidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>(DEFAULT_DRAG_OFFSET);
  const [acceptedOpen, setAcceptedOpen] = useState(false);
  const suggestions = items.filter((item) => item.status === 'suggested');
  const acceptedItems = items.filter((item) => item.status === 'accepted');
  const right = chatOpen ? 'calc(clamp(200px, 55ch, 60ch) + 1rem)' : '1rem';
  const launcherLabel =
    unreadCount > 0
      ? `Open action items, ${unreadCount} unread suggestion${unreadCount === 1 ? '' : 's'}`
      : 'Open action items';

  useEffect(() => {
    const resetPosition = () => setDragOffset(DEFAULT_DRAG_OFFSET);

    resetPosition();
    window.addEventListener('resize', resetPosition);
    return () => window.removeEventListener('resize', resetPosition);
  }, [chatOpen]);

  function handleDragStart(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) {
      return;
    }

    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const rect = sidebar.getBoundingClientRect();
    const minY = dragOffset.y + DRAG_MARGIN - rect.top;
    const maxY = Math.max(
      minY,
      dragOffset.y + window.innerHeight - DRAG_MARGIN - rect.bottom,
    );

    dragStateRef.current = {
      pointerId: event.pointerId,
      pointerStart: { x: event.clientX, y: event.clientY },
      offsetStart: dragOffset,
      bounds: {
        minX: Math.min(0, dragOffset.x + DRAG_MARGIN - rect.left),
        maxX: 0,
        minY,
        maxY,
      },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handleDragMove(event: ReactPointerEvent<HTMLElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    setDragOffset(
      clampDragOffset(
        dragState.offsetStart,
        {
          x: event.clientX - dragState.pointerStart.x,
          y: event.clientY - dragState.pointerStart.y,
        },
        dragState.bounds,
      ),
    );
  }

  function handleDragEnd(event: ReactPointerEvent<HTMLElement>) {
    if (dragStateRef.current?.pointerId !== event.pointerId) return;

    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          className={`${SOFT_GLASS_SURFACE} text-neutral-100 fixed top-4 z-50 flex items-center gap-2 rounded-xl px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.10)] transition-[right] duration-200`}
          style={{ ...SOFT_GLASS_BACKGROUND, right }}
          onClick={onExpand}
          aria-label={launcherLabel}
        >
          Action items
          {unreadCount > 0 && (
            <span
              className="bg-primary-500 text-neutral-950 grid min-w-5 place-items-center rounded-full px-1.5 text-xs font-bold"
              data-unread-count={unreadCount}
              aria-hidden="true"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      <aside
        ref={sidebarRef}
        className={`${SOFT_GLASS_SURFACE} fixed top-4 z-50 flex h-[min(680px,calc(100vh-6rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl shadow-[0_18px_44px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.10)] transition-[right,transform,opacity] duration-200 ${
          open
            ? 'translate-x-0 opacity-100'
            : 'pointer-events-none translate-x-[calc(100%+2rem)] opacity-0'
        }`}
        style={{
          ...SOFT_GLASS_BACKGROUND,
          right,
          translate: `${dragOffset.x}px ${dragOffset.y}px`,
        }}
        data-open={open}
        data-chat-open={chatOpen}
        aria-label="Action items"
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <header
          className="flex touch-none cursor-grab select-none items-start justify-between border-b border-white/10 bg-white/[0.015] p-4 active:cursor-grabbing"
          data-drag-handle="true"
          title="Drag to move action items"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          onLostPointerCapture={() => {
            dragStateRef.current = null;
          }}
        >
          <div>
            <div
              className="text-neutral-100 text-base font-bold"
              role="heading"
              aria-level={2}
            >
              Action items
            </div>
            <div className="text-neutral-400 mt-1 flex items-center gap-1.5 text-xs">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isLoading ? 'bg-primary-500 animate-pulse' : 'bg-primary-300'
                }`}
                aria-hidden="true"
              />
              <span>{isLoading ? 'Checking' : 'Listening'}</span>
            </div>
          </div>

          <button
            type="button"
            className="text-neutral-400 hover:text-neutral-100 grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-white/15 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] hover:bg-white/10"
            onClick={onCollapse}
            aria-label="Collapse action items"
            title="Collapse action items"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              {'>'}
            </span>
          </button>
        </header>

        {error && (
          <div
            className="mx-4 mt-3 rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs text-red-200"
            role="status"
          >
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {children ?? (
            <div className="flex flex-col gap-4">
              {suggestions.length > 0 ? (
                <section aria-labelledby="suggested-action-items">
                  <div className="text-neutral-400 mb-3 flex items-center justify-between text-xs">
                    <h3
                      id="suggested-action-items"
                      className="font-bold uppercase tracking-wider"
                    >
                      Suggestions
                    </h3>
                    <span>{suggestions.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {suggestions.map((item) => (
                      <ActionItemCard
                        key={item.id}
                        item={item}
                        onAccept={onAccept}
                        onEdit={onEdit}
                        onDismiss={onDismiss}
                        participants={participants}
                        onAssign={onAssign}
                      />
                    ))}
                  </div>
                </section>
              ) : (
                <div className="text-neutral-400 flex min-h-36 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-center">
                  <p className="text-sm">No new action items yet</p>
                </div>
              )}

              {acceptedItems.length > 0 && (
                <section className="border-t border-white/10 pt-3">
                  <button
                    type="button"
                    className="text-neutral-300 hover:text-neutral-100 flex w-full items-center justify-between rounded-lg px-1 py-2 text-xs"
                    onClick={() => setAcceptedOpen((current) => !current)}
                    aria-expanded={acceptedOpen}
                    aria-controls="accepted-action-items"
                  >
                    <span className="flex items-center gap-2 font-bold uppercase tracking-wider">
                      Accepted
                      <span className="text-neutral-400 font-normal">
                        {acceptedItems.length}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-base">
                      {acceptedOpen ? '^' : 'v'}
                    </span>
                  </button>
                  <div
                    id="accepted-action-items"
                    className="mt-2 flex flex-col gap-2"
                    hidden={!acceptedOpen}
                  >
                    {acceptedItems.map((item) => (
                      <ActionItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
