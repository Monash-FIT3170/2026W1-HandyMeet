import type { Room } from "livekit-client";

export enum GestureAction {
  CameraOff = "camera_off",
  CameraOn = "camera_on",
  Disconnect = "disconnect",
  MicOff = "mic_off",
  MicOn = "mic_on",
}

export type GestureActionHandler = (room: Room) => Promise<void> | void;

export const enableMicrophone = async (room: Room): Promise<void> => {
  await room.localParticipant.setMicrophoneEnabled(true);
};

export const disableMicrophone = async (room: Room): Promise<void> => {
  await room.localParticipant.setMicrophoneEnabled(false);
};

export const enableCamera = async (room: Room): Promise<void> => {
  await room.localParticipant.setCameraEnabled(true);
};

export const disableCamera = async (room: Room): Promise<void> => {
  await room.localParticipant.setCameraEnabled(false);
};

export const disconnectFromRoom = (room: Room): void => {
  room.disconnect();
};
