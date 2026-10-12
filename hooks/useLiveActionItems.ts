'use client';

import { useEffect, useRef, useState } from 'react';
import type { DataPacket_Kind, Participant, Room } from 'livekit-client';
import { ConnectionState, RoomEvent } from 'livekit-client';
import {
  isLiveInsightsUpdate,
  LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE,
  LIVE_INSIGHTS_TOPIC,
} from '@/helpers/liveInsightsProtocol';

export type ActionItemStatus = 'suggested' | 'accepted' | 'dismissed';

export type LiveActionItem = {
  id: string;
  task: string;
  owner: string | null;
  dueDate: string | null;
  status: ActionItemStatus;
  assigneeId: string | null;
};

type UseLiveActionItemsOptions = {
  room: Room;
};

export function useLiveActionItems({ room }: UseLiveActionItemsOptions) {
  const [actionItems, setActionItems] = useState<LiveActionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const actionItemsRef = useRef<LiveActionItem[]>([]);

  useEffect(() => {
    const handleData = (
      payload: Uint8Array,
      sender?: Participant,
      _kind?: DataPacket_Kind,
      topic?: string,
    ) => {
      if (
        topic !== LIVE_INSIGHTS_TOPIC ||
        !sender?.identity.toLowerCase().startsWith('agent-')
      ) {
        return;
      }

      try {
        const data: unknown = JSON.parse(new TextDecoder().decode(payload));
        if (!isLiveInsightsUpdate(data)) return;

        const currentItemsById = new Map(
          actionItemsRef.current.map((item) => [item.id, item]),
        );
        const nextItems = data.actionItems.map((item) => {
          const existingItem = currentItemsById.get(item.id);
          if (existingItem) {
            return {
              ...item,
              status: existingItem.status,
              assigneeId: existingItem.assigneeId,
            };
          }

          return {
            ...item,
            status: 'suggested' as const,
            assigneeId: null,
          };
        });

        actionItemsRef.current = nextItems;
        setActionItems(nextItems);
        setError(null);
      } catch (err) {
        console.error('Failed to parse live insight update:', err);
        setError('Failed to receive live action items.');
      }
    };

    room.on(RoomEvent.DataReceived, handleData);

    const requestSnapshot = () => {
      const message = JSON.stringify({
        type: LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE,
      });

      void room.localParticipant
        .publishData(new TextEncoder().encode(message), {
          reliable: true,
          topic: LIVE_INSIGHTS_TOPIC,
        })
        .catch((err) => {
          console.error('Failed to request live insight snapshot:', err);
        });
    };

    const handleParticipantConnected = (participant: Participant) => {
      if (participant.identity.toLowerCase().startsWith('agent-')) {
        requestSnapshot();
      }
    };

    room.on(RoomEvent.Connected, requestSnapshot);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    if (room.state === ConnectionState.Connected) requestSnapshot();

    return () => {
      room.off(RoomEvent.DataReceived, handleData);
      room.off(RoomEvent.Connected, requestSnapshot);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    };
  }, [room]);

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

  return {
    actionItems,
    isLoading: false,
    error,
    acceptItem,
    dismissItem,
    editItem,
    assignUser,
  };
}
