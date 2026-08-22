/**
 * @jest-environment node
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { RoomEvent } from 'livekit-client';
import type { Room, Participant } from 'livekit-client';
import { useIncomingReaction } from '../useIncomingReaction';
import { ReactionTopic } from '@/constants/reactions';

// --- Mock room: minimal EventEmitter-like fake ---
function createMockRoom() {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  type MockRoom = Room & {
    __emit: (event: string, ...args: unknown[]) => void;
  };
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
    // test-only helper to simulate LiveKit firing an event
    __emit: (event: string, ...args: unknown[]) => {
      (listeners[event] || []).forEach((cb) => cb(...args));
    },
  } as unknown as MockRoom;

  return room;
}

function encodePayload(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}

// --- Test harness component: exposes hook result via callback ---
function HookHarness({
  room,
  onResult,
}: {
  room: Room | undefined;
  onResult: (result: ReturnType<typeof useIncomingReaction>) => void;
}) {
  const result = useIncomingReaction(room);
  onResult(result);
  return null;
}

function renderHookHarness(room: Room | undefined) {
  let latest: ReturnType<typeof useIncomingReaction> = {
    reaction: '',
    participant: undefined,
  };
  const onResult = (result: ReturnType<typeof useIncomingReaction>) => {
    latest = result;
  };

  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <HookHarness room={room} onResult={onResult} />,
    );
  });

  return {
    getResult: () => latest,
    rerender: (nextRoom: Room | undefined) => {
      act(() => {
        renderer.update(<HookHarness room={nextRoom} onResult={onResult} />);
      });
    },
    unmount: () => {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

describe('useIncomingReaction', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns empty reaction and no participant when room is undefined', () => {
    const { getResult } = renderHookHarness(undefined);
    expect(getResult().reaction).toBe('');
    expect(getResult().participant).toBeUndefined();
  });

  it('attaches a DataReceived listener when room is provided', () => {
    const room = createMockRoom();
    renderHookHarness(room);

    expect(room.on).toHaveBeenCalledWith(
      RoomEvent.DataReceived,
      expect.any(Function),
    );
  });

  it('removes the listener on unmount', () => {
    const room = createMockRoom();
    const { unmount } = renderHookHarness(room);

    const registeredHandler = (room.on as jest.Mock).mock.calls[0][1];
    unmount();

    expect(room.off).toHaveBeenCalledWith(
      RoomEvent.DataReceived,
      registeredHandler,
    );
  });

  it('updates reaction and participant when a matching-topic message arrives', () => {
    const room = createMockRoom();
    const { getResult } = renderHookHarness(room);

    const fakeSender = { identity: 'user-123' } as unknown as Participant;
    const payload = encodePayload({ reaction: 'thumbsup' });

    act(() => {
      room.__emit(
        RoomEvent.DataReceived,
        payload,
        fakeSender,
        undefined,
        ReactionTopic,
      );
    });

    expect(getResult().reaction).toBe('thumbsup');
    expect(getResult().participant).toBe(fakeSender);
  });

  it('ignores messages with a non-matching topic', () => {
    const room = createMockRoom();
    const { getResult } = renderHookHarness(room);

    const payload = encodePayload({ reaction: 'thumbsup' });

    act(() => {
      room.__emit(
        RoomEvent.DataReceived,
        payload,
        undefined,
        undefined,
        'some-other-topic',
      );
    });

    expect(getResult().reaction).toBe('');
    expect(getResult().participant).toBeUndefined();
  });

  it('logs an error and does not crash on malformed payload', () => {
    const room = createMockRoom();
    const { getResult } = renderHookHarness(room);

    const badPayload = new TextEncoder().encode('not valid json');

    act(() => {
      room.__emit(
        RoomEvent.DataReceived,
        badPayload,
        undefined,
        undefined,
        ReactionTopic,
      );
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to parse incoming reaction data:',
      expect.any(Error),
    );
    expect(getResult().reaction).toBe('');
  });

  it('detaches from the old room and attaches to the new one when room changes', () => {
    const roomA = createMockRoom();
    const roomB = createMockRoom();

    const { rerender } = renderHookHarness(roomA);
    const handlerOnA = (roomA.on as jest.Mock).mock.calls[0][1];

    rerender(roomB);

    expect(roomA.off).toHaveBeenCalledWith(RoomEvent.DataReceived, handlerOnA);
    expect(roomB.on).toHaveBeenCalledWith(
      RoomEvent.DataReceived,
      expect.any(Function),
    );
  });
});
