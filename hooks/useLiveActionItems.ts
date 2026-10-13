'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataPacket_Kind, Participant, Room } from 'livekit-client';
import { ConnectionState, RoomEvent } from 'livekit-client';
import type { LiveInsightActionItem } from '@/helpers/liveInsights';
import {
  isLiveInsightsCoordinatorState,
  isLiveInsightsCoordinatorClaim,
  isLiveInsightsCoordinatorHandoff,
  LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE,
  LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE,
  LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE,
  LIVE_INSIGHTS_MUTATION_TYPE,
  isLiveInsightsUpdate,
  LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE,
  LIVE_INSIGHTS_TOPIC,
} from '@/helpers/liveInsightsProtocol';

export type ActionItemStatus = LiveInsightActionItem['status'];

export type LiveActionItem = LiveInsightActionItem;

type UseLiveActionItemsOptions = {
  room: Room;
};

export function useLiveActionItems({ room }: UseLiveActionItemsOptions) {
  const [actionItems, setActionItems] = useState<LiveActionItem[]>([]);
  const [coordinatorIdentity, setCoordinatorIdentity] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const actionItemsRef = useRef<LiveActionItem[]>([]);
  const participantClaimsRef = useRef(new Map<string, number>());
  const agentStateReceivedRef = useRef(false);
  const localJoinedAtRef = useRef<number | null>(null);
  const coordinatorIdentityRef = useRef<string | null>(null);

  const updateCoordinatorIdentity = useCallback((identity: string | null) => {
    coordinatorIdentityRef.current = identity;
    setCoordinatorIdentity(identity);
  }, []);

  const electFallbackCoordinator = useCallback(() => {
    if (agentStateReceivedRef.current) return;

    const electedParticipant = [...participantClaimsRef.current.entries()].sort(
      ([identity, joinedAt], [otherIdentity, otherJoinedAt]) =>
        joinedAt - otherJoinedAt || identity.localeCompare(otherIdentity),
    )[0];

    updateCoordinatorIdentity(electedParticipant?.[0] ?? null);
  }, [updateCoordinatorIdentity]);

  const getLocalJoinedAt = useCallback(() => {
    if (localJoinedAtRef.current !== null) return localJoinedAtRef.current;

    localJoinedAtRef.current =
      room.localParticipant.joinedAt?.getTime() ?? Date.now();
    return localJoinedAtRef.current;
  }, [room]);

  const publishCoordinatorMessage = useCallback(
    (message: object) => {
      void room.localParticipant
        .publishData(new TextEncoder().encode(JSON.stringify(message)), {
          reliable: true,
          topic: LIVE_INSIGHTS_TOPIC,
        })
        .catch((err) => {
          console.error('Failed to update live insights coordinator:', err);
        });
    },
    [room],
  );

  const publishMutation = useCallback(
    (message: object) => {
      void room.localParticipant
        .publishData(new TextEncoder().encode(JSON.stringify(message)), {
          reliable: true,
          topic: LIVE_INSIGHTS_TOPIC,
        })
        .catch((err) => {
          console.error('Failed to update live action item:', err);
        });
    },
    [room],
  );

  useEffect(() => {
    const handleData = (
      payload: Uint8Array,
      sender?: Participant,
      _kind?: DataPacket_Kind,
      topic?: string,
    ) => {
      if (topic !== LIVE_INSIGHTS_TOPIC || !sender) return;

      try {
        const data: unknown = JSON.parse(new TextDecoder().decode(payload));

        if (isLiveInsightsCoordinatorClaim(data)) {
          participantClaimsRef.current.set(sender.identity, data.joinedAt);
          electFallbackCoordinator();
          return;
        }

        if (isLiveInsightsCoordinatorHandoff(data)) {
          if (
            !agentStateReceivedRef.current &&
            sender.identity === coordinatorIdentityRef.current &&
            participantClaimsRef.current.has(data.targetIdentity)
          ) {
            updateCoordinatorIdentity(data.targetIdentity);
          }
          return;
        }

        if (!sender.identity.toLowerCase().startsWith('agent-')) return;

        if (isLiveInsightsCoordinatorState(data)) {
          agentStateReceivedRef.current = true;
          updateCoordinatorIdentity(data.coordinatorIdentity);
          return;
        }

        if (!isLiveInsightsUpdate(data)) return;

        const nextItems = data.actionItems;

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

    const announceCoordinatorCandidate = () => {
      const joinedAt = getLocalJoinedAt();
      participantClaimsRef.current.set(
        room.localParticipant.identity,
        joinedAt,
      );
      electFallbackCoordinator();

      publishCoordinatorMessage({
        type: LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE,
        joinedAt,
      });
      publishCoordinatorMessage({
        type: LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE,
      });
    };

    const handleParticipantConnected = (participant: Participant) => {
      if (participant.identity.toLowerCase().startsWith('agent-')) {
        requestSnapshot();
        announceCoordinatorCandidate();
        return;
      }

      const joinedAt = participant.joinedAt?.getTime();
      if (joinedAt !== undefined) {
        participantClaimsRef.current.set(participant.identity, joinedAt);
        electFallbackCoordinator();
      }
    };

    const handleConnected = () => {
      requestSnapshot();
      announceCoordinatorCandidate();

      for (const participant of room.remoteParticipants.values()) {
        const joinedAt = participant.joinedAt?.getTime();
        if (
          !participant.identity.toLowerCase().startsWith('agent-') &&
          joinedAt !== undefined
        ) {
          participantClaimsRef.current.set(participant.identity, joinedAt);
        }
      }
      electFallbackCoordinator();
    };

    const handleParticipantDisconnected = (participant: Participant) => {
      participantClaimsRef.current.delete(participant.identity);

      if (participant.identity.toLowerCase().startsWith('agent-')) {
        agentStateReceivedRef.current = false;
      }

      electFallbackCoordinator();
    };

    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    if (room.state === ConnectionState.Connected) handleConnected();

    return () => {
      room.off(RoomEvent.DataReceived, handleData);
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(
        RoomEvent.ParticipantDisconnected,
        handleParticipantDisconnected,
      );
    };
  }, [
    electFallbackCoordinator,
    getLocalJoinedAt,
    publishCoordinatorMessage,
    room,
    updateCoordinatorIdentity,
  ]);

  const isCoordinator = coordinatorIdentity === room.localParticipant.identity;

  function updateItem(id: string, patch: Partial<LiveActionItem>) {
    actionItemsRef.current = actionItemsRef.current.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    setActionItems(actionItemsRef.current);
  }

  function acceptItem(id: string, ownerName?: string) {
    if (!isCoordinator) return;

    publishMutation({
      type: LIVE_INSIGHTS_MUTATION_TYPE,
      itemId: id,
      operation: 'accept',
    });
    if (ownerName) {
      publishMutation({
        type: LIVE_INSIGHTS_MUTATION_TYPE,
        itemId: id,
        operation: 'edit',
        updates: { owner: ownerName },
      });
    }
    updateItem(id, {
      status: 'accepted',
      ...(ownerName ? { owner: ownerName } : {}),
    });
  }

  function dismissItem(id: string) {
    if (!isCoordinator) return;

    publishMutation({
      type: LIVE_INSIGHTS_MUTATION_TYPE,
      itemId: id,
      operation: 'dismiss',
    });
    updateItem(id, { status: 'dismissed' });
  }

  function editItem(
    id: string,
    updates: Partial<Pick<LiveActionItem, 'task' | 'owner' | 'dueDate'>>,
  ) {
    if (!isCoordinator) return;

    publishMutation({
      type: LIVE_INSIGHTS_MUTATION_TYPE,
      itemId: id,
      operation: 'edit',
      updates,
    });
    updateItem(id, updates);
  }

  function assignUser(id: string, assigneeId: string | null) {
    if (!isCoordinator) return;

    publishMutation({
      type: LIVE_INSIGHTS_MUTATION_TYPE,
      itemId: id,
      operation: 'assign',
      assigneeId,
    });
    updateItem(id, { assigneeId });
  }

  function transferCoordinator(targetIdentity: string) {
    if (!isCoordinator || targetIdentity === room.localParticipant.identity) {
      return;
    }

    publishCoordinatorMessage({
      type: LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE,
      targetIdentity,
    });

    if (!agentStateReceivedRef.current) {
      updateCoordinatorIdentity(targetIdentity);
    }
  }

  return {
    actionItems,
    isLoading: false,
    error,
    coordinatorIdentity,
    isCoordinator,
    transferCoordinator,
    acceptItem,
    dismissItem,
    editItem,
    assignUser,
  };
}
