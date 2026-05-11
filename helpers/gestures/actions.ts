import type { Room } from "livekit-client";
import { Reaction, ReactionTopic } from "../../constants/reactions";

/**
 * A standard handler for room-related actions.
 * @param room - The active LiveKit room instance.
 * @returns A promise that resolves when the action is complete.
 */
export type ActionHandler = (room: Room) => Promise<void> | void;

const sendReaction = async (room: Room, reaction: Reaction): Promise<void> => {
  const payload = new TextEncoder().encode(JSON.stringify({ reaction }));
  await room.localParticipant.publishData(payload, { topic: ReactionTopic });
};

export const enableMicrophone: ActionHandler = async (room: Room): Promise<void> => {
  await room.localParticipant.setMicrophoneEnabled(true);
};

export const disableMicrophone: ActionHandler = async (room: Room): Promise<void> => {
  await room.localParticipant.setMicrophoneEnabled(false);
};

export const enableCamera: ActionHandler = async (room: Room): Promise<void> => {
  await room.localParticipant.setCameraEnabled(true);
};

export const disableCamera: ActionHandler = async (room: Room): Promise<void> => {
  await room.localParticipant.setCameraEnabled(false);
};

export const disconnectFromRoom: ActionHandler = (room: Room): void => {
  room.disconnect();
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
