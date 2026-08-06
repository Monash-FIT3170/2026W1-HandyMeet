'use client';

import { useEffect, useRef, useState } from 'react';
import { cleanTranscriptLines } from '@/helpers/transcript';

export type LiveActionItem = {
  task: string;
  owner: string | null;
};

const POLL_INTERVAL_MS = 12000;

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
  const lastSentTranscriptRef = useRef('');
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      if (isFetchingRef.current) return;

      const transcript = cleanTranscriptLines(transcriptLinesRef.current).join(
        '\n',
      );

      if (!transcript || transcript === lastSentTranscriptRef.current) return;

      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/live-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        });

        if (!response.ok) {
          throw new Error(`Live insights request failed (${response.status})`);
        }

        const data = await response.json();
        setActionItems(Array.isArray(data.actionItems) ? data.actionItems : []);
        lastSentTranscriptRef.current = transcript;
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
