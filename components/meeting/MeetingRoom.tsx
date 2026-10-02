'use client';

import {
  CarouselLayout,
  Chat,
  ConnectionStateToast,
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
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import LocalCameraTile, { isLocalCameraTrack } from './LocalCameraTile';
import LeaveConfirmDialog from '@/components/LeaveConfirmDialog';
import ActionItemSidebar from '@/components/action-items/ActionItemSidebar';
import {
  EMPTY_UNREAD_SUGGESTION_STATE,
  getNextUnreadSuggestionState,
  shouldAutoOpenActionItems,
} from '@/helpers/actionItems';
import { predictGestureAction } from '@/helpers/gestures/gestureDetector';
import { useHandLandmarker } from '@/hooks/useHandLandmarker';
import { useLiveActionItems } from '@/hooks/useLiveActionItems';
import { useMeetingParticipants } from '@/hooks/useMeetingParticipants';

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

export type MeetingControls = {
  trackingEnabled: boolean;
  overlayEnabled: boolean;
  isTracking: boolean;
  onToggleTracking: () => void;
  onToggleOverlay: () => void;
  insightsEnabled: boolean;
  onToggleInsights: () => void;
  onLeave: () => void;
};

type MeetingRoomProps = {
  onLeave: (transcriptLines: string[]) => void;
  renderControls: (controls: MeetingControls) => ReactNode;
  onLocalVideoRef?: (video: HTMLVideoElement | null) => void;
};

export default function MeetingRoom({
  onLeave,
  renderControls,
  onLocalVideoRef,
}: MeetingRoomProps) {
  const [widgetState, setWidgetState] =
    useState<WidgetState>(initialWidgetState);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [insightsEnabled, setInsightsEnabled] = useState(false);
  const [actionItemsOpen, setActionItemsOpen] = useState(false);
  const [unreadSuggestions, setUnreadSuggestions] = useState(
    EMPTY_UNREAD_SUGGESTION_STATE,
  );
  const hasAutoOpenedActionItemsRef = useRef(false);
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

  // Checks for completed transcript lines every second and only calls Groq
  // when there is new text to process.
  const liveActionItems = useLiveActionItems({
    transcriptLines,
    enabled: insightsEnabled,
  });
  const autoOpenActionItems = shouldAutoOpenActionItems(
    hasAutoOpenedActionItemsRef.current,
    liveActionItems.actionItems.length,
  );
  const actionItemSidebarOpen = actionItemsOpen || autoOpenActionItems;

  useEffect(() => {
    if (!autoOpenActionItems) return;

    hasAutoOpenedActionItemsRef.current = true;
    setActionItemsOpen(true);
  }, [autoOpenActionItems]);

  useEffect(() => {
    setUnreadSuggestions((current) =>
      getNextUnreadSuggestionState(
        current,
        liveActionItems.actionItems,
        actionItemSidebarOpen,
      ),
    );
  }, [actionItemSidebarOpen, liveActionItems.actionItems]);
  void liveActionItems;
  const confirmLeave = useCallback(() => {
    setShowLeaveConfirm(false);
    onLeave(transcriptLines);
  }, [onLeave, transcriptLines]);

  const cancelLeave = useCallback(() => {
    setShowLeaveConfirm(false);
  }, []);

  const participants = useMeetingParticipants();

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

          {renderControls({
            trackingEnabled,
            overlayEnabled,
            isTracking,
            onToggleTracking: handleToggleTracking,
            onToggleOverlay: handleToggleOverlay,
            insightsEnabled,
            onToggleInsights: () => setInsightsEnabled((prev) => !prev),
            onLeave: handleLeave,
          })}
          {/* Leave confirmation dialog */}
          {showLeaveConfirm && (
            <div className="fixed inset-0 z-[70]">
              <LeaveConfirmDialog
                onConfirm={confirmLeave}
                onCancel={cancelLeave}
              />
            </div>
          )}
        </div>
        {/*  End lk-video-conference-inner  */}

        <Chat style={{ display: widgetState.showChat ? 'grid' : 'none' }} />
      </LayoutContextProvider>

      {insightsEnabled && (
        <ActionItemSidebar
          open={actionItemSidebarOpen}
          chatOpen={widgetState.showChat}
          isLoading={liveActionItems.isLoading}
          error={liveActionItems.error}
          unreadCount={unreadSuggestions.count}
          items={liveActionItems.actionItems}
          onCollapse={() => setActionItemsOpen(false)}
          onExpand={() => setActionItemsOpen(true)}
          onAccept={liveActionItems.acceptItem}
          onEdit={(id, newTask) =>
            liveActionItems.editItem(id, { task: newTask })
          }
          onDismiss={liveActionItems.dismissItem}
          onAssign={liveActionItems.assignUser}
          participants={participants}
        />
      )}

      <RoomAudioRenderer />
      <StartAudio label="Click to allow audio playback" />
      <ConnectionStateToast />
    </div>
  );
}
