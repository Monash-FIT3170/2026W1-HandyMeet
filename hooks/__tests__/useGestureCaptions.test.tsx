/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';
import { RoomEvent } from 'livekit-client';
import type { Room, Participant } from 'livekit-client';
import {
  useGestureCaptions,
  type TimestampedTranscriptEntry,
} from '../useGestureCaptions';
import { GESTURE_CAPTION_TOPIC } from '@/constants/captions';

type MockRoom = Room & {
  __emit: (event: string, ...args: unknown[]) => void;
};

function createMockRoom(): MockRoom {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const room: MockRoom = {
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
      return room;
    }),
    off: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners[event] = (listeners[event] || []).filter((l) => l !== cb);
      return room;
    }),
    __emit: (event: string, ...args: unknown[]) => {
      (listeners[event] || []).forEach((cb) => cb(...args));
    },
  } as unknown as MockRoom;

  return room;
}

function encodePayload(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}

function HookHarness({
  room,
  onResult,
}: {
  room: Room | undefined;
  onResult: (result: ReturnType<typeof useGestureCaptions>) => void;
}) {
  const result = useGestureCaptions(room);
  onResult(result);
  return null;
}

function renderHookHarness(room: Room | undefined) {
  let latest: ReturnType<typeof useGestureCaptions> = {
    gestureCaptions: [],
    gestureTranscriptEntries: [],
    flushActive: () => null,
  };
  const onResult = (result: ReturnType<typeof useGestureCaptions>) => {
    latest = result;
  };

  const rendered = render(<HookHarness room={room} onResult={onResult} />);

  return {
    getResult: () => latest,
    unmount: () => rendered.unmount(),
  };
}

describe('useGestureCaptions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns empty captions and no active phrase without a room', () => {
    const { getResult } = renderHookHarness(undefined);

    expect(getResult().gestureCaptions).toEqual([]);
    expect(getResult().gestureTranscriptEntries).toEqual([]);
    expect(getResult().flushActive()).toBeNull();
  });

  test.each([
    ['H', 'i', 3499, 'Hi'],
    ['H', 'i', 3500, 'H i'],
    ['Hello', 'there', 0, 'Hello there'],
    ['Hello', 'A', 0, 'Hello A'],
    ['A', 'hello', 0, 'A hello'],
  ])(
    'joins %s and %s after %i ms as %s and renews caption expiry',
    (first, second, delay, expected) => {
      const room = createMockRoom();
      const { getResult } = renderHookHarness(room);
      const alice = { identity: 'Alice' } as Participant;

      act(() => {
        room.__emit(
          RoomEvent.DataReceived,
          encodePayload({ text: first }),
          alice,
          undefined,
          GESTURE_CAPTION_TOPIC,
        );
        jest.advanceTimersByTime(delay);
        room.__emit(
          RoomEvent.DataReceived,
          encodePayload({ text: second }),
          alice,
          undefined,
          GESTURE_CAPTION_TOPIC,
        );
      });

      expect(getResult().gestureCaptions).toEqual([
        { text: expected, participantInfo: alice },
      ]);
      expect(getResult().gestureTranscriptEntries).toEqual([]);

      act(() => {
        jest.advanceTimersByTime(6999);
      });
      expect(getResult().gestureCaptions).toHaveLength(1);
      expect(getResult().gestureTranscriptEntries).toEqual([]);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(getResult().gestureCaptions).toEqual([]);
      expect(getResult().gestureTranscriptEntries).toEqual([
        { text: `Alice: ${expected}`, timestamp: expect.any(Number) },
      ]);
    },
  );

  test('ignores data published on another topic', () => {
    const room = createMockRoom();
    const { getResult } = renderHookHarness(room);

    act(() => {
      room.__emit(
        RoomEvent.DataReceived,
        encodePayload({ text: 'Hello' }),
        { identity: 'Alice' },
        undefined,
        'other-topic',
      );
    });

    expect(getResult().gestureCaptions).toEqual([]);
    expect(getResult().gestureTranscriptEntries).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('logs invalid JSON and continues receiving valid captions', () => {
    const room = createMockRoom();
    const { getResult } = renderHookHarness(room);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      act(() => {
        room.__emit(
          RoomEvent.DataReceived,
          new TextEncoder().encode('{'),
          undefined,
          undefined,
          GESTURE_CAPTION_TOPIC,
        );
      });
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to parse incoming caption: ',
        expect.any(Error),
      );
      expect(getResult().gestureCaptions).toEqual([]);

      act(() => {
        room.__emit(
          RoomEvent.DataReceived,
          encodePayload({ text: 'Hello' }),
          { identity: 'Alice' },
          undefined,
          GESTURE_CAPTION_TOPIC,
        );
      });
      expect(getResult().gestureCaptions[0].text).toBe('Hello');
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('flushes a caption without a sender as Unknown only once', () => {
    const room = createMockRoom();
    const { getResult } = renderHookHarness(room);

    act(() => {
      room.__emit(
        RoomEvent.DataReceived,
        encodePayload({ text: 'Hello' }),
        { identity: 'Alice' },
        undefined,
        GESTURE_CAPTION_TOPIC,
      );
      room.__emit(
        RoomEvent.DataReceived,
        encodePayload({ text: 'Goodbye' }),
        undefined,
        undefined,
        GESTURE_CAPTION_TOPIC,
      );
    });

    act(() => {
      expect(getResult().flushActive()).toEqual({
        text: 'Unknown: Goodbye',
        timestamp: expect.any(Number),
      });
      expect(getResult().flushActive()).toBeNull();
      jest.advanceTimersByTime(7000);
    });
    expect(
      getResult().gestureTranscriptEntries.map((entry) => entry.text),
    ).toEqual(['Alice: Hello', 'Unknown: Goodbye']);
  });

  test('removes its listener and cancels a pending expiry on unmount', () => {
    const room = createMockRoom();
    const { unmount } = renderHookHarness(room);

    act(() => {
      room.__emit(
        RoomEvent.DataReceived,
        encodePayload({ text: 'Hello' }),
        { identity: 'Alice' },
        undefined,
        GESTURE_CAPTION_TOPIC,
      );
    });
    expect(jest.getTimerCount()).toBe(1);

    unmount();

    expect(room.off).toHaveBeenCalledWith(
      RoomEvent.DataReceived,
      (room.on as jest.Mock).mock.calls[0][1],
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  test('commits gesture speech into transcript entries after duration timeout', () => {
    const room = createMockRoom();
    const { getResult } = renderHookHarness(room);

    const sender = { identity: 'Alice' } as Participant;
    const payload = encodePayload({
      type: 'gesture-caption',
      text: 'Hello',
    });

    act(() => {
      room.__emit(
        RoomEvent.DataReceived,
        payload,
        sender,
        undefined,
        GESTURE_CAPTION_TOPIC,
      );
    });

    expect(getResult().gestureCaptions).toHaveLength(1);
    expect(getResult().gestureCaptions[0].text).toBe('Hello');
    expect(getResult().gestureTranscriptEntries).toEqual([]);

    act(() => {
      jest.advanceTimersByTime(7000);
    });

    expect(getResult().gestureTranscriptEntries).toHaveLength(1);
    expect(getResult().gestureTranscriptEntries[0].text).toBe('Alice: Hello');
    expect(typeof getResult().gestureTranscriptEntries[0].timestamp).toBe(
      'number',
    );
  });

  test('commits active phrase when a different participant gestures', () => {
    const room = createMockRoom();
    const { getResult } = renderHookHarness(room);

    const alice = { identity: 'Alice' } as Participant;
    const bob = { identity: 'Bob' } as Participant;

    act(() => {
      room.__emit(
        RoomEvent.DataReceived,
        encodePayload({ type: 'gesture-caption', text: 'Hi' }),
        alice,
        undefined,
        GESTURE_CAPTION_TOPIC,
      );
    });

    expect(getResult().gestureTranscriptEntries).toEqual([]);

    act(() => {
      room.__emit(
        RoomEvent.DataReceived,
        encodePayload({ type: 'gesture-caption', text: 'Hey' }),
        bob,
        undefined,
        GESTURE_CAPTION_TOPIC,
      );
    });

    expect(getResult().gestureTranscriptEntries).toHaveLength(1);
    expect(getResult().gestureTranscriptEntries[0].text).toBe('Alice: Hi');
  });

  test('flushActive immediately commits pending active gesture into transcript entries', () => {
    const room = createMockRoom();
    const { getResult } = renderHookHarness(room);

    const alice = { identity: 'Alice' } as Participant;

    act(() => {
      room.__emit(
        RoomEvent.DataReceived,
        encodePayload({ type: 'gesture-caption', text: 'Goodbye' }),
        alice,
        undefined,
        GESTURE_CAPTION_TOPIC,
      );
    });

    expect(getResult().gestureTranscriptEntries).toEqual([]);

    let flushed: TimestampedTranscriptEntry | null = null;
    act(() => {
      flushed = getResult().flushActive();
    });

    expect((flushed as TimestampedTranscriptEntry | null)?.text).toBe(
      'Alice: Goodbye',
    );
    expect(getResult().gestureTranscriptEntries).toHaveLength(1);
    expect(getResult().gestureTranscriptEntries[0].text).toBe('Alice: Goodbye');
  });
});
