import type { Room, LocalParticipant } from 'livekit-client';
import { RoomEvent } from 'livekit-client';
import {
  enableMicrophone,
  disableMicrophone,
  enableCamera,
  disableCamera,
  togglePen,
  requestHelp,
  sendThumbsUp,
  sendThumbsDown,
  raiseHand,
  sendHello,
  sendTired,
  sendOk,
  sendThankYou,
} from '@/helpers/gestures/actions';
import { Reaction } from '@/constants/reactions';

/**
 * Unit tests for actions.ts
 * Uses Given-When-Then pattern for clarity
 */
describe('Action Handlers', () => {
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

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('enableMicrophone', () => {
    it('should set microphone enabled on local participant', async () => {
      // Given
      const room = mockRoom;

      // When
      await enableMicrophone(room);

      // Then
      expect(mockLocalParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(
        true,
      );
    });

    it('should return a promise', () => {
      // Given
      const room = mockRoom;

      // When
      const result = enableMicrophone(room);

      // Then
      expect(result instanceof Promise).toBe(true);
    });
  });

  describe('disableMicrophone', () => {
    it('should set microphone disabled on local participant', async () => {
      // Given
      const room = mockRoom;

      // When
      await disableMicrophone(room);

      // Then
      expect(mockLocalParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(
        false,
      );
    });
  });

  describe('enableCamera', () => {
    it('should set camera enabled on local participant', async () => {
      // Given
      const room = mockRoom;

      // When
      await enableCamera(room);

      // Then
      expect(mockLocalParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe('disableCamera', () => {
    it('should set camera disabled on local participant', async () => {
      // Given
      const room = mockRoom;

      // When
      await disableCamera(room);

      // Then
      expect(mockLocalParticipant.setCameraEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('togglePen', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation();
    });

    it('should log pen toggle message', async () => {
      // Given
      const room = mockRoom;
      const consoleSpy = jest.spyOn(console, 'log');

      // When
      await togglePen(room);

      // Then
      expect(consoleSpy).toHaveBeenCalledWith('Pen toggle action triggered');
    });
  });

  describe('requestHelp', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation();
    });

    it('should log help request message', async () => {
      // Given
      const room = mockRoom;
      const consoleSpy = jest.spyOn(console, 'log');

      // When
      await requestHelp(room);

      // Then
      expect(consoleSpy).toHaveBeenCalledWith('Help request action triggered');
    });
  });

  describe('Reaction Senders', () => {
    const reactionTests: Array<{
      handler: (room: Room) => Promise<void>;
      reaction: Reaction;
      name: string;
    }> = [
      {
        handler: sendThumbsUp,
        reaction: Reaction.ThumbsUp,
        name: 'sendThumbsUp',
      },
      {
        handler: sendThumbsDown,
        reaction: Reaction.ThumbsDown,
        name: 'sendThumbsDown',
      },
      { handler: raiseHand, reaction: Reaction.RaiseHand, name: 'raiseHand' },
      { handler: sendHello, reaction: Reaction.Hello, name: 'sendHello' },
      { handler: sendTired, reaction: Reaction.Tired, name: 'sendTired' },
      { handler: sendOk, reaction: Reaction.Ok, name: 'sendOk' },
      {
        handler: sendThankYou,
        reaction: Reaction.ThankYou,
        name: 'sendThankYou',
      },
    ];

    reactionTests.forEach(({ handler, reaction, name }) => {
      describe(name, () => {
        it('should publish reaction data to room', async () => {
          // Given
          const room = mockRoom;

          // When
          await handler(room);

          // Then
          expect(mockLocalParticipant.publishData).toHaveBeenCalledWith(
            expect.any(Uint8Array),
            expect.objectContaining({ topic: 'reaction' }),
          );
        });

        it('should emit DataReceived event with reaction', async () => {
          // Given
          const room = mockRoom;

          // When
          await handler(room);

          // Then
          expect(mockRoom.emit).toHaveBeenCalledWith(
            RoomEvent.DataReceived,
            expect.any(Uint8Array),
            mockLocalParticipant,
            undefined,
            'reaction',
          );
        });

        it('should clear reaction after 5000ms', async () => {
          // Given
          const room = mockRoom;

          // When
          await handler(room);
          jest.advanceTimersByTime(5000);

          // Then
          expect(mockRoom.emit).toHaveBeenCalledTimes(2); // Initial emit + cleared emit
          const lastCall = (mockRoom.emit as jest.Mock).mock.calls[1];
          const clearedPayload = lastCall[1];
          const decodedPayload = JSON.parse(
            new TextDecoder().decode(clearedPayload),
          );
          expect(decodedPayload.reaction).toBeNull();
        });

        it('should emit clear event at correct timeout', async () => {
          // Given
          const room = mockRoom;

          // When
          await handler(room);
          jest.advanceTimersByTime(4999); // Just before timeout

          // Then
          expect(mockRoom.emit).toHaveBeenCalledTimes(1); // Only initial emit

          // When advancing past timeout
          jest.advanceTimersByTime(1);

          // Then
          expect(mockRoom.emit).toHaveBeenCalledTimes(2); // Now includes clear emit
        });
      });
    });
  });

  describe('multiple reactions in sequence', () => {
    it('should handle sending multiple different reactions', async () => {
      // Given
      const room = mockRoom;

      // When
      await sendThumbsUp(room);
      // Advance time to trigger the clear for first reaction
      jest.runOnlyPendingTimers();
      jest.advanceTimersByTime(5000);
      await sendThumbsDown(room);

      // Then
      expect(mockLocalParticipant.publishData).toHaveBeenCalledTimes(2);
      // At least the initial emits should be called
      expect(mockRoom.emit).toHaveBeenCalled();
    });
  });
});
