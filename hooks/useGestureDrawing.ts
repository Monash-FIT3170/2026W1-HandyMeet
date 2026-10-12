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

// 2 hands = noisier tracking than 1, so smooth more and allow less jump
const SMOOTHING_WINDOW = 6;
const JUMP_THRESHOLD = 0.15;
// need a few fist frames in a row before drawing, so 1 bad frame can't start a line
const STABILITY_FRAMES_REQUIRED = 3;

// cursor hand always tracks its fingertip no matter its pose - moving it
// never toggles drawing. the other hand is "control": fist = draw, anything
// else = stop. keeps one hand switching pose from shifting the cursor.
//
// control isn't hardcoded to left/right, it's whichever hand is fisted, so
// it works for both. we keep it sticky by label so missing a fist for 1
// frame doesn't swap hands mid-stroke.

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
  const controlHandLabelRef = useRef<string | null>(null);
  const cursorHandLabelRef = useRef<string | null>(null);

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
      resetState();
      return;
    }

    let wasDrawing = false;
    let controlStability = 0;

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
          label:
            results.handedness[index]?.[0]?.categoryName ?? `hand-${index}`,
          landmarks,
          gesture: detectDrawingGesture(landmarks, wasDrawing),
        }),
      );

      // need 2 hands to have a control hand - with only 1, just use it as
      // the cursor. only update controlHandLabelRef in here, so briefly
      // losing track of a hand (e.g. an open palm reads as 1 hand for a
      // moment) can't wipe the sticky memory and cause a swap
      let controlHand = null;
      if (hands.length > 1) {
        controlHand =
          // both fists at once? stay on whoever was already in control
          hands.find(
            (h) =>
              h.label === controlHandLabelRef.current &&
              h.gesture === DrawingGesture.Fist,
          ) ??
          hands.find((h) => h.gesture === DrawingGesture.Fist) ??
          hands.find((h) => h.label === controlHandLabelRef.current) ??
          hands[1];
        controlHandLabelRef.current = controlHand.label;
      }

      const cursorHand = controlHand
        ? hands.find((h) => h !== controlHand)!
        : hands[0];

      const fingerTip = cursorHand
        ? getIndexFingerTip(cursorHand.landmarks)
        : null;

      if (!fingerTip) {
        setCursorPosition(null);
        setCurrentGesture(null);
        positionHistoryRef.current = [];
        controlHandLabelRef.current = null;
        cursorHandLabelRef.current = null;
        stopDrawing();
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      // cursor hand changed (drawing hand swapped with control) - clear the
      // smoothing history so it doesn't blend old + new hand positions into
      // a phantom line, and start a fresh stroke at the new hand
      if (
        cursorHandLabelRef.current !== null &&
        cursorHandLabelRef.current !== cursorHand.label
      ) {
        positionHistoryRef.current = [];
        lastPositionRef.current = null;
        if (wasDrawing && currentStrokeRef.current.length > 0) {
          onStrokeCompleteRef.current?.([...currentStrokeRef.current]);
          currentStrokeRef.current = [];
        }
      }
      cursorHandLabelRef.current = cursorHand.label;

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

      const controlGesture = controlHand?.gesture ?? null;
      setCurrentGesture(controlGesture);

      if (controlGesture === DrawingGesture.Fist) {
        controlStability++;

        if (controlStability >= STABILITY_FRAMES_REQUIRED) {
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
        }
      } else {
        controlStability = 0;
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
