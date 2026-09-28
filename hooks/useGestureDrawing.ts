import { useEffect, useRef, useState, useCallback } from 'react';
import {
  HandLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import {
  detectDrawingGesture,
  getIndexFingerTip,
} from '@/helpers/gestures/drawingGestureDetector';
import { DrawingGesture } from '@/constants/gestures';

export type DrawingPoint = { x: number; y: number };
export type DrawingStroke = DrawingPoint[];

const SMOOTHING_WINDOW = 3;
const JUMP_THRESHOLD = 0.3;

// The cursor hand always tracks its index fingertip, whatever pose it's in,
// so positioning it never has to change its own gesture. The other hand
// (whichever one that is) is the control hand: making a fist with it turns
// drawing on, anything else turns it off. This avoids having a single hand
// switch pose to start/stop drawing, which was shifting the cursor.
// Flip this if it feels backwards - it depends on how the camera reports
// handedness for a mirrored selfie view.
const CURSOR_HAND_LABEL = 'Right';

type UseGestureDrawingOptions = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  onStrokeComplete?: (stroke: DrawingStroke) => void;
  onStrokeUpdate?: (stroke: DrawingStroke) => void;
};

export function useGestureDrawing({
  videoRef,
  enabled,
  onStrokeComplete,
  onStrokeUpdate,
}: UseGestureDrawingOptions) {
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<DrawingPoint | null>(
    null,
  );
  const [currentGesture, setCurrentGesture] = useState<DrawingGesture | null>(
    null,
  );

  const currentStrokeRef = useRef<DrawingStroke>([]);
  const onStrokeCompleteRef = useRef(onStrokeComplete);
  const onStrokeUpdateRef = useRef(onStrokeUpdate);
  const enabledRef = useRef(enabled);

  const positionHistoryRef = useRef<DrawingPoint[]>([]);
  const lastPositionRef = useRef<DrawingPoint | null>(null);

  useEffect(() => {
    onStrokeCompleteRef.current = onStrokeComplete;
  }, [onStrokeComplete]);

  useEffect(() => {
    onStrokeUpdateRef.current = onStrokeUpdate;
  }, [onStrokeUpdate]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    async function createHandLandmarker() {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );

      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
      });
    }

    createHandLandmarker();

    return () => {
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  const resetState = useCallback(() => {
    setCursorPosition(null);
    setIsDrawing(false);
    setCurrentGesture(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Cleanup is legitimate here
      resetState();
      return;
    }

    let wasDrawing = false;

    function stopDrawing() {
      if (wasDrawing && currentStrokeRef.current.length > 0) {
        onStrokeCompleteRef.current?.([...currentStrokeRef.current]);
        currentStrokeRef.current = [];
      }
      wasDrawing = false;
      setIsDrawing(false);
      lastPositionRef.current = null;
    }

    function detect() {
      if (!enabledRef.current) {
        return;
      }

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (
        !video ||
        !landmarker ||
        video.readyState < 2 ||
        video.currentTime === lastVideoTimeRef.current
      ) {
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      lastVideoTimeRef.current = video.currentTime;

      const results = landmarker.detectForVideo(video, performance.now());

      const hands = results.landmarks.map(
        (landmarks: NormalizedLandmark[], index: number) => ({
          label: results.handedness[index]?.[0]?.categoryName ?? null,
          landmarks,
        }),
      );

      const cursorHand = hands.find((h) => h.label === CURSOR_HAND_LABEL);
      const controlHand = hands.find((h) => h !== cursorHand);

      const fingerTip = cursorHand
        ? getIndexFingerTip(cursorHand.landmarks)
        : null;

      if (!fingerTip) {
        setCursorPosition(null);
        setCurrentGesture(null);
        positionHistoryRef.current = [];
        stopDrawing();
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const mirroredX = 1 - fingerTip.x;
      const rawPosition = { x: mirroredX, y: fingerTip.y };

      positionHistoryRef.current.push(rawPosition);
      if (positionHistoryRef.current.length > SMOOTHING_WINDOW) {
        positionHistoryRef.current.shift();
      }

      const smoothedPosition = {
        x:
          positionHistoryRef.current.reduce((sum, p) => sum + p.x, 0) /
          positionHistoryRef.current.length,
        y:
          positionHistoryRef.current.reduce((sum, p) => sum + p.y, 0) /
          positionHistoryRef.current.length,
      };

      setCursorPosition(smoothedPosition);

      const controlGesture = controlHand
        ? detectDrawingGesture(controlHand.landmarks, wasDrawing)
        : null;
      setCurrentGesture(controlGesture);

      if (controlGesture === DrawingGesture.Fist) {
        const lastPos = lastPositionRef.current;
        const jumped =
          lastPos &&
          Math.hypot(
            smoothedPosition.x - lastPos.x,
            smoothedPosition.y - lastPos.y,
          ) > JUMP_THRESHOLD;

        if (!wasDrawing) {
          wasDrawing = true;
          setIsDrawing(true);
          currentStrokeRef.current = [];
        }

        if (!jumped) {
          currentStrokeRef.current.push(smoothedPosition);
          onStrokeUpdateRef.current?.([...currentStrokeRef.current]);
        }

        lastPositionRef.current = smoothedPosition;
      } else {
        stopDrawing();
      }

      animationFrameRef.current = requestAnimationFrame(detect);
    }

    animationFrameRef.current = requestAnimationFrame(detect);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [enabled, videoRef, resetState]);

  return {
    isDrawing,
    cursorPosition,
    currentGesture,
  };
}
