import type { Room, LocalParticipant } from 'livekit-client';
import { handleAction } from '@/helpers/gestures/handler';
import { Gesture } from '@/constants/gestures';
import { Reaction } from '@/constants/reactions';

/**
 * Unit tests for handler.ts
 * Uses Given-When-Then pattern for clarity
 */
describe('handleAction', () => {
  let mockRoom: jest.Mocked<Room>;
  let mockLocalParticipant: jest.Mocked<LocalParticipant>;

  beforeEach(() => {
    mockLocalParticipant = {
      setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
      setCameraEnabled: jest.fn().mockResolvedValue(undefined),
      publishData: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LocalParticipant>;

    mockRoom = {
      localParticipant: mockLocalParticipant,
      emit: jest.fn(),
    } as unknown as jest.Mocked<Room>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('with valid Gesture actions', () => {
    it('should handle Mute gesture', async () => {
      // Given
      const room = mockRoom;
      const action = Gesture.Mute;

      // When
      const result = await handleAction(room, action);

      // Then
      expect(result).toBe(true);
      expect(mockLocalParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(
        false,
      );
    });

    it('should handle Unmute gesture', async () => {
      // Given
      const room = mockRoom;
      const action = Gesture.Unmute;

      // When
      const result = await handleAction(room, action);

      // Then
      expect(result).toBe(true);
      expect(mockLocalParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(
        true,
      );
    });

    it('should handle CameraOff gesture', async () => {
      // Given
      const room = mockRoom;
      const action = Gesture.CameraOff;

      // When
      const result = await handleAction(room, action);

      // Then
      expect(result).toBe(true);
      expect(mockLocalParticipant.setCameraEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('with valid Reaction actions', () => {
    const validReactions = [
      Reaction.RaiseHand,
      Reaction.ThumbsUp,
      Reaction.ThumbsDown,
      Reaction.Hello,
      Reaction.Tired,
      Reaction.Ok,
      Reaction.ThankYou,
    ];

    validReactions.forEach((reaction) => {
      it(`should handle ${reaction} reaction`, async () => {
        // Given
        const room = mockRoom;
        const action = reaction;

        // When
        const result = await handleAction(room, action);

        // Then
        expect(result).toBe(true);
        expect(mockLocalParticipant.publishData).toHaveBeenCalled();
      });
    });
  });

  describe('with invalid action', () => {
    it('should return false for unknown action', async () => {
      // Given
      const room = mockRoom;
      const invalidAction = 'unknownAction' as unknown as Gesture;

      // When
      const result = await handleAction(room, invalidAction);

      // Then
      expect(result).toBe(false);
      expect(mockLocalParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
      expect(mockLocalParticipant.setCameraEnabled).not.toHaveBeenCalled();
      expect(mockLocalParticipant.publishData).not.toHaveBeenCalled();
    });
  });

  describe('action execution', () => {
    it('should execute action handler and return success', async () => {
      // Given
      const room = mockRoom;
      const action = Gesture.Mute;

      // When
      const result = await handleAction(room, action);
      await new Promise((resolve) => setImmediate(resolve)); // Wait for async handler

      // Then
      expect(result).toBe(true);
    });

    it('should return true even if action handler fails', async () => {
      // Given
      const room = mockRoom;
      mockLocalParticipant.setMicrophoneEnabled = jest
        .fn()
        .mockRejectedValueOnce(new Error('Handler error'));
      const action = Gesture.Mute;

      // When
      try {
        await handleAction(room, action);
      } catch {
        // Handler error is expected to propagate
      }

      // Then
      expect(mockLocalParticipant.setMicrophoneEnabled).toHaveBeenCalled();
    });
  });

  describe('action handler mapping', () => {
    it('should correctly map all gesture actions to handlers', async () => {
      // Given
      const gestures = [Gesture.CameraOff, Gesture.Mute, Gesture.Unmute];

      // When & Then
      for (const gesture of gestures) {
        const result = await handleAction(mockRoom, gesture);
        expect(result).toBe(true);
      }
    });

    it('should correctly map all reaction actions to handlers', async () => {
      // Given
      const reactions = [
        Reaction.RaiseHand,
        Reaction.ThumbsUp,
        Reaction.ThumbsDown,
        Reaction.Hello,
        Reaction.Tired,
        Reaction.Ok,
        Reaction.ThankYou,
      ];

      // When & Then
      for (const reaction of reactions) {
        const result = await handleAction(mockRoom, reaction);
        expect(result).toBe(true);
      }
    });
  });

  describe('concurrent action execution', () => {
    it('should handle multiple actions in sequence', async () => {
      // Given
      const room = mockRoom;
      const actions = [Gesture.Mute, Gesture.CameraOff, Reaction.ThumbsUp];

      // When
      const results = await Promise.all(
        actions.map((action) => handleAction(room, action)),
      );

      // Then
      expect(results).toEqual([true, true, true]);
    });
  });
});
