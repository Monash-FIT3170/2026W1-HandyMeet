/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { useParticipants } from '@livekit/components-react';
import { useParticipantNames } from '../useParticipantNames';

jest.mock('@livekit/components-react', () => ({
  useParticipants: jest.fn(),
}));

const mockUseParticipants = useParticipants as jest.Mock;

describe('useParticipantNames', () => {
  beforeEach(() => {
    mockUseParticipants.mockReturnValue([]);
  });

  test('falls back to the identity when no name is known', () => {
    const { result } = renderHook(() => useParticipantNames());

    expect(result.current('unknown-uuid')).toBe('unknown-uuid');
  });

  test('resolves and trims display names for each participant identity', () => {
    mockUseParticipants.mockReturnValue([
      { identity: 'alice-uuid', name: '  Alice  ' },
      { identity: 'bob-uuid', name: 'Bob' },
    ]);
    const { result } = renderHook(() => useParticipantNames());

    expect(result.current('alice-uuid')).toBe('Alice');
    expect(result.current('bob-uuid')).toBe('Bob');
    expect(result.current('unknown-uuid')).toBe('unknown-uuid');
  });

  test.each([undefined, '', ' \t\n '])(
    'falls back to the identity for an unusable name: %p',
    (name) => {
      mockUseParticipants.mockReturnValue([{ identity: 'alice-uuid', name }]);
      const { result } = renderHook(() => useParticipantNames());

      expect(result.current('alice-uuid')).toBe('alice-uuid');
    },
  );

  test('learns new participants and keeps names after they disconnect', () => {
    const { result, rerender } = renderHook(() => useParticipantNames());
    expect(result.current('alice-uuid')).toBe('alice-uuid');

    mockUseParticipants.mockReturnValue([
      { identity: 'alice-uuid', name: 'Alice' },
    ]);
    rerender();
    expect(result.current('alice-uuid')).toBe('Alice');

    mockUseParticipants.mockReturnValue([]);
    rerender();
    expect(result.current('alice-uuid')).toBe('Alice');
  });

  test('remembers the latest valid name and ignores subsequent blank names', () => {
    mockUseParticipants.mockReturnValue([
      { identity: 'alice-uuid', name: 'Alice' },
    ]);
    const { result, rerender } = renderHook(() => useParticipantNames());

    mockUseParticipants.mockReturnValue([
      { identity: 'alice-uuid', name: '  Alicia  ' },
    ]);
    rerender();
    expect(result.current('alice-uuid')).toBe('Alicia');

    mockUseParticipants.mockReturnValue([
      { identity: 'alice-uuid', name: '  ' },
    ]);
    rerender();
    expect(result.current('alice-uuid')).toBe('Alicia');
  });

  test('keeps remembered names local to each hook instance', () => {
    mockUseParticipants.mockReturnValue([
      { identity: 'alice-uuid', name: 'Alice' },
    ]);
    const first = renderHook(() => useParticipantNames());
    first.unmount();

    mockUseParticipants.mockReturnValue([]);
    const second = renderHook(() => useParticipantNames());

    expect(second.result.current('alice-uuid')).toBe('alice-uuid');
  });
});
