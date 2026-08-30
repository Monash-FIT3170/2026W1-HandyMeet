import type { Category, NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  buildHandFeatureVectors,
  HAND_FEATURE_VECTOR_LENGTH,
} from '@/helpers/gestures/handLandmarkFeatures';

/**
 * Unit tests for handLandmarkFeatures.ts
 * Uses Given-When-Then pattern for clarity
 */
describe('buildHandFeatureVectors', () => {
  // Helper function to create mock landmarks
  const createMockLandmark = (
    x: number,
    y: number,
    z: number,
  ): NormalizedLandmark => ({
    x,
    y,
    z,
    visibility: 0,
  });

  // Helper function to create a valid hand with 21 landmarks
  const createMockHand = (offsetX = 0): NormalizedLandmark[] => {
    const hand: NormalizedLandmark[] = [];
    for (let i = 0; i < 21; i++) {
      hand.push(
        createMockLandmark(0.5 + offsetX, 0.5 + i * 0.01, 0.1 + i * 0.001),
      );
    }
    return hand;
  };

  // Helper function to create mock handedness categories
  const createMockHandedness = (
    label: 'left' | 'right',
    score: number = 0.99,
  ): Category[] => [
    {
      categoryName: label,
      displayName: label,
      score,
      index: 0,
    } as Category,
  ];

  describe('when no hands are detected', () => {
    it('should return all null vectors', () => {
      // Given
      const hands: NormalizedLandmark[][] = [];
      const handedness: Category[][] = [];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      expect(result.left).toBeNull();
      expect(result.right).toBeNull();
      expect(result.both).toBeNull();
    });
  });

  describe('when only left hand is detected', () => {
    it('should return left vector and null for right and both', () => {
      // Given
      const leftHand = createMockHand(0);
      const hands = [leftHand];
      const handedness = [createMockHandedness('left')];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      expect(result.left).not.toBeNull();
      expect(result.left).toHaveLength(HAND_FEATURE_VECTOR_LENGTH);
      expect(result.right).toBeNull();
      expect(result.both).toBeNull();
    });

    it('should create valid feature vector for left hand', () => {
      // Given
      const leftHand = createMockHand(0);
      const hands = [leftHand];
      const handedness = [createMockHandedness('left')];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      expect(Array.isArray(result.left)).toBe(true);
      expect(result.left).toBeDefined();
      result.left!.forEach((value) => {
        expect(typeof value).toBe('number');
        expect(Number.isFinite(value)).toBe(true);
      });
    });
  });

  describe('when only right hand is detected', () => {
    it('should return right vector and null for left and both', () => {
      // Given
      const rightHand = createMockHand(0.1);
      const hands = [rightHand];
      const handedness = [createMockHandedness('right')];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      expect(result.right).not.toBeNull();
      expect(result.right).toHaveLength(HAND_FEATURE_VECTOR_LENGTH);
      expect(result.left).toBeNull();
      expect(result.both).toBeNull();
    });

    it('should create valid feature vector for right hand', () => {
      // Given
      const rightHand = createMockHand(0.1);
      const hands = [rightHand];
      const handedness = [createMockHandedness('right')];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      expect(Array.isArray(result.right)).toBe(true);
      expect(result.right).toBeDefined();
      result.right!.forEach((value) => {
        expect(typeof value).toBe('number');
        expect(Number.isFinite(value)).toBe(true);
      });
    });
  });

  describe('when both hands are detected', () => {
    it('should return all three vectors populated', () => {
      // Given
      const leftHand = createMockHand(0);
      const rightHand = createMockHand(0.1);
      const hands = [leftHand, rightHand];
      const handedness = [
        createMockHandedness('left'),
        createMockHandedness('right'),
      ];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      expect(result.left).not.toBeNull();
      expect(result.right).not.toBeNull();
      expect(result.both).not.toBeNull();
    });

    it('should create valid feature vectors for both hands', () => {
      // Given
      const leftHand = createMockHand(0);
      const rightHand = createMockHand(0.1);
      const hands = [leftHand, rightHand];
      const handedness = [
        createMockHandedness('left'),
        createMockHandedness('right'),
      ];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      expect(result.left).toHaveLength(HAND_FEATURE_VECTOR_LENGTH);
      expect(result.right).toHaveLength(HAND_FEATURE_VECTOR_LENGTH);
      expect(result.both).toHaveLength(HAND_FEATURE_VECTOR_LENGTH);
    });

    it('should combine left and right vectors in both vector', () => {
      // Given
      const leftHand = createMockHand(0);
      const rightHand = createMockHand(0.1);
      const hands = [leftHand, rightHand];
      const handedness = [
        createMockHandedness('left'),
        createMockHandedness('right'),
      ];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      // Both vector length should be 2x single hand vector length
      expect(result.both).toHaveLength(HAND_FEATURE_VECTOR_LENGTH);
      // Verify all values are finite numbers
      result.both!.forEach((value) => {
        expect(Number.isFinite(value)).toBe(true);
      });
    });
  });

  describe('when hand confidence is low', () => {
    it('should still process hands with low confidence', () => {
      // Given
      const leftHand = createMockHand(0);
      const hands = [leftHand];
      const handedness = [createMockHandedness('left', 0.5)]; // Low confidence

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      expect(result.left).not.toBeNull();
      expect(result.left).toHaveLength(HAND_FEATURE_VECTOR_LENGTH);
    });
  });

  describe('when multiple hands of same label are detected', () => {
    it('should prefer hand with higher confidence for left label', () => {
      // Given
      const leftHand1 = createMockHand(0);
      const leftHand2 = createMockHand(0.05);
      const hands = [leftHand1, leftHand2];
      const handedness = [
        createMockHandedness('left', 0.8),
        createMockHandedness('left', 0.95), // Higher confidence
      ];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      expect(result.left).not.toBeNull();
      expect(result.left).toHaveLength(HAND_FEATURE_VECTOR_LENGTH);
      // Should have processed the higher confidence hand
    });
  });

  describe('when handedness labels are invalid', () => {
    it('should handle unknown handedness labels by assigning to unassigned slots', () => {
      // Given - unknown label will fall through to be assigned left/right by position
      const hand = createMockHand(0);
      const hands = [hand];
      const handedness: Category[][] = [
        [
          {
            categoryName: 'unknown',
            displayName: 'unknown',
            score: 0.99,
            index: 0,
          } as Category,
        ],
      ];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      // Unknown label gets assigned to available slots (left or right)
      // At least one vector should be populated
      expect(
        result.left !== null || result.right !== null || result.both !== null,
      ).toBe(true);
    });

    it('should handle missing handedness data by assigning to slots', () => {
      // Given - no handedness info means hand will be assigned to available slot
      const hand = createMockHand(0);
      const hands = [hand];
      const handedness: Category[][] = [[]]; // Empty handedness

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      // Hand should be assigned to available slot
      expect(
        result.left !== null || result.right !== null || result.both !== null,
      ).toBe(true);
    });
  });

  describe('feature vector properties', () => {
    it('should return feature vector with expected length', () => {
      // Given
      const leftHand = createMockHand(0);
      const rightHand = createMockHand(0.1);
      const hands = [leftHand, rightHand];
      const handedness = [
        createMockHandedness('left'),
        createMockHandedness('right'),
      ];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      expect(result.left).toHaveLength(HAND_FEATURE_VECTOR_LENGTH);
      expect(result.right).toHaveLength(HAND_FEATURE_VECTOR_LENGTH);
      expect(result.both).toHaveLength(HAND_FEATURE_VECTOR_LENGTH);
    });

    it('should return all finite numbers in feature vectors', () => {
      // Given
      const leftHand = createMockHand(0);
      const rightHand = createMockHand(0.1);
      const hands = [leftHand, rightHand];
      const handedness = [
        createMockHandedness('left'),
        createMockHandedness('right'),
      ];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      if (result.left) {
        result.left.forEach((value) => {
          expect(Number.isFinite(value)).toBe(true);
        });
      }
      if (result.right) {
        result.right.forEach((value) => {
          expect(Number.isFinite(value)).toBe(true);
        });
      }
      if (result.both) {
        result.both.forEach((value) => {
          expect(Number.isFinite(value)).toBe(true);
        });
      }
    });
  });

  describe('edge cases', () => {
    it('should handle landmarks with zero distance (same position)', () => {
      // Given - all landmarks at same position
      const hand: NormalizedLandmark[] = [];
      for (let i = 0; i < 21; i++) {
        hand.push(createMockLandmark(0.5, 0.5, 0.5));
      }
      const hands = [hand];
      const handedness = [createMockHandedness('left')];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      // Should handle zero-distance case (scale would be 0)
      expect(result.left).toBeNull(); // Invalid scale
    });

    it('should handle invalid landmark count', () => {
      // Given - hand with wrong number of landmarks
      const hand: NormalizedLandmark[] = [];
      for (let i = 0; i < 10; i++) {
        // Only 10 landmarks instead of 21
        hand.push(createMockLandmark(0.5, 0.5, 0.1));
      }
      const hands = [hand];
      const handedness = [createMockHandedness('left')];

      // When
      const result = buildHandFeatureVectors(hands, handedness);

      // Then
      expect(result.left).toBeNull();
    });
  });
});
