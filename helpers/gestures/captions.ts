import { GESTURE_CAPTION_TOPIC } from '@/constants/captions';
import { RemoteParticipant, Room, RoomEvent } from 'livekit-client';
import { Action } from './handler';

export async function publishGestureCaption(
  room: Room,
  currentGesture: Action,
) {
  const payload = new TextEncoder().encode(
    JSON.stringify({
      type: 'gesture-caption',
      text: currentGesture,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }),
  );

  await room.localParticipant.publishData(payload, {
    topic: GESTURE_CAPTION_TOPIC,
    reliable: true,
  });

  room.emit(
    RoomEvent.DataReceived,
    payload,
    room.localParticipant as unknown as RemoteParticipant,
    undefined,
    GESTURE_CAPTION_TOPIC,
  );
}
