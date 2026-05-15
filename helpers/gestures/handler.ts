import type { Room } from "livekit-client";
import { Gesture } from "../../constants/gestures";
import { Reaction } from "../../constants/reactions";
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
  sendHello,
  sendTired,
  sendOk,
  sendThankYou
} from "./actions";

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
  [Reaction.Hello, sendHello],
  [Reaction.Tired, sendTired],
  [Reaction.Ok, sendOk],
  [Reaction.ThankYou, sendThankYou]
];

const actionMap = new Map<Action, ActionHandler>(actionEntries);

/**
 * Processes a gesture or reaction by looking up and executing its associated handler.
 * 
 * @param room - The LiveKit room where the action should occur.
 * @param action - The specific Gesture or Reaction to trigger.
 * @returns `true` if the action was recognized and executed, `false` otherwise.
 * 
 * @example
 * await handleAction(room, Gesture.Mute);
 */
export const handleAction = async (room: Room, action: Action): Promise<boolean> => {
  const handler = actionMap.get(action);

  if (!handler) {
    return false;
  }

  await handler(room);

  return true;
};
