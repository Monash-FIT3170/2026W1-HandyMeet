'use client';

import { useParticipants } from '@livekit/components-react';
import { useEffect, useRef } from 'react';

/**
 * Resolves a participant's display name from their identity.
 *
 * Identities are suffixed with a random UUID (see app/api/token/route.ts) to
 * keep them unique, so they aren't fit to show to users. Names are
 * remembered as participants are seen so a participant who has since
 * disconnected still resolves to their last known name instead of their
 * raw identity.
 */
export function useParticipantNames() {
  const participants = useParticipants();
  const namesRef = useRef(new Map<string, string>());

  useEffect(() => {
    for (const p of participants) {
      const name = p.name?.trim();
      if (name) namesRef.current.set(p.identity, name);
    }
  }, [participants]);

  return (identity: string) => namesRef.current.get(identity) ?? identity;
}
