import type { Room } from 'livekit-client';
import { Gesture } from '../../constants/gestures';
import { Action, handleAction } from '../gestures/handler';

let currentGesture: string | null = null;
let gestureStart = 0;
let triggered = false;

const HOLD_TIME = 1000; // Time in ms to consider a gesture as "held"

export async function processGesture(
  room: Room,
  detectedGesture: string | null,
  requestLeave?: () => void,
) {
  const now = Date.now();

  if (!detectedGesture) {
    currentGesture = null;
    triggered = false;
    return;
  }

  if (detectedGesture !== currentGesture) {
    currentGesture = detectedGesture;
    gestureStart = now;
    triggered = false;
    return;
  }

  const heldDuration = now - gestureStart;
  if (heldDuration >= HOLD_TIME && !triggered) {
    if (currentGesture === Gesture.EndCall) {
      requestLeave?.();
    } else {
      await handleAction(room, currentGesture as Action);
    }
    triggered = true;
  }
}
