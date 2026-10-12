'use client';

import { useEffect, useRef } from 'react';
import type { HelpContext } from '@/constants/featureHelp';
import FeatureGuide from './FeatureGuide';

export default function HelpDialog({
  context,
  onClose,
}: {
  context: HelpContext;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.showModal();
    titleRef.current?.focus();
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [context]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="meeting-help-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, video[controls], [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (element) =>
            element.getClientRects().length > 0 &&
            (!element.closest('details:not([open])') ||
              element.tagName === 'SUMMARY'),
        );
        const first = controls[0];
        const last = controls.at(-1);
        const active = document.activeElement;
        if (!first || !last) {
          event.preventDefault();
          titleRef.current?.focus();
        } else if (
          event.shiftKey &&
          (active === first || active === titleRef.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(56rem,calc(100%-2rem))] max-w-none overflow-hidden rounded-2xl border border-neutral-600 bg-neutral-900 p-0 text-neutral-100 shadow-2xl backdrop:bg-black/70"
    >
      <div className="flex items-start justify-between gap-4 border-b border-neutral-800 px-5 py-4 sm:px-6">
        <div>
          <h1
            ref={titleRef}
            id="meeting-help-title"
            tabIndex={-1}
            className="text-xl font-semibold focus:outline-none"
          >
            {context === 'whiteboard' ? 'Whiteboard help' : 'Meeting help'}
          </h1>
          <p className="mt-1 text-sm text-neutral-200">
            {context === 'whiteboard'
              ? 'Drawing, gesture controls, and sharing your canvas.'
              : 'Choose a task for steps, expected results, and troubleshooting.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-600 focus-visible:outline-2 focus-visible:outline-primary-500"
        >
          Close help
        </button>
      </div>
      <div className="max-h-[calc(90dvh-7rem)] overflow-y-auto p-5 sm:p-6">
        <FeatureGuide idPrefix="meeting-help" variant={context} />
        {context === 'meeting' && (
          <a
            href="/help"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block rounded text-sm text-primary-200 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary-500"
          >
            Open the full guide in a new tab
          </a>
        )}
      </div>
    </dialog>
  );
}
