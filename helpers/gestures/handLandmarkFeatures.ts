import type { Category, NormalizedLandmark } from '@mediapipe/tasks-vision';

const LANDMARK_COUNT = 21;
export const VALUES_PER_HAND = LANDMARK_COUNT * 3;

export const HAND_FEATURE_VECTOR_LENGTH = VALUES_PER_HAND * 2;

export type HandFeatureVectors = {
  left: number[] | null;
  right: number[] | null;
  both: number[] | null;
};

type HandLabel = 'left' | 'right';
type HandLandmarks = NormalizedLandmark[];

function handLabel(handedness?: Category[]): HandLabel | null {
  const label = (
    handedness?.[0]?.categoryName ||
    handedness?.[0]?.displayName ||
    ''
  ).toLowerCase();

  return label === 'left' || label === 'right' ? label : null;
}

function assignHands(hands: HandLandmarks[], handedness: Category[][]) {
  const assigned: Partial<
    Record<HandLabel, { score: number; hand: HandLandmarks }>
  > = {};
  const unknown: HandLandmarks[] = [];

  hands.forEach((hand, index) => {
    const label = handLabel(handedness[index]);
    const score = handedness[index]?.[0]?.score ?? 0;

    if (!label) {
      unknown.push(hand);
      return;
    }

    const current = assigned[label];
    if (!current || score > current.score) {
      if (current) unknown.push(current.hand);
      assigned[label] = { score, hand };
    } else {
      unknown.push(hand);
    }
  });

  const result: Partial<Record<HandLabel, HandLandmarks>> = {
    left: assigned.left?.hand,
    right: assigned.right?.hand,
  };

  unknown.sort((a, b) => (a[0]?.x ?? 0) - (b[0]?.x ?? 0));
  (['left', 'right'] as const).forEach((label) => {
    if (!result[label]) result[label] = unknown.shift();
  });

  return result;
}

function getScale(hand: HandLandmarks) {
  if (hand.length !== LANDMARK_COUNT) return null;

  const wrist = hand[0];
  const middleBase = hand[9];
  if (!wrist || !middleBase) return null;

  const scale = Math.hypot(
    middleBase.x - wrist.x,
    middleBase.y - wrist.y,
    middleBase.z - wrist.z,
  );

  return Number.isFinite(scale) && scale > 0 ? scale : null;
}

function emptyHand() {
  return Array.from({ length: VALUES_PER_HAND }, () => 0);
}

function encodeHand(
  hand: HandLandmarks,
  wrist: NormalizedLandmark,
  scale: number,
) {
  if (hand.length !== LANDMARK_COUNT) return null;

  const values = hand.flatMap((landmark) => [
    (landmark.x - wrist.x) / scale,
    (landmark.y - wrist.y) / scale,
    (landmark.z - wrist.z) / scale,
  ]);

  return values.every(Number.isFinite) ? values : null;
}

function buildVector(left: HandLandmarks | null, right: HandLandmarks | null) {
  const anchorHand = left ?? right;
  const wrist = anchorHand?.[0];
  if (!anchorHand || !wrist) return null;

  const scale = getScale(anchorHand);
  if (!scale) return null;

  const leftValues = left ? encodeHand(left, wrist, scale) : emptyHand();
  const rightValues = right ? encodeHand(right, wrist, scale) : emptyHand();

  return leftValues && rightValues ? [...leftValues, ...rightValues] : null;
}

export function buildHandFeatureVectors(
  hands: HandLandmarks[],
  handedness: Category[][],
): HandFeatureVectors {
  const { left = null, right = null } = assignHands(hands, handedness);

  return {
    left: left ? buildVector(left, null) : null,
    right: right ? buildVector(null, right) : null,
    both: left && right ? buildVector(left, right) : null,
  };
}
