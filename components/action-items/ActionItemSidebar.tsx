'use client';

import type { ReactNode } from 'react';
import type { LiveActionItem } from '@/hooks/useLiveActionItems';
import ActionItemCard from './ActionItemCard';

const SOFT_GLASS_SURFACE =
  'border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),transparent_42%),rgba(12,17,25,0.72)] backdrop-blur-xl backdrop-saturate-125';

type ActionItemSidebarProps = {
  open: boolean;
  isLoading: boolean;
  items: LiveActionItem[];
  onCollapse: () => void;
  onExpand: () => void;
  children?: ReactNode;
};

export default function ActionItemSidebar({
  open,
  isLoading,
  items,
  onCollapse,
  onExpand,
  children,
}: ActionItemSidebarProps) {
  const suggestions = items.filter((item) => item.status === 'suggested');

  return (
    <>
      {!open && (
        <button
          type="button"
          className={`${SOFT_GLASS_SURFACE} text-neutral-100 fixed top-4 right-4 z-50 rounded-xl px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.10)]`}
          onClick={onExpand}
          aria-label="Open action items"
        >
          Action items
        </button>
      )}

      <aside
        className={`${SOFT_GLASS_SURFACE} fixed top-4 right-4 bottom-20 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl shadow-[0_18px_44px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.10)] transition-[transform,opacity] duration-200 ${
          open
            ? 'translate-x-0 opacity-100'
            : 'pointer-events-none translate-x-[calc(100%+2rem)] opacity-0'
        }`}
        data-open={open}
        aria-label="Action items"
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <header className="flex items-start justify-between border-b border-white/10 bg-white/[0.015] p-4">
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
            className="text-neutral-400 hover:text-neutral-100 grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] hover:bg-white/10"
            onClick={onCollapse}
            aria-label="Collapse action items"
            title="Collapse action items"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              {'>'}
            </span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {children ??
            (suggestions.length > 0 ? (
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
                    <ActionItemCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ) : (
              <div className="text-neutral-400 flex h-full min-h-36 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-center">
                <p className="text-sm">No new action items yet</p>
              </div>
            ))}
        </div>
      </aside>
    </>
  );
}
