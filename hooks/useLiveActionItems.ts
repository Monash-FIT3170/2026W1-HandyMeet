'use client';

import { useEffect, useRef, useState } from 'react';
import type { DataPacket_Kind, Participant, Room } from 'livekit-client';
import { RoomEvent } from 'livekit-client';
import {
  isLiveInsightsUpdate,
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

function makeId(): string {
  return crypto.randomUUID();
}

type UseLiveActionItemsOptions = {
  room?: Room;
  transcriptLines?: string[];
  enabled?: boolean;
};

export function useLiveActionItems({ room }: UseLiveActionItemsOptions = {}) {
  const [actionItems, setActionItems] = useState<LiveActionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const actionItemsRef = useRef<LiveActionItem[]>([]);

  useEffect(() => {
    if (!room) return;

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

        const currentItems = actionItemsRef.current;
        const nextItems = data.actionItems.map((item, index) => {
          const existingItem = currentItems[index];
          if (existingItem) return existingItem;

          return {
            ...item,
            id: makeId(),
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

    return () => {
      room.off(RoomEvent.DataReceived, handleData);
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
