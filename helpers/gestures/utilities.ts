import { VALUES_PER_HAND } from './handLandmarkFeatures';

const WRIST = 0;
const MIDDLE_MCP = 9;

export const calculateDistance3D = (
  coord1: number[],
  coord2: number[],
): number => {
  if (coord1.length !== 3 || coord2.length !== 3) {
    throw new Error('Coordinates must be an array of length 3.');
  }
  return Math.sqrt(
    (coord1[0] - coord2[0]) ** 2 +
      (coord1[1] - coord2[1]) ** 2 +
      (coord1[2] - coord2[2]) ** 2,
  );
};

export const getLandmarkCoordinatesFromFeatures = (
  landmarks: number[],
  index: number,
): number[] => {
  if (landmarks.length !== VALUES_PER_HAND) {
    throw new Error(
      `Landmarks length expected to be ${VALUES_PER_HAND}, actual is ${landmarks.length}.`,
    );
  }
  return landmarks.slice(index * 3, index * 3 + 3);
};

export const calculatePalmDistance = (
  left: number[],
  right: number[],
): number => {
  const leftPalm = getPalmCenter(left);
  const rightPalm = getPalmCenter(right);
  return calculateDistance3D(leftPalm, rightPalm);
};

export const sentinelArray = (value: number, length: number): number[] => {
  return Array.from({ length: length }, () => value);
};

const getPalmCenter = (handFeatures: number[]): number[] => {
  if (handFeatures.length !== VALUES_PER_HAND) {
    throw new Error(
      `Expected features length of ${VALUES_PER_HAND}, got ${handFeatures.length}`,
    );
  }
  const wrist = getLandmarkCoordinatesFromFeatures(handFeatures, WRIST);
  const middle = getLandmarkCoordinatesFromFeatures(handFeatures, MIDDLE_MCP);
  return wrist.map((num, i) => (num + middle[i]) / 2);
};
