'use client';

import { ParticipantTile } from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track } from 'livekit-client';

type LocalCameraTileProps = {
  trackRef?: TrackReferenceOrPlaceholder;
};

export function isLocalCameraTrack(trackRef?: TrackReferenceOrPlaceholder) {
  return (
    trackRef?.participant.isLocal && trackRef.source === Track.Source.Camera
  );
}

export default function LocalCameraTile({ trackRef }: LocalCameraTileProps) {
  return <ParticipantTile trackRef={trackRef} />;
}
