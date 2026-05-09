import type { Room } from "livekit-client";

import {
  disableCamera,
  disableMicrophone,
  disconnectFromRoom,
  enableCamera,
  enableMicrophone,
  GestureAction,
  GestureActionHandler,
} from "./actions";

const gestureActionMap: Map<GestureAction, GestureActionHandler> = new Map([
  [GestureAction.CameraOff, disableCamera],
  [GestureAction.CameraOn, enableCamera],
  [GestureAction.Disconnect, disconnectFromRoom],
  [GestureAction.MicOff, disableMicrophone],
  [GestureAction.MicOn, enableMicrophone],
]);


export const handleGestureAction = async (room: Room, action: GestureAction): Promise<boolean> => {
  const handler = gestureActionMap.get(action);

  if (!handler) {
    return false;
  }

  await handler(room);

  return true;
};
