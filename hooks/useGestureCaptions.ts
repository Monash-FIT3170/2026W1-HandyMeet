import { GESTURE_CAPTION_TOPIC } from '@/constants/captions';
import { DataPacket_Kind, Participant, Room, RoomEvent } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';

type GestureCaptionMessage = {
  text: string;
  participantInfo?: Participant;
};

export const useGestureCaptions = (room: Room | undefined) => {
  const [captions, setCaptions] = useState<GestureCaptionMessage[]>([]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionsRef = useRef<GestureCaptionMessage[]>([]);
  const prevGestureIsFullWord = useRef<boolean>(false);

  useEffect(() => {
    if (!room) return;

    const handleData = (
      payload: Uint8Array,
      sender?: Participant,
      _kind?: DataPacket_Kind,
      topic?: string,
    ) => {
      if (topic !== GESTURE_CAPTION_TOPIC) return;

      try {
        const data = JSON.parse(new TextDecoder().decode(payload));

        const current = captionsRef.current;
        const last = current.at(-1);

        const sameSender = last?.participantInfo === sender;
        const isWord = data.text.length > 1;

        const updated = sameSender
          ? [
              ...current.slice(0, -1),
              {
                text:
                  last?.text +
                  (isWord || prevGestureIsFullWord.current ? ' ' : '') +
                  data.text,
                participantInfo: sender,
              },
            ]
          : [
              ...current,
              {
                text: data.text,
                participantInfo: sender,
              },
            ];

        prevGestureIsFullWord.current = isWord;

        captionsRef.current = updated;
        setCaptions(updated);

        if (sameSender) {
          clearTimeout(timeoutRef.current ?? undefined);
        }

        timeoutRef.current = setTimeout(() => {
          captionsRef.current = captionsRef.current.slice(1);
          setCaptions(captionsRef.current);
        }, 4000);
      } catch (error) {
        console.error('Failed to parse incoming caption: ', error);
      }
    };

    room.on(RoomEvent.DataReceived, handleData);

    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  return { gestureCaptions: captions };
};
