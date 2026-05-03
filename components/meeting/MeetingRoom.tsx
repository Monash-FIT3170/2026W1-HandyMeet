'use client';

import {
  Chat,
  ConnectionStateToast,
  ControlBar,
  GridLayout,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
  useCreateLayoutContext,
  useTracks,
} from '@livekit/components-react';
import type { WidgetState } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useState } from 'react';

const initialWidgetState: WidgetState = {
  showChat: false,
  showSettings: false,
  unreadMessages: 0,
};

export default function MeetingRoom() {
  const [widgetState, setWidgetState] =
    useState<WidgetState>(initialWidgetState);
  const layoutContext = useCreateLayoutContext();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  return (
    <div className="lk-video-conference">
      <LayoutContextProvider
        value={layoutContext}
        onWidgetChange={setWidgetState}
      >
        <div className="lk-video-conference-inner">
          <div className="lk-grid-layout-wrapper">
            <GridLayout tracks={tracks}>
              <ParticipantTile />
            </GridLayout>
          </div>

          <ControlBar controls={{ chat: true, settings: false }} />
        </div>

        <Chat style={{ display: widgetState.showChat ? 'grid' : 'none' }} />
      </LayoutContextProvider>

      <RoomAudioRenderer />
      <StartAudio label="Click to allow audio playback" />
      <ConnectionStateToast />
    </div>
  );
}
