/** @jest-environment jsdom */

import { useParticipants } from '@livekit/components-react';
import { renderHook } from '@testing-library/react';
import { useMeetingParticipants } from '../useMeetingParticipants';

jest.mock('@livekit/components-react', () => ({
  useParticipants: jest.fn(),
}));

const mockUseParticipants = useParticipants as jest.Mock;

describe('useMeetingParticipants', () => {
  beforeEach(() => {
    mockUseParticipants.mockReset();
  });

  test('returns no options for an empty meeting', () => {
    mockUseParticipants.mockReturnValue([]);

    const { result } = renderHook(() => useMeetingParticipants());

    expect(result.current).toEqual([]);
  });

  test('excludes agent identities regardless of case and preserves participant order', () => {
    mockUseParticipants.mockReturnValue([
      { identity: 'agent-transcription', name: 'Transcriber' },
      { identity: 'sam-123', name: '  Sam  ' },
      { identity: 'AGENT-captions', name: 'Caption bot' },
      { identity: 'Agent-assistant', name: 'Assistant' },
      { identity: 'user-agent-456', name: 'Taylor' },
      { identity: 'agent', name: 'Agent Smith' },
    ]);

    const { result } = renderHook(() => useMeetingParticipants());

    expect(result.current).toEqual([
      { id: 'sam-123', name: 'Sam' },
      { id: 'user-agent-456', name: 'Taylor' },
      { id: 'agent', name: 'Agent Smith' },
    ]);
  });

  test.each([undefined, '', ' \t\n '])(
    'falls back to identity when the display name is %p',
    (name) => {
      mockUseParticipants.mockReturnValue([{ identity: 'sam-123', name }]);

      const { result } = renderHook(() => useMeetingParticipants());

      expect(result.current).toEqual([{ id: 'sam-123', name: 'sam-123' }]);
    },
  );

  test('reflects renamed, joined, and departed participants after rerender', () => {
    mockUseParticipants.mockReturnValue([
      { identity: 'sam-123', name: 'Sam' },
      { identity: 'taylor-456', name: 'Taylor' },
    ]);
    const { result, rerender } = renderHook(() => useMeetingParticipants());

    mockUseParticipants.mockReturnValue([
      { identity: 'sam-123', name: '  Samantha  ' },
      { identity: 'alex-789', name: 'Alex' },
      { identity: 'agent-transcription', name: 'Transcriber' },
    ]);
    rerender();

    expect(result.current).toEqual([
      { id: 'sam-123', name: 'Samantha' },
      { id: 'alex-789', name: 'Alex' },
    ]);
  });
});
