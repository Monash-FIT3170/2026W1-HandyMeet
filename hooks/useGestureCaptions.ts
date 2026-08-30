import { GESTURE_CAPTION_TOPIC } from '@/constants/captions';
import { DataPacket_Kind, Participant, Room, RoomEvent } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';

type GestureCaptionMessage = {
  text: string;
  participantInfo?: Participant;
};

const GESTURE_CAPTIONS_DURATION_MS = 7000;
const NEW_WORD_DELAY_MS = 3500;

export const useGestureCaptions = (room: Room | undefined) => {
  const [captions, setCaptions] = useState<GestureCaptionMessage[]>([]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionsRef = useRef<GestureCaptionMessage[]>([]);
  const isPrevFullWordRef = useRef<boolean>(false);
  const prevTimestampRef = useRef<number>(0);

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

        const currTimestamp = Date.now();
        if (sameSender) {
          const prevAndCurrentAreChars = !isPrevFullWordRef.current && !isWord;
          const wordDelayElapsed =
            currTimestamp >= prevTimestampRef.current + NEW_WORD_DELAY_MS;
          if (prevAndCurrentAreChars && wordDelayElapsed) {
            data.text = ' ' + data.text;
          }
        }

        const updated = sameSender
          ? [
              ...current.slice(0, -1),
              {
                text:
                  last?.text +
                  (isWord || isPrevFullWordRef.current ? ' ' : '') +
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

        isPrevFullWordRef.current = isWord;
        prevTimestampRef.current = currTimestamp;

        captionsRef.current = updated;
        setCaptions(updated);

        if (sameSender) {
          clearTimeout(timeoutRef.current ?? undefined);
        }

        timeoutRef.current = setTimeout(() => {
          captionsRef.current = captionsRef.current.slice(1);
          setCaptions(captionsRef.current);
        }, GESTURE_CAPTIONS_DURATION_MS);
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
