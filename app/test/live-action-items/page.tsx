'use client';

import { useState } from 'react';
import ActionItemSidebar from '@/components/action-items/ActionItemSidebar';
import { useLiveActionItems } from '@/hooks/useLiveActionItems';

const TEST_TRANSCRIPT = "Param: I'll prepare the release notes.";

export default function LiveActionItemsTestPage() {
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const liveActionItems = useLiveActionItems({
    transcriptLines,
    enabled: true,
  });

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-lg font-bold">Live action items test playground</h1>
      <button
        type="button"
        className="mt-4 rounded-lg border border-white/15 px-3 py-2 text-sm"
        onClick={() => setTranscriptLines([TEST_TRANSCRIPT])}
        disabled={transcriptLines.length > 0}
      >
        Add completed transcript line
      </button>

      <ActionItemSidebar
        open
        chatOpen={false}
        isLoading={liveActionItems.isLoading}
        error={liveActionItems.error}
        unreadCount={0}
        items={liveActionItems.actionItems}
        onCollapse={() => undefined}
        onExpand={() => undefined}
      />
    </main>
  );
}
