'use client';

import { ParticipantTile } from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useCallback, useEffect, useRef } from 'react';

type LocalCameraTileProps = {
  trackRef?: TrackReferenceOrPlaceholder;
  trackingEnabled: boolean;
  overlayEnabled: boolean;
  videoRef?: (video: HTMLVideoElement | null) => void;
  canvasRef?: (canvas: HTMLCanvasElement | null) => void;
};

export function isLocalCameraTrack(trackRef?: TrackReferenceOrPlaceholder) {
  return (
    trackRef?.participant.isLocal && trackRef.source === Track.Source.Camera
  );
}

export default function LocalCameraTile({
  trackRef,
  trackingEnabled,
  overlayEnabled,
  videoRef,
  canvasRef,
}: LocalCameraTileProps) {
  const tileRef = useRef<HTMLDivElement | null>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const showOverlay = trackingEnabled && overlayEnabled;

  const setCanvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      canvasElementRef.current = canvas;
      canvasRef?.(canvas);
    },
    [canvasRef],
  );

  useEffect(() => {
    const tile = tileRef.current;

    if (!tile) {
      videoRef?.(null);
      return;
    }

    const updateVideoRef = () => {
      videoRef?.(tile.querySelector('video'));
    };

    updateVideoRef();

    const observer = new MutationObserver(updateVideoRef);
    observer.observe(tile, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      videoRef?.(null);
    };
  }, [trackRef, videoRef]);

  useEffect(() => {
    if (showOverlay) {
      return;
    }

    const canvas = canvasElementRef.current;
    const context = canvas?.getContext('2d');

    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [showOverlay]);

  return (
    <div
      ref={tileRef}
      className="relative h-full w-full"
      data-hand-overlay-enabled={overlayEnabled}
      data-hand-tracking-enabled={trackingEnabled}
    >
      <ParticipantTile className="h-full w-full" trackRef={trackRef} />
      <canvas
        ref={setCanvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        style={{ display: showOverlay ? 'block' : 'none' }}
      />
    </div>
  );
}
