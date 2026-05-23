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
  useTranscriptions,
  useLocalParticipant,
} from '@livekit/components-react';
import type {
  TrackReference,
  TrackReferenceOrPlaceholder,
  WidgetState,
} from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import LocalCameraTile, { isLocalCameraTrack } from './LocalCameraTile';
import TranscriptionSettings from '@/components/TranscriptionSettings';
import type { CaptionSettings } from '@/components/TranscriptionSettings';
import TranscriptSummary from '@/components/TranscriptSummary';
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

type MeetingRoomProps = {
  captionSettings: CaptionSettings;
  onCaptionSettingsChange: (s: CaptionSettings) => void;
};

export default function MeetingRoom({
  captionSettings,
  onCaptionSettingsChange,
}: MeetingRoomProps) {
  const [widgetState, setWidgetState] =
    useState<WidgetState>(initialWidgetState);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const [showTranscriptSummary, setShowTranscriptSummary] = useState(false);
  const transcriptions = useTranscriptions();
  const { isCameraEnabled } = useLocalParticipant();
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
  ).filter(
    (track) => !track.participant.identity.toLowerCase().startsWith('agent-'),
  ); // To remove the agent from the UI view
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

  const router = useRouter();
  const { isTracking } = useHandLandmarker({
    videoRef: localVideoRef,
    canvasRef: localCanvasRef,
    trackingEnabled,
    overlayEnabled,
    onLandmarksSnapshot: async (snapshot) => {
      await fetch('/api/gesture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldLandmarks: snapshot.worldLandmarks,
          handedness: snapshot.handedness,
        }),
      });
    },
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

  const transcriptLines = transcriptions.map(
    (t) => `${t.participantInfo?.identity ?? 'Unknown'}: ${t.text}`,
  );

  const handleLeave = () => {
    setShowTranscriptSummary(true);
  };

  const handleSummaryClose = () => {
    setShowTranscriptSummary(false);
    router.push('/');
  };

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

          {/* Control bar row — ControlBar sits inside a flex wrapper alongside custom buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              borderTop: '1px solid var(--lk-border-color)',
            }}
          >
            <ControlBar
              controls={{ chat: true, settings: false, leave: false }}
              style={{ border: 'none', padding: 0, gap: '0.5rem' }}
            />
            {/* Captions button — settings panel floats above it */}
            <div style={{ position: 'relative' }}>
              {captionsOpen && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 0.5rem)',
                    right: 0,
                    zIndex: 9999,
                  }}
                >
                  <TranscriptionSettings
                    settings={captionSettings}
                    onChange={onCaptionSettingsChange}
                    open={captionsOpen}
                    onClose={() => setCaptionsOpen(false)}
                  />
                </div>
              )}
              <button
                className="lk-button"
                aria-pressed={captionsOpen}
                onClick={() => setCaptionsOpen((v) => !v)}
                title="Customise captions"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M8 10.5h4" />
                  <path d="M14 10.5h4" />
                  <path d="M8 14.5h4" />
                  <path d="M14 14.5h2" />
                </svg>
                Captions
              </button>
            </div>
            <button className="lk-button" onClick={handleLeave}>
              Leave
            </button>

            {showTranscriptSummary && (
              <TranscriptSummary
                transcript={transcriptLines}
                onClose={handleSummaryClose}
              />
            )}
          </div>

          {/* Hand tracking controls */}
          <div className="fixed bottom-24 right-4 flex flex-col gap-2 z-50">
            <button
              onClick={handleToggleTracking}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                trackingEnabled
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {trackingEnabled ? 'Tracking On' : 'Tracking Off'}
            </button>

            <button
              onClick={handleToggleOverlay}
              disabled={!trackingEnabled}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                overlayEnabled
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {overlayEnabled ? 'Overlay On' : 'Overlay Off'}
            </button>

            {trackingEnabled && (
              <p
                className={`text-xs text-center ${isTracking ? 'text-emerald-400' : 'text-neutral-500'}`}
              >
                {isTracking ? 'Hand detected' : 'No hand detected'}
              </p>
            )}
          </div>

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

        {/* Chat panel — shown/hidden by LiveKit widget state */}
        <Chat style={{ display: widgetState.showChat ? 'grid' : 'none' }} />
      </LayoutContextProvider>

      <RoomAudioRenderer />
      <StartAudio label="Click to allow audio playback" />
      <ConnectionStateToast />
    </div>
  );
}
