'use client';

import { useParticipants } from '@livekit/components-react';

export type ParticipantOption = {
  id: string;
  name: string;
};

export function useMeetingParticipants(): ParticipantOption[] {
  const participants = useParticipants();

  return participants
    .filter((p) => !p.identity.toLowerCase().startsWith('agent-'))
    .map((p) => ({
      id: p.identity,
      name: p.name?.trim() || p.identity,
    }));
}
