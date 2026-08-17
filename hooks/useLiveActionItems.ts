'use client';

import { useEffect, useRef, useState } from 'react';
import { cleanTranscriptLines } from '@/helpers/transcript';

export type ActionItemStatus = 'suggested' | 'accepted' | 'dismissed';

export type LiveActionItem = {
  id: string;
  task: string;
  owner: string | null;
  dueDate: string | null;
  status: ActionItemStatus;
  assigneeId: string | null;
};

const POLL_INTERVAL_MS = 12000;

// Matches a line ending in sentence terminating punctuation, optionally
// followed by a closing quote/bracket (e.g. `done."` or `right?)`).
const SENTENCE_END_RE = /[.!?][")\]]?$/;

function isLineComplete(line: string): boolean {
  return SENTENCE_END_RE.test(line.trim());
}

function makeId(): string {
  return crypto.randomUUID();
}

type UseLiveActionItemsOptions = {
  transcriptLines: string[];
  enabled?: boolean;
};

export function useLiveActionItems({
  transcriptLines,
  enabled = true,
}: UseLiveActionItemsOptions) {
  const [actionItems, setActionItems] = useState<LiveActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read via ref so the interval doesn't get torn down/recreated on every
  // transcript update (transcriptions stream in far more often than 12s).
  const transcriptLinesRef = useRef(transcriptLines);
  transcriptLinesRef.current = transcriptLines;
  const actionItemsRef = useRef<LiveActionItem[]>([]);
  const isFetchingRef = useRef(false);

  const sentLineCountRef = useRef(0);
  const sentTrailingLineRef = useRef('');

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      if (isFetchingRef.current) return;

      const cleaned = cleanTranscriptLines(transcriptLinesRef.current);
      if (cleaned.length === 0) return;

      const trailingLineRevised =
        sentLineCountRef.current > 0 &&
        cleaned[sentLineCountRef.current - 1] !== sentTrailingLineRef.current;
      const startIndex = trailingLineRevised
        ? sentLineCountRef.current - 1
        : sentLineCountRef.current;

      let delta = cleaned.slice(startIndex);
      if (delta.length === 0) return;

      const trailingIncomplete = !isLineComplete(delta[delta.length - 1]);
      if (trailingIncomplete) {
        delta = delta.slice(0, -1);
      }
      if (delta.length === 0) return;

      const sentUpToIndex = trailingIncomplete
        ? cleaned.length - 1
        : cleaned.length;

      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        // Strip client-only fields before sending back - the
        // prompt only needs task/owner/dueDate to recognise repeats.
        const knownActionItems = actionItemsRef.current.map(
          ({ task, owner, dueDate }) => ({ task, owner, dueDate }),
        );

        const response = await fetch('/api/live-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: delta.join('\n'),
            knownActionItems,
          }),
        });

        if (!response.ok) {
          throw new Error(`Live insights request failed (${response.status})`);
        }

        const data = await response.json();
        const rawNewItems: Array<{
          task: string;
          owner: string | null;
          dueDate: string | null;
        }> = Array.isArray(data.newActionItems) ? data.newActionItems : [];

        if (rawNewItems.length > 0) {
          const newActionItems: LiveActionItem[] = rawNewItems.map((item) => ({
            ...item,
            id: makeId(),
            status: 'suggested',
            assigneeId: null,
          }));

          actionItemsRef.current = [
            ...actionItemsRef.current,
            ...newActionItems,
          ];
          setActionItems(actionItemsRef.current);
        }

        sentLineCountRef.current = sentUpToIndex;
        sentTrailingLineRef.current = cleaned[sentUpToIndex - 1];
      } catch (err) {
        console.error('Live action item extraction failed:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to extract action items.',
        );
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
      }
    };

    // On meeting end, beacon whatever transcript is still unsent (including any
    // unfinished trailing line). sendBeacon survives a hard unload tab close
    // or refresh where a normal fetch and this effect's cleanup never run.
    const flushFinal = () => {
      const cleaned = cleanTranscriptLines(transcriptLinesRef.current);
      if (cleaned.length === 0) return;

      const startIndex =
        sentLineCountRef.current > 0 &&
        cleaned[sentLineCountRef.current - 1] !== sentTrailingLineRef.current
          ? sentLineCountRef.current - 1
          : sentLineCountRef.current;

      const delta = cleaned.slice(startIndex);
      if (delta.length === 0) return;

      const knownActionItems = actionItemsRef.current.map(
        ({ task, owner, dueDate }) => ({ task, owner, dueDate }),
      );
      const body = JSON.stringify({
        transcript: delta.join('\n'),
        knownActionItems,
      });
      navigator.sendBeacon(
        '/api/live-insights',
        new Blob([body], { type: 'application/json' }),
      );
    };

    const intervalId = setInterval(tick, POLL_INTERVAL_MS);
    window.addEventListener('pagehide', flushFinal);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('pagehide', flushFinal);
      flushFinal();
    };
  }, [enabled]);

  function updateItem(id: string, patch: Partial<LiveActionItem>) {
    actionItemsRef.current = actionItemsRef.current.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    setActionItems(actionItemsRef.current);
  }

  function acceptItem(id: string, ownerName?: string) {
    updateItem(id, {
      status: 'accepted',
      ...(ownerName ? { owner: ownerName } : {}),
    });
  }

  function dismissItem(id: string) {
    updateItem(id, { status: 'dismissed' });
  }

  function editItem(
    id: string,
    updates: Partial<Pick<LiveActionItem, 'task' | 'owner' | 'dueDate'>>,
  ) {
    updateItem(id, updates);
  }

  function assignUser(id: string, assigneeId: string | null) {
    updateItem(id, { assigneeId });
  }

  function addTestItem() {
    const testItem: LiveActionItem = {
      id: crypto.randomUUID(),
      task: 'Complete task',
      owner: 'Naveen',
      dueDate: null,
      status: 'suggested',
      assigneeId: null,
    };
    actionItemsRef.current = [...actionItemsRef.current, testItem];
    setActionItems(actionItemsRef.current);
  }

  return {
    actionItems,
    isLoading,
    error,
    acceptItem,
    dismissItem,
    editItem,
    assignUser,
    addTestItem, // remove before merging
  };
}
