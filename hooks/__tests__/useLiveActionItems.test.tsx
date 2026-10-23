/** @jest-environment jsdom */

import { EventEmitter } from 'node:events';
import { act, renderHook } from '@testing-library/react';
import { ConnectionState, RoomEvent, type Room } from 'livekit-client';
import { useLiveActionItems, type LiveActionItem } from '../useLiveActionItems';
import {
  LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE,
  LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE,
  LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE,
  LIVE_INSIGHTS_COORDINATOR_STATE_TYPE,
  LIVE_INSIGHTS_MESSAGE_TYPE,
  LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE,
  LIVE_INSIGHTS_TOPIC,
} from '@/helpers/liveInsightsProtocol';

const item: LiveActionItem = {
  id: 'item-1',
  task: 'Send the notes',
  owner: null,
  dueDate: null,
  status: 'suggested',
  assigneeId: null,
};

function createRoom({
  connected = true,
  joinedAt = new Date(100),
}: { connected?: boolean; joinedAt?: Date | null } = {}) {
  const events = new EventEmitter();
  const publishData = jest.fn().mockResolvedValue(undefined);
  const room = {
    state: connected ? ConnectionState.Connected : ConnectionState.Disconnected,
    localParticipant: {
      identity: 'local-user',
      joinedAt,
      publishData,
    },
    remoteParticipants: new Map(),
    on: jest.fn((event, listener) => events.on(event, listener)),
    off: jest.fn((event, listener) => events.off(event, listener)),
  };

  return {
    room: room as unknown as Room,
    publishData,
    emit(event: RoomEvent, ...args: unknown[]) {
      act(() => {
        events.emit(event, ...args);
      });
    },
    receive(
      message: unknown,
      identity: string | undefined = 'agent-insights',
      topic = LIVE_INSIGHTS_TOPIC,
    ) {
      act(() => {
        events.emit(
          RoomEvent.DataReceived,
          new TextEncoder().encode(JSON.stringify(message)),
          identity === undefined ? undefined : { identity },
          undefined,
          topic,
        );
      });
    },
    messages() {
      return publishData.mock.calls.map(([payload]) =>
        JSON.parse(new TextDecoder().decode(payload)),
      );
    },
  };
}

describe('useLiveActionItems receiving updates and coordinating', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts empty and requests reliable snapshots and coordinator state on connection', () => {
    const mock = createRoom({ connected: false });
    const { result } = renderHook(() =>
      useLiveActionItems({ room: mock.room }),
    );

    expect(result.current).toMatchObject({
      actionItems: [],
      error: null,
      isLoading: false,
      coordinatorIdentity: null,
      isCoordinator: false,
    });
    expect(mock.publishData).not.toHaveBeenCalled();

    mock.emit(RoomEvent.Connected);

    expect(result.current.isCoordinator).toBe(true);
    expect(mock.messages()).toEqual([
      { type: LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE },
      { type: LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE, joinedAt: 100 },
      { type: LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE },
    ]);
    for (const [, options] of mock.publishData.mock.calls) {
      expect(options).toEqual({ reliable: true, topic: LIVE_INSIGHTS_TOPIC });
    }
  });

  it('accepts agent snapshots, replaces old items, and ignores untrusted or invalid messages', () => {
    const mock = createRoom();
    const { result } = renderHook(() =>
      useLiveActionItems({ room: mock.room }),
    );
    const update = { type: LIVE_INSIGHTS_MESSAGE_TYPE, actionItems: [item] };

    mock.receive(update, 'Agent-insights');
    expect(result.current.actionItems).toEqual([item]);

    mock.receive({ ...update, actionItems: [] }, 'other-user');
    mock.receive(
      { ...update, actionItems: [] },
      'agent-insights',
      'other-topic',
    );
    mock.emit(
      RoomEvent.DataReceived,
      new TextEncoder().encode(JSON.stringify({ ...update, actionItems: [] })),
      undefined,
      undefined,
      LIVE_INSIGHTS_TOPIC,
    );
    mock.receive({ type: LIVE_INSIGHTS_MESSAGE_TYPE, actionItems: [{}] });
    mock.receive({ type: 'unknown' });
    expect(result.current.actionItems).toEqual([item]);

    mock.receive({ ...update, actionItems: [] });
    expect(result.current.actionItems).toEqual([]);
  });

  it('preserves items on malformed JSON and clears the error after a valid snapshot', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mock = createRoom();
    const { result } = renderHook(() =>
      useLiveActionItems({ room: mock.room }),
    );
    mock.receive({ type: LIVE_INSIGHTS_MESSAGE_TYPE, actionItems: [item] });

    mock.emit(
      RoomEvent.DataReceived,
      new TextEncoder().encode('{'),
      { identity: 'agent-insights' },
      undefined,
      LIVE_INSIGHTS_TOPIC,
    );

    expect(result.current.error).toBe('Failed to receive live action items.');
    expect(result.current.actionItems).toEqual([item]);
    expect(error).toHaveBeenCalledWith(
      'Failed to parse live insight update:',
      expect.any(Error),
    );
    mock.receive({ type: LIVE_INSIGHTS_MESSAGE_TYPE, actionItems: [] });
    expect(result.current.error).toBeNull();
  });

  it('elects the earliest known human and breaks join-time ties by identity', () => {
    const mock = createRoom();
    mock.room.remoteParticipants.set('older', {
      identity: 'older',
      joinedAt: new Date(50),
    } as never);
    mock.room.remoteParticipants.set('agent', {
      identity: 'agent-insights',
      joinedAt: new Date(0),
    } as never);
    mock.room.remoteParticipants.set('unknown', {
      identity: 'unknown',
    } as never);
    const { result } = renderHook(() =>
      useLiveActionItems({ room: mock.room }),
    );
    expect(result.current.coordinatorIdentity).toBe('older');

    mock.receive(
      { type: LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE, joinedAt: 50 },
      'alice',
    );
    expect(result.current.coordinatorIdentity).toBe('alice');
    mock.emit(RoomEvent.ParticipantDisconnected, { identity: 'alice' });
    expect(result.current.coordinatorIdentity).toBe('older');
    mock.emit(RoomEvent.ParticipantConnected, { identity: 'unknown' });
    expect(result.current.coordinatorIdentity).toBe('older');
    mock.emit(RoomEvent.ParticipantConnected, {
      identity: 'earliest',
      joinedAt: new Date(10),
    });
    expect(result.current.coordinatorIdentity).toBe('earliest');
  });

  it('allows only the fallback coordinator to hand off to a known candidate', () => {
    const mock = createRoom();
    const { result } = renderHook(() =>
      useLiveActionItems({ room: mock.room }),
    );
    mock.receive(
      { type: LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE, joinedAt: 200 },
      'other-user',
    );
    const handoff = {
      type: LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE,
      targetIdentity: 'other-user',
    };
    mock.receive(handoff, 'stranger');
    mock.receive({ ...handoff, targetIdentity: 'unknown' }, 'local-user');
    expect(result.current.isCoordinator).toBe(true);

    mock.receive(handoff, 'local-user');
    expect(result.current.coordinatorIdentity).toBe('other-user');
  });

  it('honors agent coordinator state until the agent disconnects', () => {
    const mock = createRoom();
    const { result } = renderHook(() =>
      useLiveActionItems({ room: mock.room }),
    );
    const state = {
      type: LIVE_INSIGHTS_COORDINATOR_STATE_TYPE,
      coordinatorIdentity: 'chosen-user',
    };
    mock.receive(state, 'other-user');
    expect(result.current.isCoordinator).toBe(true);
    mock.receive(state);
    mock.receive(
      { type: LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE, joinedAt: 0 },
      'earliest',
    );
    mock.receive(
      {
        type: LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE,
        targetIdentity: 'earliest',
      },
      'chosen-user',
    );
    mock.emit(RoomEvent.ParticipantDisconnected, { identity: 'some-user' });
    expect(result.current.coordinatorIdentity).toBe('chosen-user');

    mock.receive({ ...state, coordinatorIdentity: null });
    expect(result.current.coordinatorIdentity).toBeNull();
    mock.emit(RoomEvent.ParticipantDisconnected, {
      identity: 'Agent-insights',
    });
    expect(result.current.coordinatorIdentity).toBe('earliest');
  });

  it('requests fresh state when an agent joins and reuses a missing local join time', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234);
    const mock = createRoom({ joinedAt: null });
    renderHook(() => useLiveActionItems({ room: mock.room }));
    mock.publishData.mockClear();
    jest.spyOn(Date, 'now').mockReturnValue(5678);

    mock.emit(RoomEvent.ParticipantConnected, { identity: 'Agent-insights' });

    expect(mock.messages()).toEqual([
      { type: LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE },
      { type: LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE, joinedAt: 1234 },
      { type: LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE },
    ]);
  });

  it('logs rejected snapshot and coordinator requests without exposing a receive error', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mock = createRoom({ connected: false });
    const failure = new Error('offline');
    mock.publishData.mockRejectedValue(failure);
    const { result } = renderHook(() =>
      useLiveActionItems({ room: mock.room }),
    );

    await act(async () => mock.emit(RoomEvent.Connected));

    expect(error).toHaveBeenCalledWith(
      'Failed to request live insight snapshot:',
      failure,
    );
    expect(error).toHaveBeenCalledWith(
      'Failed to update live insights coordinator:',
      failure,
    );
    expect(result.current.error).toBeNull();
  });

  it('detaches every listener when the room changes and on unmount', () => {
    const first = createRoom();
    const second = createRoom();
    const { result, rerender, unmount } = renderHook(
      ({ room }) => useLiveActionItems({ room }),
      { initialProps: { room: first.room } },
    );

    rerender({ room: second.room });
    for (const [event, listener] of (first.room.on as jest.Mock).mock.calls) {
      expect(first.room.off).toHaveBeenCalledWith(event, listener);
    }
    first.receive({ type: LIVE_INSIGHTS_MESSAGE_TYPE, actionItems: [item] });
    expect(result.current.actionItems).toEqual([]);
    second.receive({ type: LIVE_INSIGHTS_MESSAGE_TYPE, actionItems: [item] });
    expect(result.current.actionItems).toEqual([item]);

    unmount();
    for (const [event, listener] of (second.room.on as jest.Mock).mock.calls) {
      expect(second.room.off).toHaveBeenCalledWith(event, listener);
    }
  });
});
