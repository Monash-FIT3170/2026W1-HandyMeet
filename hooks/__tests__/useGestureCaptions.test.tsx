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
