import { useEffect, useRef, useState } from 'react';
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from '@mediapipe/tasks-vision';

type UseHandLandmarkerOptions = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  trackingEnabled: boolean;
  overlayEnabled: boolean;
};

export function useHandLandmarker({
  videoRef,
  canvasRef,
  trackingEnabled,
  overlayEnabled,
}: UseHandLandmarkerOptions) {
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  // Holds the requestAnimationFrame ID so we can cancel it on cleanup
  const animationFrameRef = useRef<number | null>(null);
  // Tracks the last video timestamp to avoid re-processing the same frame
  const lastVideoTimeRef = useRef<number>(-1);

  const [isTracking, setIsTracking] = useState(false);

  // Initialise HandLandmarker
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

    // Destroy the landmarker when the component unmounts
    return () => {
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    // If tracking is disabled, cancel any running loop and clear the canvas
    if (!trackingEnabled) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      setTimeout(() => setIsTracking(false), 0);
      return;
    }

    // Detection loop
    function detect() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;

      // Skips if anything isn't ready yet
      if (
        !video ||
        !canvas ||
        !landmarker ||
        video.readyState < 2 ||
        video.currentTime === lastVideoTimeRef.current // same frame, skip
      ) {
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      // Match canvas dimensions to the video so landmarks are positioned correctly
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      lastVideoTimeRef.current = video.currentTime;

      // Run detection
      const results = landmarker.detectForVideo(video, performance.now());

      // Draw the skeleton if overlay is enabled
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        if (overlayEnabled && results.landmarks.length > 0) {
          const drawingUtils = new DrawingUtils(ctx);

          for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(
              landmarks,
              HandLandmarker.HAND_CONNECTIONS,
              { color: '#00FF00', lineWidth: 2 },
            );

            const keyLandmarks = [1, 4, 5, 9, 13, 17, 8, 12, 16, 20];

            drawingUtils.drawLandmarks(
              landmarks.filter((_, i) => keyLandmarks.includes(i)),
              {
                color: '#FF0000',
                lineWidth: 1,
                radius: 3,
              },
            );
          }
        }

        setIsTracking(results.landmarks.length > 0);

        ctx.restore();
      }

      animationFrameRef.current = requestAnimationFrame(detect);
    }

    animationFrameRef.current = requestAnimationFrame(detect);

    // Cancel the loop when trackingEnabled changes or component unmounts
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [trackingEnabled, overlayEnabled, videoRef, canvasRef]);

  return { isTracking };
}
