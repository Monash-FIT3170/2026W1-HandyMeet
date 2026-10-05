import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get('room');
  const username = req.nextUrl.searchParams.get('username');

  if (!room || !username) {
    return NextResponse.json(
      { error: 'Missing room or username' },
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

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: username,
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
