'use client';

import { useParticipants } from '@livekit/components-react';
import { useMemo } from 'react';

export type ParticipantOption = {
  id: string;
  name: string;
};

export function useMeetingParticipants(): ParticipantOption[] {
  const participants = useParticipants();

  return useMemo(
    () =>
      participants
        .filter(
          (participant) =>
            !participant.identity.toLowerCase().startsWith('agent-'),
        )
        .map((participant) => ({
          id: participant.identity,
          name: participant.name ?? participant.identity,
        })),
    [participants],
  );
}
