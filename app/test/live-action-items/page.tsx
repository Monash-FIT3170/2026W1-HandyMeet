'use client';

import { useMemo } from 'react';
import type { DataPacket_Kind, Participant, Room } from 'livekit-client';
import { ConnectionState, RoomEvent } from 'livekit-client';
import ActionItemSidebar from '@/components/action-items/ActionItemSidebar';
import { useLiveActionItems } from '@/hooks/useLiveActionItems';
import {
  LIVE_INSIGHTS_MESSAGE_TYPE,
  LIVE_INSIGHTS_TOPIC,
} from '@/helpers/liveInsightsProtocol';

const SUGGESTED_TASK = 'Prepare the release notes';

type TestRoom = Room & {
  emitLiveInsights: () => void;
};

type TestDataHandler = (
  payload: Uint8Array,
  sender?: Participant,
  kind?: DataPacket_Kind,
  topic?: string,
) => void;

function createTestRoom(): TestRoom {
  let dataHandler: TestDataHandler | undefined;

  return {
    state: ConnectionState.Connected,
    localParticipant: {
      publishData: async () => undefined,
    },
    on(event: RoomEvent, handler: TestDataHandler) {
      if (event === RoomEvent.DataReceived) dataHandler = handler;
    },
    off(event: RoomEvent, handler: TestDataHandler) {
      if (event === RoomEvent.DataReceived && dataHandler === handler) {
        dataHandler = undefined;
      }
    },
    emitLiveInsights() {
      const message = JSON.stringify({
        type: LIVE_INSIGHTS_MESSAGE_TYPE,
        actionItems: [
          {
            id: 'agent-action-item-test-1',
            task: SUGGESTED_TASK,
            owner: 'Param',
            dueDate: null,
            status: 'suggested',
            assigneeId: null,
          },
        ],
      });

      dataHandler?.(
        new TextEncoder().encode(message),
        { identity: 'agent-test' } as Participant,
        undefined,
        LIVE_INSIGHTS_TOPIC,
      );
    },
  } as unknown as TestRoom;
}

export default function LiveActionItemsTestPage() {
  const room = useMemo(() => createTestRoom(), []);
  const liveActionItems = useLiveActionItems({ room });

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-lg font-bold">Live action items test playground</h1>
      <button
        type="button"
        className="mt-4 rounded-lg border border-white/15 px-3 py-2 text-sm"
        onClick={room.emitLiveInsights}
        disabled={liveActionItems.actionItems.length > 0}
      >
        Simulate agent action item update
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
