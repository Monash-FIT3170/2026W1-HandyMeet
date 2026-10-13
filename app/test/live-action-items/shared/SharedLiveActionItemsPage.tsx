'use client';

import { useEffect, useMemo } from 'react';
import type { DataPacket_Kind, Participant, Room } from 'livekit-client';
import { ConnectionState, RoomEvent } from 'livekit-client';
import ActionItemSidebar from '@/components/action-items/ActionItemSidebar';
import { useLiveActionItems } from '@/hooks/useLiveActionItems';
import type { LiveActionItem } from '@/hooks/useLiveActionItems';
import {
  LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE,
  LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE,
  LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE,
  LIVE_INSIGHTS_MESSAGE_TYPE,
  LIVE_INSIGHTS_MUTATION_TYPE,
  LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE,
  LIVE_INSIGHTS_TOPIC,
} from '@/helpers/liveInsightsProtocol';

const SHARED_ROOM_ID = 'shared-live-action-items-e2e';
const SHARED_CHANNEL_NAME = 'handymeet-live-action-items-shared-e2e';
const SHARED_ITEMS_KEY = `${SHARED_CHANNEL_NAME}:items`;
const SHARED_TASK = 'Prepare the release notes after the discussion';

const PARTICIPANTS = [
  { id: 'alice', name: 'Alice' },
  { id: 'sam', name: 'Sam' },
];

type TestDataHandler = (
  payload: Uint8Array,
  sender?: Participant,
  kind?: DataPacket_Kind,
  topic?: string,
) => void;

type SharedWireMessage = {
  roomId: string;
  senderIdentity: string;
  message: object;
};

type SharedRoom = Room & {
  emitAgentActionItems: () => void;
  dispose: () => void;
};

function createSharedRoom(identity: string): SharedRoom {
  const otherParticipant = PARTICIPANTS.find(
    (participant) => participant.id !== identity,
  );
  const joinedAt = {
    alice: new Date('2026-01-01T00:00:00.000Z'),
    sam: new Date('2026-01-01T00:01:00.000Z'),
  };
  const listeners = new Map<RoomEvent, Set<TestDataHandler>>();
  let channel: BroadcastChannel | null = null;

  const emitData = (senderIdentity: string, message: object) => {
    const payload = new TextEncoder().encode(JSON.stringify(message));
    listeners.get(RoomEvent.DataReceived)?.forEach((handler) => {
      handler(
        payload,
        { identity: senderIdentity } as Participant,
        undefined,
        LIVE_INSIGHTS_TOPIC,
      );
    });
  };

  const ensureChannel = () => {
    if (channel || typeof window === 'undefined') return channel;

    channel = new BroadcastChannel(SHARED_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<SharedWireMessage>) => {
      if (event.data?.roomId !== SHARED_ROOM_ID) return;
      emitData(event.data.senderIdentity, event.data.message);
    };
    return channel;
  };

  const broadcast = (senderIdentity: string, message: object) => {
    ensureChannel()?.postMessage({
      roomId: SHARED_ROOM_ID,
      senderIdentity,
      message,
    } satisfies SharedWireMessage);
  };

  const publishAgentItems = (actionItems: LiveActionItem[]) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        SHARED_ITEMS_KEY,
        JSON.stringify(actionItems),
      );
    }

    const message = {
      type: LIVE_INSIGHTS_MESSAGE_TYPE,
      actionItems,
    };
    emitData('agent-test', message);
    broadcast('agent-test', message);
  };

  const applyMutation = (message: {
    itemId: string;
    operation?: string;
    updates?: Partial<LiveActionItem>;
    assigneeId?: string | null;
  }) => {
    if (typeof window === 'undefined') return;

    const currentItems = JSON.parse(
      window.localStorage.getItem(SHARED_ITEMS_KEY) ?? '[]',
    ) as LiveActionItem[];
    const nextItems = currentItems.map((item) => {
      if (item.id !== message.itemId) return item;
      if (message.operation === 'accept') {
        return { ...item, status: 'accepted' as const };
      }
      if (message.operation === 'dismiss') {
        return { ...item, status: 'dismissed' as const };
      }
      if (message.operation === 'edit') {
        return { ...item, ...message.updates };
      }
      if (message.operation === 'assign') {
        return { ...item, assigneeId: message.assigneeId ?? null };
      }
      return item;
    });

    publishAgentItems(nextItems);
  };

  const localParticipant = {
    identity,
    joinedAt: joinedAt[identity as keyof typeof joinedAt],
    publishData: async (payload: Uint8Array) => {
      const message = JSON.parse(new TextDecoder().decode(payload)) as {
        type?: string;
        itemId?: string;
        operation?: string;
        updates?: Partial<LiveActionItem>;
        assigneeId?: string | null;
        targetIdentity?: string;
      };

      if (message.type === LIVE_INSIGHTS_MUTATION_TYPE && message.itemId) {
        applyMutation({
          itemId: message.itemId,
          operation: message.operation,
          updates: message.updates,
          assigneeId: message.assigneeId,
        });
        return;
      }

      if (message.type === LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE) {
        const storedItems = JSON.parse(
          window.localStorage.getItem(SHARED_ITEMS_KEY) ?? '[]',
        ) as LiveActionItem[];
        if (storedItems.length > 0) publishAgentItems(storedItems);
        return;
      }

      if (
        message.type === LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE ||
        message.type === LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE ||
        message.type === LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE
      ) {
        broadcast(identity, message);
      }
    },
  };

  return {
    state: ConnectionState.Connected,
    remoteParticipants: new Map(
      otherParticipant
        ? [
            [
              otherParticipant.id,
              {
                identity: otherParticipant.id,
                joinedAt:
                  joinedAt[otherParticipant.id as keyof typeof joinedAt],
              } as Participant,
            ],
          ]
        : [],
    ),
    localParticipant,
    on(event: RoomEvent, handler: TestDataHandler) {
      const eventListeners = listeners.get(event) ?? new Set<TestDataHandler>();
      eventListeners.add(handler);
      listeners.set(event, eventListeners);
    },
    off(event: RoomEvent, handler: TestDataHandler) {
      listeners.get(event)?.delete(handler);
    },
    emitAgentActionItems() {
      publishAgentItems([
        {
          id: 'agent-shared-action-item-1',
          task: SHARED_TASK,
          owner: 'Alice',
          dueDate: null,
          status: 'suggested',
          assigneeId: null,
        },
      ]);
    },
    dispose() {
      channel?.close();
      channel = null;
    },
  } as unknown as SharedRoom;
}

export function SharedLiveActionItemsPage({
  participantId,
}: {
  participantId: string;
}) {
  const room = useMemo(() => createSharedRoom(participantId), [participantId]);
  const liveActionItems = useLiveActionItems({ room });

  useEffect(() => () => room.dispose(), [room]);

  const localParticipant = PARTICIPANTS.find(
    (participant) => participant.id === participantId,
  );

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-lg font-bold">
        Shared live action items test: {localParticipant?.name}
      </h1>
      <button
        type="button"
        className="mt-4 rounded-lg border border-white/15 px-3 py-2 text-sm"
        onClick={room.emitAgentActionItems}
        disabled={liveActionItems.actionItems.length > 0}
      >
        Simulate two participants talking
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
        participants={PARTICIPANTS}
        canEdit={liveActionItems.isCoordinator}
        coordinatorIdentity={liveActionItems.coordinatorIdentity}
        onTransferCoordinator={liveActionItems.transferCoordinator}
      />
    </main>
  );
}
