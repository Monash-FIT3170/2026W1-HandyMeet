import type { Room } from "livekit-client";

import {
  ActionHandler,
  disableCamera,
  disableMicrophone,
  disconnectFromRoom,
  enableCamera,
  enableMicrophone,
  raiseHand,
  sendThumbsDown,
  sendThumbsUp,
} from "./actions";
import { Gesture } from "../../constants/gestures";
import { Reaction } from "../../constants/reactions";

type Action = Gesture | Reaction;

const actionEntries: Array<[Action, ActionHandler]> = [
  [Gesture.CameraOff, disableCamera],
  [Gesture.CameraOn, enableCamera],
  [Gesture.EndCall, disconnectFromRoom],
  [Gesture.Mute, disableMicrophone],
  [Reaction.RaiseHand, raiseHand],
  [Reaction.ThumbsDown, sendThumbsDown],
  [Reaction.ThumbsUp, sendThumbsUp],
  [Gesture.Unmute, enableMicrophone],
];

const actionMap = new Map<Action, ActionHandler>(actionEntries);

export const handleGestureAction = async (room: Room, action: Action): Promise<boolean> => {
  const handler = actionMap.get(action);

  if (!handler) {
    return false;
  }

  await handler(room);

  return true;
};
