import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { DrawingGesture } from '@/constants/gestures';

const FINGER_TIP_INDICES = {
  INDEX: 8,
  MIDDLE: 12,
};

const FINGER_PIP_INDICES = {
  INDEX: 6,
  MIDDLE: 10,
};

const FINGER_MCP_INDICES = {
  INDEX: 5,
  MIDDLE: 9,
};

const EXTENDED_ANGLE_THRESHOLD = 150;
const CURLED_ANGLE_THRESHOLD = 100;

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

export function detectDrawingGesture(
  landmarks: NormalizedLandmark[],
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
