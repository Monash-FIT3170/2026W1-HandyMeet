'use client';

import { useRoomContext } from '@livekit/components-react';
import { useIncomingReaction } from '@/hooks/useIncomingReaction';

export default function GestureReactionsBanner() {
  const room = useRoomContext();
  const { reaction, participant } = useIncomingReaction(room);

  if (!reaction) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-black text-white px-4 py-2 rounded">
      {participant?.identity} gestured: {reaction}
    </div>
  );
}
