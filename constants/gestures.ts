import { CaptionGesture } from './captions';

export enum Gesture {
  CameraOff = 'cameraOff',
  EndCall = 'endCall',
  Mute = 'mute',
  Unmute = 'unmute',
  Pen = 'pen',
  Help = 'help',
}

export const SINGLE_HAND_CONFIDENCE_THRESHOLD = 0.9;
export const MULTI_HAND_CONFIDENCE_THRESHOLD = 0.9;
export const TWO_HAND_PREFERENCE_MARGIN = 0.05;

export const TWO_HAND_GESTURES: ReadonlySet<string> = new Set([
  Gesture.Pen,
  CaptionGesture.a,
  CaptionGesture.b,
  CaptionGesture.d,
  CaptionGesture.e,
  CaptionGesture.f,
  CaptionGesture.g,
  CaptionGesture.h,
  CaptionGesture.i,
  CaptionGesture.j,
  CaptionGesture.k,
  CaptionGesture.l,
  CaptionGesture.m,
  CaptionGesture.n,
  CaptionGesture.o,
  CaptionGesture.p,
  CaptionGesture.q,
  CaptionGesture.r,
  CaptionGesture.s,
  CaptionGesture.t,
  CaptionGesture.u,
  CaptionGesture.v,
  CaptionGesture.w,
  CaptionGesture.x,
  CaptionGesture.y,
  CaptionGesture.z,
  CaptionGesture.how,
]);
