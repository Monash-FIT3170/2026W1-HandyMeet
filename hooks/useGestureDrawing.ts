import { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
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

type UseGestureDrawingOptions = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
};

export function useGestureDrawing({
  videoRef,
  enabled,
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
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);

  const currentStrokeRef = useRef<DrawingStroke>([]);
  const enabledRef = useRef(enabled);

  const positionHistoryRef = useRef<DrawingPoint[]>([]);
  const gestureStabilityRef = useRef<number>(0);
  const lastPositionRef = useRef<DrawingPoint | null>(null);

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
        numHands: 1,
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

  const clearStrokes = useCallback(() => {
    setStrokes([]);
    currentStrokeRef.current = [];
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

        if (wasDrawing && currentStrokeRef.current.length > 0) {
          setStrokes((prev) => [...prev, [...currentStrokeRef.current]]);
          currentStrokeRef.current = [];
        }
        wasDrawing = false;
        setIsDrawing(false);

        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const landmarks = results.landmarks[0];
      if (!landmarks) {
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const gesture = detectDrawingGesture(landmarks, wasDrawing);
      setCurrentGesture(gesture);

      const fingerTip = getIndexFingerTip(landmarks);

      if (fingerTip) {
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

        if (gesture === DrawingGesture.Pointing) {
          gestureStabilityRef.current++;

          const isStable =
            gestureStabilityRef.current >= STABILITY_FRAMES_REQUIRED;

          if (isStable) {
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
            }

            lastPositionRef.current = smoothedPosition;
          }
        } else if (gesture === DrawingGesture.Fist) {
          gestureStabilityRef.current = 0;
          lastPositionRef.current = null;

          if (wasDrawing && currentStrokeRef.current.length > 0) {
            setStrokes((prev) => [...prev, [...currentStrokeRef.current]]);
            currentStrokeRef.current = [];
          }
          wasDrawing = false;
          setIsDrawing(false);
        } else {
          gestureStabilityRef.current = 0;
        }
      } else {
        setCursorPosition(null);
        positionHistoryRef.current = [];
        gestureStabilityRef.current = 0;
        lastPositionRef.current = null;
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
    strokes,
    clearStrokes,
  };
}
