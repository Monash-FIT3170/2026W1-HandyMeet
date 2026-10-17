import { useEffect, useState, type RefObject } from 'react';
import {
  RoomEvent,
  Track,
  type Participant,
  type Room,
  type TrackPublication,
} from 'livekit-client';

type UseHandTrackingCameraOptions = {
  room: Room;
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
};

export function useHandTrackingCamera({
  room,
  videoRef,
  enabled,
}: UseHandTrackingCameraOptions) {
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video) return;

    let disposed = false;
    let requestId = 0;
    let stream: MediaStream | null = null;
    let sourceTrack: MediaStreamTrack | undefined;

    const stopStream = (cameraStream: MediaStream | null) => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };

    const startCamera = async () => {
      const cameraTrack = room.localParticipant.getTrackPublication(
        Track.Source.Camera,
      )?.track?.mediaStreamTrack;
      const sharedTrack =
        cameraTrack?.readyState === 'live' && cameraTrack.enabled
          ? cameraTrack
          : undefined;

      if (sharedTrack && sharedTrack === sourceTrack) return;

      const currentRequestId = ++requestId;
      let nextStream: MediaStream | null = null;

      try {
        if (sharedTrack) {
          // A clone keeps receiving frames when LiveKit stops or mutes its track.
          // This stream is only attached locally and is never published.
          nextStream = new MediaStream([sharedTrack.clone()]);
        } else {
          const deviceId = room.getActiveDevice('videoinput');
          nextStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: deviceId ? { deviceId: { exact: deviceId } } : true,
          });
        }

        if (disposed || currentRequestId !== requestId) {
          stopStream(nextStream);
          return;
        }

        const previousStream = stream;
        stream = nextStream;
        sourceTrack = sharedTrack;
        video.srcObject = stream;
        stopStream(previousStream);
        await video.play();

        if (!disposed && currentRequestId === requestId) {
          setCameraError(null);
        }
      } catch {
        if (nextStream !== stream) stopStream(nextStream);
        if (!disposed && currentRequestId === requestId) {
          stopStream(stream);
          stream = null;
          sourceTrack = undefined;
          video.srcObject = null;
          setCameraError(
            'Unable to access the camera for hand tracking. Check camera permissions, then turn hand tracking off and on to retry.',
          );
        }
      }
    };

    const handleCameraAvailable = (
      publication: TrackPublication,
      participant: Participant,
    ) => {
      if (
        publication.source === Track.Source.Camera &&
        participant === room.localParticipant
      ) {
        void startCamera();
      }
    };
    const handleDeviceChanged = (kind: MediaDeviceKind) => {
      if (kind === 'videoinput') void startCamera();
    };

    room.on(RoomEvent.LocalTrackPublished, handleCameraAvailable);
    room.on(RoomEvent.TrackUnmuted, handleCameraAvailable);
    room.on(RoomEvent.ActiveDeviceChanged, handleDeviceChanged);
    void startCamera();

    return () => {
      disposed = true;
      room.off(RoomEvent.LocalTrackPublished, handleCameraAvailable);
      room.off(RoomEvent.TrackUnmuted, handleCameraAvailable);
      room.off(RoomEvent.ActiveDeviceChanged, handleDeviceChanged);
      video.srcObject = null;
      stopStream(stream);
    };
  }, [enabled, room, videoRef]);

  return { cameraError: enabled ? cameraError : null };
}
