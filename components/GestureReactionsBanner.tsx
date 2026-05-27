'use client';

import { useRoomContext } from '@livekit/components-react';
import { useIncomingReaction } from '@/hooks/useIncomingReaction';
import { Reaction, REACTION_MAP } from '@/constants/reactions';

export default function GestureReactionsBanner() {
  const room = useRoomContext();
  const { reaction, participant } = useIncomingReaction(room);

  const meta = reaction ? REACTION_MAP[reaction as Reaction] : null;
  if (!meta) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 py-2.5 bg-neutral-800 border border-neutral-600 rounded-lg shadow-lg"
    >
      <span className="text-2xl">{meta.emoji}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 truncate">
          {participant?.identity}
        </span>
        <span className="text-sm font-bold text-neutral-100 truncate">
          {meta.label}
        </span>
      </div>
    </div>
  );
}
