export enum Gesture {
  CameraOff = 'cameraOff',
  CameraOn = 'cameraOn',
  EndCall = 'endCall',
  Mute = 'mute',
  Unmute = 'unmute',
  Pen = 'pen',
  Help = 'help',
}

export const SINGLE_HAND_CONFIDENCE_THRESHOLD = 0.9;
export const MULTI_HAND_CONFIDENCE_THRESHOLD = 0.8;
export const TWO_HAND_PREFERENCE_MARGIN = 0.1;
export const TWO_HAND_GESTURES: ReadonlySet<string> = new Set([Gesture.Pen]);
