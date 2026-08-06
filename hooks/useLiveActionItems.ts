'use client';

import { useEffect, useRef, useState } from 'react';
import { cleanTranscriptLines } from '@/helpers/transcript';

export type LiveActionItem = {
  task: string;
  owner: string | null;
  dueDate: string | null;
};

const POLL_INTERVAL_MS = 12000;

// Matches a line ending in sentence terminating punctuation, optionally
// followed by a closing quote/bracket (e.g. `done."` or `right?)`).
const SENTENCE_END_RE = /[.!?][")\]]?$/;

function isLineComplete(line: string): boolean {
  return SENTENCE_END_RE.test(line.trim());
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
        const response = await fetch('/api/live-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: delta.join('\n'),
            knownActionItems: actionItemsRef.current,
          }),
        });

        if (!response.ok) {
          throw new Error(`Live insights request failed (${response.status})`);
        }

        const data = await response.json();
        const newActionItems: LiveActionItem[] = Array.isArray(
          data.newActionItems,
        )
          ? data.newActionItems
          : [];

        if (newActionItems.length > 0) {
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

    const intervalId = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [enabled]);

  return { actionItems, isLoading, error };
}
