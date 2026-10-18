import { cookies } from 'next/headers';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { ROOM_CODE_MAX_LENGTH, USERNAME_MAX_LENGTH } from '@/constants/meeting';

export async function GET() {
  const jar = await cookies();
  const room = jar.get('room')?.value;
  const username = jar.get('username')?.value;

  if (!room || !username) {
    return NextResponse.json(
      { error: 'Missing room or username' },
      { status: 400 },
    );
  }

  if (
    username.length > USERNAME_MAX_LENGTH ||
    room.length > ROOM_CODE_MAX_LENGTH
  ) {
    return NextResponse.json(
      { error: 'Room or username is too long' },
      { status: 400 },
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'LiveKit server not configured' },
      { status: 500 },
    );
  }

  const identity = `${username}-${randomUUID()}`;
  const url = process.env.LIVEKIT_URL;
  const name = url
    ? await resolveDisplayName(
        new RoomServiceClient(url, apiKey, apiSecret),
        room,
        username,
      )
    : username;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: '10m',
  });

  token.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
  });

  const jwt = await token.toJwt();

  return NextResponse.json({ token: jwt });
}

/**
 * Numbers participants who share a display name so they can be told apart,
 */
async function resolveDisplayName(
  roomService: RoomServiceClient,
  room: string,
  username: string,
): Promise<string> {
  let participants;
  try {
    participants = await roomService.listParticipants(room);
  } catch {
    // Room doesn't exist yet (e.g. creating a meeting), so the name is free.
    return username;
  }

  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const numbered = new RegExp(`^${escaped}\\((\\d+)\\)$`);

  let unnumbered: string | undefined;
  let highest = 0;
  for (const p of participants) {
    if (p.name === username) {
      unnumbered = p.identity;
      continue;
    }
    const match = p.name.match(numbered);
    if (match) highest = Math.max(highest, Number(match[1]));
  }

  if (!unnumbered && highest === 0) return username;

  if (unnumbered) {
    highest += 1;
    await roomService
      .updateParticipant(room, unnumbered, { name: `${username}(${highest})` })
      .catch(() => {});
  }

  return `${username}(${highest + 1})`;
}
