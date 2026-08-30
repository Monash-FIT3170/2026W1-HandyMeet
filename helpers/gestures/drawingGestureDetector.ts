import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { DrawingGesture } from '@/constants/gestures';

const WRIST_INDEX = 0;

const FINGER_TIP_INDICES = {
  INDEX: 8,
  MIDDLE: 12,
  RING: 16,
  PINKY: 20,
};

const FINGER_PIP_INDICES = {
  INDEX: 6,
  MIDDLE: 10,
  RING: 14,
  PINKY: 18,
};

const FINGER_MCP_INDICES = {
  INDEX: 5,
  MIDDLE: 9,
  RING: 13,
  PINKY: 17,
};

const EXTENDED_ANGLE_THRESHOLD = 150;
const CURLED_ANGLE_THRESHOLD = 100;
const POINTING_DISTANCE_RATIO = 1.3;

function calculateAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark,
): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };

  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
  const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y);

  if (magAB === 0 || magCB === 0) return 180;

  const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function isFingerExtended(
  landmarks: NormalizedLandmark[],
  tipIndex: number,
  pipIndex: number,
  mcpIndex: number,
): boolean {
  const tip = landmarks[tipIndex];
  const pip = landmarks[pipIndex];
  const mcp = landmarks[mcpIndex];

  if (!tip || !pip || !mcp) return false;

  const angle = calculateAngle(mcp, pip, tip);
  return angle >= EXTENDED_ANGLE_THRESHOLD;
}

function isFingerCurled(
  landmarks: NormalizedLandmark[],
  tipIndex: number,
  pipIndex: number,
  mcpIndex: number,
): boolean {
  const tip = landmarks[tipIndex];
  const pip = landmarks[pipIndex];
  const mcp = landmarks[mcpIndex];

  if (!tip || !pip || !mcp) return false;

  const angle = calculateAngle(mcp, pip, tip);
  return angle < CURLED_ANGLE_THRESHOLD;
}

function isIndexClearlyExtended(landmarks: NormalizedLandmark[]): boolean {
  const indexExtended = isFingerExtended(
    landmarks,
    FINGER_TIP_INDICES.INDEX,
    FINGER_PIP_INDICES.INDEX,
    FINGER_MCP_INDICES.INDEX,
  );

  const middleExtended = isFingerExtended(
    landmarks,
    FINGER_TIP_INDICES.MIDDLE,
    FINGER_PIP_INDICES.MIDDLE,
    FINGER_MCP_INDICES.MIDDLE,
  );

  return indexExtended && !middleExtended;
}

function isPointingByDistance(landmarks: NormalizedLandmark[]): boolean {
  const wrist = landmarks[WRIST_INDEX];
  const indexTip = landmarks[FINGER_TIP_INDICES.INDEX];
  const middleTip = landmarks[FINGER_TIP_INDICES.MIDDLE];
  const ringTip = landmarks[FINGER_TIP_INDICES.RING];
  const pinkyTip = landmarks[FINGER_TIP_INDICES.PINKY];

  if (!wrist || !indexTip || !middleTip || !ringTip || !pinkyTip) return false;

  const indexDist = distance(wrist, indexTip);
  const middleDist = distance(wrist, middleTip);
  const ringDist = distance(wrist, ringTip);
  const pinkyDist = distance(wrist, pinkyTip);

  const avgOtherDist = (middleDist + ringDist + pinkyDist) / 3;

  return indexDist > avgOtherDist * POINTING_DISTANCE_RATIO;
}

export function detectDrawingGesture(
  landmarks: NormalizedLandmark[],
  isCurrentlyDrawing = false,
): DrawingGesture | null {
  if (landmarks.length !== 21) return null;

  const indexExtended = isFingerExtended(
    landmarks,
    FINGER_TIP_INDICES.INDEX,
    FINGER_PIP_INDICES.INDEX,
    FINGER_MCP_INDICES.INDEX,
  );

  const indexCurled = isFingerCurled(
    landmarks,
    FINGER_TIP_INDICES.INDEX,
    FINGER_PIP_INDICES.INDEX,
    FINGER_MCP_INDICES.INDEX,
  );

  const middleCurled = isFingerCurled(
    landmarks,
    FINGER_TIP_INDICES.MIDDLE,
    FINGER_PIP_INDICES.MIDDLE,
    FINGER_MCP_INDICES.MIDDLE,
  );

  if (indexCurled && middleCurled) {
    return DrawingGesture.Fist;
  }

  if (indexExtended && middleCurled) {
    return DrawingGesture.Pointing;
  }

  if (isCurrentlyDrawing && isIndexClearlyExtended(landmarks)) {
    return DrawingGesture.Pointing;
  }

  if (isPointingByDistance(landmarks)) {
    return DrawingGesture.Pointing;
  }

  return null;
}

export function getIndexFingerTip(
  landmarks: NormalizedLandmark[],
): { x: number; y: number } | null {
  if (landmarks.length !== 21) return null;

  const tip = landmarks[FINGER_TIP_INDICES.INDEX];
  if (!tip) return null;

  return { x: tip.x, y: tip.y };
}
