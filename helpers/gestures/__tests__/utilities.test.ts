import { VALUES_PER_HAND } from '../handLandmarkFeatures';
import {
  calculateDistance3D,
  calculatePalmDistance,
  getLandmarkCoordinatesFromFeatures,
  sentinelArray,
} from '../utilities';

describe('calculateDistance3D', () => {
  it('calculates distance using all three coordinates', () => {
    expect(calculateDistance3D([-1, -2, -3], [1, 1, 3])).toBe(7);
  });

  it('returns zero for identical points', () => {
    expect(calculateDistance3D([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it.each([
    [[], [0, 0, 0]],
    [
      [0, 0, 0],
      [0, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 0, 0],
    ],
  ])('rejects invalid coordinate lengths (%j, %j)', (left, right) => {
    expect(() => calculateDistance3D(left, right)).toThrow(
      'Coordinates must be an array of length 3.',
    );
  });
});

describe('getLandmarkCoordinatesFromFeatures', () => {
  it.each([0, 9, 20])(
    'extracts landmark %i without changing the features',
    (index) => {
      const features = Array.from({ length: VALUES_PER_HAND }, (_, i) => i);
      const original = [...features];

      expect(getLandmarkCoordinatesFromFeatures(features, index)).toEqual([
        index * 3,
        index * 3 + 1,
        index * 3 + 2,
      ]);
      expect(features).toEqual(original);
    },
  );

  it.each([0, VALUES_PER_HAND - 1, VALUES_PER_HAND + 1])(
    'rejects feature arrays of length %i',
    (length) => {
      expect(() =>
        getLandmarkCoordinatesFromFeatures(Array(length).fill(0), 0),
      ).toThrow(
        `Landmarks length expected to be ${VALUES_PER_HAND}, actual is ${length}.`,
      );
    },
  );
});

describe('calculatePalmDistance', () => {
  it('measures between the wrist/middle-knuckle midpoints', () => {
    const left = Array(VALUES_PER_HAND).fill(100);
    const right = Array(VALUES_PER_HAND).fill(-100);
    left.splice(0, 3, -2, -2, -2);
    left.splice(27, 3, 2, 2, 2);
    right.splice(0, 3, 0, 1, 4);
    right.splice(27, 3, 4, 5, 8);

    expect(calculatePalmDistance(left, right)).toBe(7);
    expect(calculatePalmDistance(right, left)).toBe(7);
  });

  it('returns zero for coincident palm centers', () => {
    const hand = Array(VALUES_PER_HAND).fill(0);
    expect(calculatePalmDistance(hand, hand)).toBe(0);
  });

  it.each([
    [0, VALUES_PER_HAND, 0],
    [VALUES_PER_HAND, VALUES_PER_HAND + 1, VALUES_PER_HAND + 1],
  ])(
    'rejects hand feature lengths %i and %i',
    (leftLength, rightLength, invalidLength) => {
      expect(() =>
        calculatePalmDistance(
          Array(leftLength).fill(0),
          Array(rightLength).fill(0),
        ),
      ).toThrow(
        `Expected features length of ${VALUES_PER_HAND}, got ${invalidLength}`,
      );
    },
  );
});

describe('sentinelArray', () => {
  it.each([0, -1, 5])('fills an array with %i', (value) => {
    expect(sentinelArray(value, 3)).toEqual([value, value, value]);
  });

  it('returns an empty array for zero length', () => {
    expect(sentinelArray(-1, 0)).toEqual([]);
  });
});
