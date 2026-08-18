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

const SMOOTHING_WINDOW = 5;
const STABILITY_FRAMES_REQUIRED = 4;
const JUMP_THRESHOLD = 0.15;

type HandState = {
  positionHistory: DrawingPoint[];
  gestureStability: number;
  lastPosition: DrawingPoint | null;
};

function createEmptyHandState(): HandState {
  return {
    positionHistory: [],
    gestureStability: 0,
    lastPosition: null,
  };
}

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

  const handStatesRef = useRef<Map<string, HandState>>(new Map());
  const activeHandLabelRef = useRef<string | null>(null);

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

      if (results.landmarks.length === 0) {
        setCursorPosition(null);
        setCurrentGesture(null);
        activeHandLabelRef.current = null;
        handStatesRef.current.clear();

        if (wasDrawing && currentStrokeRef.current.length > 0) {
          onStrokeCompleteRef.current?.([...currentStrokeRef.current]);
          currentStrokeRef.current = [];
        }
        wasDrawing = false;
        setIsDrawing(false);

        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const handsWithGestures = results.landmarks.map(
        (landmarks: NormalizedLandmark[], index: number) => {
          const handednessLabel =
            results.handedness[index]?.[0]?.categoryName ?? `hand-${index}`;
          return {
            label: handednessLabel,
            landmarks,
            gesture: detectDrawingGesture(landmarks, wasDrawing),
            fingerTip: getIndexFingerTip(landmarks),
          };
        },
      );

      const pointingHands = handsWithGestures.filter(
        (h) => h.gesture === DrawingGesture.Pointing,
      );

      let selectedHand = null;

      if (pointingHands.length > 0) {
        const currentActive = activeHandLabelRef.current;
        const stillPointing = pointingHands.find(
          (h) => h.label === currentActive,
        );
        selectedHand = stillPointing ?? pointingHands[0];
      } else {
        const fistHand = handsWithGestures.find(
          (h) => h.gesture === DrawingGesture.Fist,
        );
        if (fistHand) {
          selectedHand = fistHand;
        }
      }

      if (!selectedHand) {
        const anyHand = handsWithGestures[0];
        if (anyHand?.fingerTip) {
          const mirroredX = 1 - anyHand.fingerTip.x;
          setCursorPosition({ x: mirroredX, y: anyHand.fingerTip.y });
        } else {
          setCursorPosition(null);
        }
        setCurrentGesture(null);
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      activeHandLabelRef.current = selectedHand.label;
      setCurrentGesture(selectedHand.gesture);

      const fingerTip = selectedHand.fingerTip;

      if (fingerTip) {
        if (!handStatesRef.current.has(selectedHand.label)) {
          handStatesRef.current.set(selectedHand.label, createEmptyHandState());
        }
        const handState = handStatesRef.current.get(selectedHand.label)!;

        const mirroredX = 1 - fingerTip.x;
        const rawPosition = { x: mirroredX, y: fingerTip.y };

        handState.positionHistory.push(rawPosition);
        if (handState.positionHistory.length > SMOOTHING_WINDOW) {
          handState.positionHistory.shift();
        }

        const smoothedPosition = {
          x:
            handState.positionHistory.reduce((sum, p) => sum + p.x, 0) /
            handState.positionHistory.length,
          y:
            handState.positionHistory.reduce((sum, p) => sum + p.y, 0) /
            handState.positionHistory.length,
        };

        setCursorPosition(smoothedPosition);

        if (selectedHand.gesture === DrawingGesture.Pointing) {
          handState.gestureStability++;

          const isStable =
            handState.gestureStability >= STABILITY_FRAMES_REQUIRED;

          if (isStable) {
            const lastPos = handState.lastPosition;
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

            handState.lastPosition = smoothedPosition;
          }
        } else if (selectedHand.gesture === DrawingGesture.Fist) {
          handState.gestureStability = 0;
          handState.lastPosition = null;

          if (wasDrawing && currentStrokeRef.current.length > 0) {
            onStrokeCompleteRef.current?.([...currentStrokeRef.current]);
            currentStrokeRef.current = [];
          }
          wasDrawing = false;
          setIsDrawing(false);
        } else {
          handState.gestureStability = 0;
        }
      } else {
        setCursorPosition(null);
        handStatesRef.current.delete(selectedHand.label);
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
