/** @jest-environment jsdom */

import { GESTURE_CAPTION_TOPIC } from '@/constants/captions';
import { CaptionGesture } from '@/constants/captions';
import { RoomEvent, type LocalParticipant, type Room } from 'livekit-client';
import { publishGestureCaption } from '../captions';

describe('publishGestureCaption', () => {
  const publishData = jest.fn().mockResolvedValue(undefined);
  const emit = jest.fn();
  const originalCrypto = globalThis.crypto;

  const localParticipant = {
    publishData,
  } as unknown as LocalParticipant;

  const room = {
    localParticipant,
    emit,
  } as unknown as Room;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: jest.fn(() => 'uuid-123') },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
    });
    jest.restoreAllMocks();
  });

  test('publishes caption payload and emits local DataReceived event', async () => {
    await publishGestureCaption(room, CaptionGesture.a);

    expect(publishData).toHaveBeenCalledTimes(1);

    const [payload, options] = publishData.mock.calls[0] as [
      Uint8Array,
      { topic: string; reliable: boolean },
    ];

    expect(options).toEqual({
      topic: GESTURE_CAPTION_TOPIC,
      reliable: true,
    });

    const decoded = JSON.parse(new TextDecoder().decode(payload));
    expect(decoded).toEqual({
      type: 'gesture-caption',
      text: CaptionGesture.a,
      id: 'uuid-123',
      timestamp: 1_700_000_000_000,
    });

    expect(emit).toHaveBeenCalledWith(
      RoomEvent.DataReceived,
      payload,
      localParticipant,
      undefined,
      GESTURE_CAPTION_TOPIC,
    );
  });
});
