'use client';

import { useMemo } from 'react';
import type { DataPacket_Kind, Participant, Room } from 'livekit-client';
import { ConnectionState, RoomEvent } from 'livekit-client';
import ActionItemSidebar from '@/components/action-items/ActionItemSidebar';
import { useLiveActionItems } from '@/hooks/useLiveActionItems';
import {
  LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE,
  LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE,
  LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE,
  LIVE_INSIGHTS_COORDINATOR_STATE_TYPE,
  LIVE_INSIGHTS_MUTATION_TYPE,
  LIVE_INSIGHTS_MESSAGE_TYPE,
  LIVE_INSIGHTS_TOPIC,
} from '@/helpers/liveInsightsProtocol';
import type { LiveActionItem } from '@/hooks/useLiveActionItems';

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

function createTestRoom(agentAvailable: boolean): TestRoom {
  let dataHandler: TestDataHandler | undefined;
  let coordinatorIdentity = 'test-user';
  let actionItems: LiveActionItem[] = [];

  const emitAgentMessage = (message: object) => {
    if (!agentAvailable) return;

    dataHandler?.(
      new TextEncoder().encode(JSON.stringify(message)),
      { identity: 'agent-test' } as Participant,
      undefined,
      LIVE_INSIGHTS_TOPIC,
    );
  };

  return {
    state: ConnectionState.Connected,
    remoteParticipants: new Map(),
    localParticipant: {
      identity: 'test-user',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      publishData: async (payload: Uint8Array) => {
        const message = JSON.parse(new TextDecoder().decode(payload)) as {
          type?: string;
          itemId?: string;
          operation?: string;
          updates?: Partial<LiveActionItem>;
          assigneeId?: string | null;
          targetIdentity?: string;
        };

        if (
          message.type === LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE ||
          message.type === LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE
        ) {
          emitAgentMessage({
            type: LIVE_INSIGHTS_COORDINATOR_STATE_TYPE,
            coordinatorIdentity,
          });
          return;
        }

        if (message.type === LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE) {
          coordinatorIdentity = message.targetIdentity ?? coordinatorIdentity;
          emitAgentMessage({
            type: LIVE_INSIGHTS_COORDINATOR_STATE_TYPE,
            coordinatorIdentity,
          });
          return;
        }

        if (message.type !== LIVE_INSIGHTS_MUTATION_TYPE || !message.itemId) {
          return;
        }

        actionItems = actionItems.map((item) => {
          if (item.id !== message.itemId) return item;

          if (message.operation === 'accept') {
            return { ...item, status: 'accepted' };
          }
          if (message.operation === 'dismiss') {
            return { ...item, status: 'dismissed' };
          }
          if (message.operation === 'edit') {
            return { ...item, ...message.updates };
          }
          if (message.operation === 'assign') {
            return { ...item, assigneeId: message.assigneeId ?? null };
          }

          return item;
        });

        emitAgentMessage({
          type: LIVE_INSIGHTS_MESSAGE_TYPE,
          actionItems,
        });
      },
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
      actionItems = [
        {
          id: 'agent-action-item-test-1',
          task: SUGGESTED_TASK,
          owner: 'Param',
          dueDate: null,
          status: 'suggested',
          assigneeId: null,
        },
      ];

      emitAgentMessage({
        type: LIVE_INSIGHTS_MESSAGE_TYPE,
        actionItems,
      });
    },
  } as unknown as TestRoom;
}

export function LiveActionItemsTestPage({
  agentAvailable = true,
}: {
  agentAvailable?: boolean;
}) {
  const room = useMemo(() => createTestRoom(agentAvailable), [agentAvailable]);
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
        onAccept={liveActionItems.acceptItem}
        onEdit={(id, newTask) =>
          liveActionItems.editItem(id, { task: newTask })
        }
        onDismiss={liveActionItems.dismissItem}
        onAssign={liveActionItems.assignUser}
        participants={[
          { id: 'test-user', name: 'Test user' },
          { id: 'sam', name: 'Sam' },
        ]}
        canEdit={liveActionItems.isCoordinator}
        coordinatorIdentity={liveActionItems.coordinatorIdentity}
        onTransferCoordinator={liveActionItems.transferCoordinator}
      />
    </main>
  );
}
