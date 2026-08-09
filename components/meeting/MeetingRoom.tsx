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
  useRoomContext,
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
import LocalCameraTile, { isLocalCameraTrack } from './LocalCameraTile';
import TranscriptionSettings from '@/components/TranscriptionSettings';
import type { CaptionSettings } from '@/components/TranscriptionSettings';
import LeaveConfirmDialog from '@/components/LeaveConfirmDialog';
import ActionItemSidebar from '@/components/action-items/ActionItemSidebar';
import { predictGestureAction } from '@/helpers/gestures/gestureDetector';
import { useHandLandmarker } from '@/hooks/useHandLandmarker';
import { useLiveActionItems } from '@/hooks/useLiveActionItems';
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
  if (!otherTrack) return false;
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
  onLeave: (transcriptLines: string[]) => void;
  whiteboardOpen: boolean;
  onToggleWhiteboard: () => void;
  onLocalVideoRef?: (video: HTMLVideoElement | null) => void;
};

export default function MeetingRoom({
  captionSettings,
  onCaptionSettingsChange,
  onLeave,
  whiteboardOpen,
  onToggleWhiteboard,
  onLocalVideoRef,
}: MeetingRoomProps) {
  const [widgetState, setWidgetState] =
    useState<WidgetState>(initialWidgetState);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [insightsEnabled, setInsightsEnabled] = useState(false);
  const [actionItemsOpen, setActionItemsOpen] = useState(true);
  const transcriptions = useTranscriptions();
  const { isCameraEnabled } = useLocalParticipant();
  const room = useRoomContext();
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPredictingGestureRef = useRef(false);
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
  );

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare);

  const focusedTrack = usePinnedTracks(layoutContext)[0];
  const carouselTracks = tracks.filter(
    (track) => !isSameTrack(track, focusedTrack),
  );

  const setLocalVideoRef = useCallback(
    (video: HTMLVideoElement | null) => {
      localVideoRef.current = video;
      onLocalVideoRef?.(video);
    },
    [onLocalVideoRef],
  );
  const setLocalCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    localCanvasRef.current = canvas;
  }, []);

  const handleLeave = useCallback(() => {
    setShowLeaveConfirm(true);
  }, []);

  const { isTracking } = useHandLandmarker({
    videoRef: localVideoRef,
    canvasRef: localCanvasRef,
    trackingEnabled,
    overlayEnabled,
    onLandmarksSnapshot: async (snapshot) => {
      if (isPredictingGestureRef.current) return;
      isPredictingGestureRef.current = true;
      try {
        await predictGestureAction(room, snapshot.featureVectors, handleLeave);
      } finally {
        isPredictingGestureRef.current = false;
      }
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

  // Polls Groq every 12s for live action items while the meeting runs.
  const liveActionItems = useLiveActionItems({
    transcriptLines,
    enabled: insightsEnabled,
  });
  void liveActionItems;
  const confirmLeave = useCallback(() => {
    setShowLeaveConfirm(false);
    onLeave(transcriptLines);
  }, [onLeave, transcriptLines]);

  const cancelLeave = useCallback(() => {
    setShowLeaveConfirm(false);
  }, []);

  return (
    <div className="lk-video-conference">
      <LayoutContextProvider
        value={layoutContext}
        onWidgetChange={setWidgetState}
      >
        <div className="lk-video-conference-inner">
          {/*  Video area  */}
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

          {/*  Control bar  */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1.75rem',
              position: 'relative',
            }}
          >
            {/* Gradient accent line */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background:
                  'linear-gradient(90deg, transparent 0%, #10599A 20%, #7099C2 50%, #DB4C77 80%, transparent 100%)',
                opacity: 0.9,
              }}
            />

            {/* Left spacer */}
            <div style={{ flex: 1 }} />

            {/* Centre pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                borderRadius: '999px',
                padding: '0.3rem 0.5rem',
              }}
            >
              <ControlBar
                controls={{
                  microphone: true,
                  camera: true,
                  screenShare: true,
                  chat: true,
                  settings: false,
                  leave: false,
                }}
                style={{
                  border: 'none',
                  padding: 0,
                  gap: '0.25rem',
                  display: 'contents',
                }}
              />

              {/* Divider */}
              <div
                style={{
                  width: '1px',
                  height: '1.5rem',
                  background: 'rgba(255,255,255,0.08)',
                  margin: '0 0.25rem',
                  flexShrink: 0,
                }}
              />

              {/* Captions */}
              <div style={{ position: 'relative' }}>
                {captionsOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 0.75rem)',
                      left: '50%',
                      transform: 'translateX(-50%)',
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
                  title="Captions"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
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

              {/* Whiteboard */}
              <button
                className="lk-button"
                aria-pressed={whiteboardOpen}
                onClick={onToggleWhiteboard}
                title="Whiteboard"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
                Whiteboard
              </button>

              {/* Gestures */}
              <HandTrackingButton
                trackingEnabled={trackingEnabled}
                overlayEnabled={overlayEnabled}
                isTracking={isTracking}
                isCameraEnabled={isCameraEnabled}
                onToggleTracking={handleToggleTracking}
                onToggleOverlay={handleToggleOverlay}
              />

              {/* Live insights */}
              <button
                className="lk-button"
                aria-pressed={insightsEnabled}
                onClick={() => setInsightsEnabled((prev) => !prev)}
                title="Live insights"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v2" />
                  <path d="M12 19v2" />
                  <path d="M5 5l1.5 1.5" />
                  <path d="M17.5 17.5L19 19" />
                  <path d="M5 19l1.5-1.5" />
                  <path d="M17.5 6.5L19 5" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
                Insights
              </button>
            </div>

            {/* Right  Leave */}
            <div
              style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}
            >
              <button
                onClick={handleLeave}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.5rem 1.1rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(219,76,119,0.3)',
                  background: 'rgba(219,76,119,0.12)',
                  color: '#E88DA8',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  transition:
                    'background 0.15s, border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.background = 'rgba(219,76,119,0.28)';
                  b.style.borderColor = 'rgba(219,76,119,0.6)';
                  b.style.color = '#FCEEF2';
                }}
                onMouseLeave={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.background = 'rgba(219,76,119,0.12)';
                  b.style.borderColor = 'rgba(219,76,119,0.3)';
                  b.style.color = '#E88DA8';
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Leave
              </button>
            </div>
          </div>
          {/*  End control bar  */}
          {/* Leave confirmation dialog */}
          {showLeaveConfirm && (
            <LeaveConfirmDialog
              onConfirm={confirmLeave}
              onCancel={cancelLeave}
            />
          )}
        </div>
        {/*  End lk-video-conference-inner  */}

        <Chat style={{ display: widgetState.showChat ? 'grid' : 'none' }} />
      </LayoutContextProvider>

      <ActionItemSidebar
        open={actionItemsOpen}
        isLoading={liveActionItems.isLoading}
        onCollapse={() => setActionItemsOpen(false)}
        onExpand={() => setActionItemsOpen(true)}
      />

      <RoomAudioRenderer />
      <StartAudio label="Click to allow audio playback" />
      <ConnectionStateToast />
    </div>
  );
}
