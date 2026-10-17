import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { DrawingGesture } from '@/constants/gestures';
import {
  detectDrawingGesture,
  getIndexFingerTip,
} from '../drawingGestureDetector';

type FingerName = 'index' | 'middle' | 'ring' | 'pinky';
type Pose = 'extended' | 'curled' | 'half' | 'collapsed';

const FINGER_INDICES: Record<
  FingerName,
  { mcp: number; pip: number; tip: number }
> = {
  index: { mcp: 5, pip: 6, tip: 8 },
  middle: { mcp: 9, pip: 10, tip: 12 },
  ring: { mcp: 13, pip: 14, tip: 16 },
  pinky: { mcp: 17, pip: 18, tip: 20 },
};

const FINGER_X: Record<FingerName, number> = {
  index: 0.4,
  middle: 0.5,
  ring: 0.6,
  pinky: 0.7,
};

const lm = (x: number, y: number): NormalizedLandmark => ({
  x,
  y,
  z: 0,
  visibility: 1,
});

/**
 * Geometry (y grows downwards, MCP below PIP):
 *  - extended: tip straight above PIP  -> joint angle 180deg
 *  - curled:   tip folded back on MCP  -> joint angle 0deg
 *  - half:     tip bent away           -> joint angle 120deg (neither extended nor curled)
 *  - collapsed: MCP and PIP identical  -> zero-length vector, calculateAngle returns 180
 */
function setFinger(
  hand: NormalizedLandmark[],
  finger: FingerName,
  pose: Pose,
  length = 0.15,
) {
  const { mcp, pip, tip } = FINGER_INDICES[finger];
  const x = FINGER_X[finger];
  const pipY = 0.45;
  hand[mcp] = lm(x, 0.6);
  hand[pip] = lm(x, pipY);

  switch (pose) {
    case 'extended':
      hand[tip] = lm(x, pipY - length);
      break;
    case 'curled':
      hand[tip] = lm(x, pipY + length);
      break;
    case 'half':
      hand[tip] = lm(
        x + length * Math.sin(Math.PI * (2 / 3)),
        pipY + length * Math.cos(Math.PI * (2 / 3)),
      );
      break;
    case 'collapsed':
      hand[mcp] = lm(x, pipY);
      hand[tip] = lm(x, pipY - length);
      break;
  }
}

function buildHand(
  poses: Partial<Record<FingerName, Pose | [Pose, number]>> = {},
): NormalizedLandmark[] {
  const hand = Array.from({ length: 21 }, () => lm(0.5, 0.5));
  hand[0] = lm(0.5, 1.0); // wrist
  (Object.keys(FINGER_INDICES) as FingerName[]).forEach((finger) => {
    const spec = poses[finger] ?? 'half';
    const [pose, length] = Array.isArray(spec) ? spec : [spec, undefined];
    setFinger(hand, finger, pose, length);
  });
  return hand;
}

describe('detectDrawingGesture', () => {
  describe('input validation', () => {
    it.each([0, 1, 20, 22])('returns null when given %i landmarks', (count) => {
      const landmarks = Array.from({ length: count }, () => lm(0.5, 0.5));
      expect(detectDrawingGesture(landmarks)).toBeNull();
    });
  });

  describe('fist', () => {
    it('detects a fist when index and middle fingers are curled', () => {
      const hand = buildHand({ index: 'curled', middle: 'curled' });
      expect(detectDrawingGesture(hand)).toBe(DrawingGesture.Fist);
    });

    it('prefers fist over pointing-by-distance when index/middle are curled', () => {
      const hand = buildHand({
        index: ['curled', 0.5],
        middle: 'curled',
        ring: 'half',
        pinky: 'half',
      });
      expect(detectDrawingGesture(hand, true)).toBe(DrawingGesture.Fist);
    });
  });

  describe('pointing', () => {
    it('detects pointing when index is extended and middle is curled', () => {
      const hand = buildHand({
        index: ['extended', 0.35],
        middle: 'curled',
        ring: 'curled',
        pinky: 'curled',
      });
      expect(detectDrawingGesture(hand)).toBe(DrawingGesture.Pointing);
    });

    it('treats a zero-length segment as extended (angle fallback of 180)', () => {
      const hand = buildHand({ index: 'collapsed', middle: 'curled' });
      expect(detectDrawingGesture(hand)).toBe(DrawingGesture.Pointing);
    });

    it('treats a zero-length tip segment as extended too', () => {
      const hand = buildHand({ middle: 'curled' });
      hand[8] = { ...hand[6] }; // tip == pip -> magCB === 0
      expect(detectDrawingGesture(hand)).toBe(DrawingGesture.Pointing);
    });

    describe('hysteresis while drawing', () => {
      // index extended, other fingers half-bent (neither extended nor curled),
      // and the index is NOT far enough from the wrist to pass the distance ratio.
      const ambiguousHand = () =>
        buildHand({
          index: ['extended', 0.35],
          middle: ['half', 0.35],
          ring: ['half', 0.35],
          pinky: ['half', 0.35],
        });

      it('returns null for the ambiguous hand when not already drawing', () => {
        expect(detectDrawingGesture(ambiguousHand(), false)).toBeNull();
        expect(detectDrawingGesture(ambiguousHand())).toBeNull();
      });

      it('keeps pointing for the ambiguous hand when already drawing', () => {
        expect(detectDrawingGesture(ambiguousHand(), true)).toBe(
          DrawingGesture.Pointing,
        );
      });

      it('does not keep pointing while drawing if middle finger is also extended', () => {
        const hand = buildHand({
          index: ['extended', 0.35],
          middle: ['extended', 0.35],
          ring: ['half', 0.35],
          pinky: ['half', 0.35],
        });
        expect(detectDrawingGesture(hand, true)).toBeNull();
      });

      it('does not keep pointing while drawing if index is not extended', () => {
        const hand = buildHand({
          index: ['half', 0.35],
          middle: ['half', 0.35],
          ring: ['half', 0.35],
          pinky: ['half', 0.35],
        });
        expect(detectDrawingGesture(hand, true)).toBeNull();
      });
    });

    it('detects pointing by distance when the index tip is far beyond the other tips', () => {
      const hand = buildHand({
        index: ['half', 0.9],
        middle: 'half',
        ring: 'half',
        pinky: 'half',
      });
      expect(detectDrawingGesture(hand)).toBe(DrawingGesture.Pointing);
    });

    it('does not point by distance when the index is only slightly longer', () => {
      const hand = buildHand({
        index: ['half', 0.16],
        middle: 'half',
        ring: 'half',
        pinky: 'half',
      });
      expect(detectDrawingGesture(hand)).toBeNull();
    });
  });

  describe('no gesture', () => {
    it('returns null for a relaxed hand', () => {
      expect(detectDrawingGesture(buildHand())).toBeNull();
    });

    it('returns null when middle is curled but index is only half-bent', () => {
      const hand = buildHand({ index: 'half', middle: 'curled' });
      expect(detectDrawingGesture(hand)).toBeNull();
    });
  });

  describe('missing landmarks', () => {
    it('returns null when every landmark entry is undefined', () => {
      const sparse = new Array(21) as NormalizedLandmark[];
      expect(detectDrawingGesture(sparse)).toBeNull();
      expect(detectDrawingGesture(sparse, true)).toBeNull();
    });

    it.each([
      ['wrist', 0],
      ['index tip', 8],
      ['middle tip', 12],
      ['ring tip', 16],
      ['pinky tip', 20],
    ])('returns null when the %s is missing', (_name, idx) => {
      const hand = buildHand();
      delete (hand as Array<NormalizedLandmark | undefined>)[idx];
      expect(detectDrawingGesture(hand)).toBeNull();
    });

    it('treats missing joints as neither extended nor curled', () => {
      const hand = buildHand({ index: 'extended', middle: 'curled' });
      delete (hand as Array<NormalizedLandmark | undefined>)[6]; // index pip
      expect(detectDrawingGesture(hand)).not.toBe(DrawingGesture.Fist);
      expect(detectDrawingGesture(hand)).not.toBe(DrawingGesture.Pointing);
    });
  });

  describe('angle clamping', () => {
    it('handles floating point drift outside [-1, 1] without returning NaN', () => {
      // Collinear points can produce cos slightly > 1 or < -1.
      const hand = buildHand({ middle: 'curled' });
      hand[5] = lm(0.1, 0.1);
      hand[6] = lm(0.3, 0.3);
      hand[8] = lm(0.7, 0.7);
      expect(detectDrawingGesture(hand)).toBe(DrawingGesture.Pointing);
    });
  });
});

describe('getIndexFingerTip', () => {
  it('returns the x/y of the index fingertip', () => {
    const hand = buildHand();
    hand[8] = lm(0.123, 0.456);
    expect(getIndexFingerTip(hand)).toEqual({ x: 0.123, y: 0.456 });
  });

  it('does not leak z or visibility', () => {
    const tip = getIndexFingerTip(buildHand());
    expect(Object.keys(tip!).sort()).toEqual(['x', 'y']);
  });

  it.each([0, 20, 22])('returns null when given %i landmarks', (count) => {
    const landmarks = Array.from({ length: count }, () => lm(0, 0));
    expect(getIndexFingerTip(landmarks)).toBeNull();
  });

  it('returns null when the index tip entry is missing', () => {
    const hand = buildHand();
    delete (hand as Array<NormalizedLandmark | undefined>)[8];
    expect(getIndexFingerTip(hand)).toBeNull();
  });
});
