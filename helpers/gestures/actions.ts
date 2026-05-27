import { Room, RemoteParticipant, RoomEvent } from 'livekit-client';
import { Reaction, ReactionTopic } from '../../constants/reactions';

/**
 * A standard handler for room-related actions.
 * @param room - The active LiveKit room instance.
 * @returns A promise that resolves when the action is complete.
 */
export type ActionHandler = (room: Room) => Promise<void> | void;

const sendReaction = async (room: Room, reaction: Reaction): Promise<void> => {
  const payload = new TextEncoder().encode(JSON.stringify({ reaction }));
  await room.localParticipant.publishData(payload, { topic: ReactionTopic });
  room.emit(
    RoomEvent.DataReceived,
    payload,
    room.localParticipant as unknown as RemoteParticipant,
    undefined,
    ReactionTopic,
  );
};

export const enableMicrophone: ActionHandler = async (
  room: Room,
): Promise<void> => {
  await room.localParticipant.setMicrophoneEnabled(true);
};

export const disableMicrophone: ActionHandler = async (
  room: Room,
): Promise<void> => {
  await room.localParticipant.setMicrophoneEnabled(false);
};

export const enableCamera: ActionHandler = async (
  room: Room,
): Promise<void> => {
  await room.localParticipant.setCameraEnabled(true);
};

export const disableCamera: ActionHandler = async (
  room: Room,
): Promise<void> => {
  await room.localParticipant.setCameraEnabled(false);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const togglePen: ActionHandler = async (room: Room): Promise<void> => {
  // Placeholder for pen toggle functionality
  console.log('Pen toggle action triggered');
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const requestHelp: ActionHandler = async (room: Room): Promise<void> => {
  // Placeholder for help request functionality
  console.log('Help request action triggered');
};

export const sendThumbsUp = async (room: Room): Promise<void> => {
  await sendReaction(room, Reaction.ThumbsUp);
};

export const sendThumbsDown = async (room: Room): Promise<void> => {
  await sendReaction(room, Reaction.ThumbsDown);
};

export const raiseHand = async (room: Room): Promise<void> => {
  await sendReaction(room, Reaction.RaiseHand);
};

export const sendHello = async (room: Room): Promise<void> => {
  await sendReaction(room, Reaction.Hello);
};

export const sendTired = async (room: Room): Promise<void> => {
  await sendReaction(room, Reaction.Tired);
};

export const sendOk = async (room: Room): Promise<void> => {
  await sendReaction(room, Reaction.Ok);
};

export const sendThankYou = async (room: Room): Promise<void> => {
  await sendReaction(room, Reaction.ThankYou);
};
