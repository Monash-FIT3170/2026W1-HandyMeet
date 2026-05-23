import { useState, useEffect } from 'react';
import type { Room, Participant, DataPacket_Kind } from 'livekit-client';
import { RoomEvent } from 'livekit-client';
import { ReactionTopic } from '../constants/reactions';

/**
 * A hook that listens to room data events and exposes the latest reaction string.
 *
 * @param room - The active LiveKit room instance passed from your component.
 * @returns An object containing the current `reaction` string.
 */

export const useIncomingReaction = (room: Room | undefined) => {
  const [reaction, setReaction] = useState<string>('');
  const [participant, setParticipant] = useState<Participant | undefined>();

  useEffect(() => {
    if (!room) return;

    /**
     * Internal handler to decode the message and update local state
     */
    const handleData = (
      payload: Uint8Array,
      sender?: Participant,
      _kind?: DataPacket_Kind,
      topic?: string,
    ) => {
      if (topic !== ReactionTopic) return;

      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));

        setReaction(data.reaction);
        setParticipant(sender);
      } catch (error) {
        console.error('Failed to parse incoming reaction data:', error);
      }
    };

    // Attach the listener
    room.on(RoomEvent.DataReceived, handleData);

    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  return { reaction, participant };
};
