'use client';

import {
  CarouselLayout,
  Chat,
  ConnectionStateToast,
  ControlBar,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
  isTrackReference,
  useCreateLayoutContext,
  useMaybeTrackRefContext,
  usePinnedTracks,
  useTracks,
  useLocalParticipant,
} from '@livekit/components-react';
import type {
  TrackReference,
  TrackReferenceOrPlaceholder,
  WidgetState,
} from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import LocalCameraTile, { isLocalCameraTrack } from './LocalCameraTile';
import { useHandLandmarker } from '@/hooks/useHandLandmarker';
import HandTrackingButton from '../button/HandTrackingButton';

const initialWidgetState: WidgetState = {
  showChat: false,
  showSettings: false,
  unreadMessages: 0,
};

function isSameTrack(
  track: TrackReferenceOrPlaceholder,
  otherTrack?: TrackReferenceOrPlaceholder,
) {
  if (!otherTrack) {
    return false;
  }

  return (
    track.participant.identity === otherTrack.participant.identity &&
    track.source === otherTrack.source
  );
}

type MeetingTileProps = {
  trackRef?: TrackReferenceOrPlaceholder;
  trackingEnabled: boolean;
  overlayEnabled: boolean;
  videoRef?: (video: HTMLVideoElement | null) => void;
  canvasRef?: (canvas: HTMLCanvasElement | null) => void;
};

function MeetingTile({
  trackRef,
  trackingEnabled,
  overlayEnabled,
  videoRef,
  canvasRef,
}: MeetingTileProps) {
  const trackRefFromContext = useMaybeTrackRefContext();
  const resolvedTrackRef = trackRef ?? trackRefFromContext;

  if (isLocalCameraTrack(resolvedTrackRef)) {
    return (
      <LocalCameraTile
        trackRef={resolvedTrackRef}
        trackingEnabled={trackingEnabled}
        overlayEnabled={overlayEnabled}
        videoRef={videoRef}
        canvasRef={canvasRef}
      />
    );
  }

  return <ParticipantTile trackRef={resolvedTrackRef} />;
}

export default function MeetingRoom() {
  const [widgetState, setWidgetState] =
    useState<WidgetState>(initialWidgetState);
  const { isCameraEnabled } = useLocalParticipant();
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const layoutContext = useCreateLayoutContext();
  const autoFocusedScreenShare = useRef<TrackReference | null>(null);
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    {
      updateOnlyOn: [RoomEvent.ActiveSpeakersChanged],
      onlySubscribed: false,
    },
  );
  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare);
  const focusedTrack = usePinnedTracks(layoutContext)[0];
  const carouselTracks = tracks.filter(
    (track) => !isSameTrack(track, focusedTrack),
  );
  const setLocalVideoRef = useCallback((video: HTMLVideoElement | null) => {
    localVideoRef.current = video;
  }, []);
  const setLocalCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    localCanvasRef.current = canvas;
  }, []);

  const { isTracking } = useHandLandmarker({
    videoRef: localVideoRef,
    canvasRef: localCanvasRef,
    trackingEnabled,
    overlayEnabled,
  });

  useEffect(() => {
    if (!isCameraEnabled) {
      setTimeout(() => {
        setTrackingEnabled(false);
        setOverlayEnabled(false);
      }, 0);
    }
  }, [isCameraEnabled]);

  function handleToggleTracking() {
    setTrackingEnabled((prev) => {
      if (prev) setOverlayEnabled(false);
      return !prev;
    });
  }

  function handleToggleOverlay() {
    if (!trackingEnabled) return;
    setOverlayEnabled((prev) => !prev);
  }

  useEffect(() => {
    const subscribedScreenShare = screenShareTracks.find(
      (track) => track.publication.isSubscribed,
    );

    if (subscribedScreenShare && autoFocusedScreenShare.current === null) {
      layoutContext.pin.dispatch?.({
        msg: 'set_pin',
        trackReference: subscribedScreenShare,
      });
      autoFocusedScreenShare.current = subscribedScreenShare;
      return;
    }

    const autoFocusedTrackGone =
      autoFocusedScreenShare.current &&
      !screenShareTracks.some(
        (track) =>
          track.publication.trackSid ===
          autoFocusedScreenShare.current?.publication.trackSid,
      );

    if (autoFocusedTrackGone) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      autoFocusedScreenShare.current = null;
    }
  }, [layoutContext.pin, screenShareTracks]);

  return (
    <div className="lk-video-conference">
      <LayoutContextProvider
        value={layoutContext}
        onWidgetChange={setWidgetState}
      >
        <div className="lk-video-conference-inner">
          {focusedTrack ? (
            <div className="lk-focus-layout-wrapper">
              <FocusLayoutContainer>
                <CarouselLayout tracks={carouselTracks}>
                  <MeetingTile
                    trackingEnabled={trackingEnabled}
                    overlayEnabled={overlayEnabled}
                    videoRef={setLocalVideoRef}
                    canvasRef={setLocalCanvasRef}
                  />
                </CarouselLayout>
                {isLocalCameraTrack(focusedTrack) ? (
                  <LocalCameraTile
                    trackRef={focusedTrack}
                    trackingEnabled={trackingEnabled}
                    overlayEnabled={overlayEnabled}
                    videoRef={setLocalVideoRef}
                    canvasRef={setLocalCanvasRef}
                  />
                ) : (
                  <FocusLayout trackRef={focusedTrack} />
                )}
              </FocusLayoutContainer>
            </div>
          ) : (
            <div className="lk-grid-layout-wrapper">
              <GridLayout tracks={tracks}>
                <MeetingTile
                  trackingEnabled={trackingEnabled}
                  overlayEnabled={overlayEnabled}
                  videoRef={setLocalVideoRef}
                  canvasRef={setLocalCanvasRef}
                />
              </GridLayout>
            </div>
          )}

          <div className="relative flex items-center justify-center">
            <ControlBar controls={{ chat: true, settings: false }} />
            <div className="absolute right-20">
              <HandTrackingButton
                trackingEnabled={trackingEnabled}
                overlayEnabled={overlayEnabled}
                isTracking={isTracking}
                isCameraEnabled={isCameraEnabled}
                onToggleTracking={handleToggleTracking}
                onToggleOverlay={handleToggleOverlay}
              />
            </div>
          </div>
        </div>

        <Chat style={{ display: widgetState.showChat ? 'grid' : 'none' }} />
      </LayoutContextProvider>

      <RoomAudioRenderer />
      <StartAudio label="Click to allow audio playback" />
      <ConnectionStateToast />
    </div>
  );
}
