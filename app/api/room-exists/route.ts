import { RoomServiceClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get('room');

  if (!room) {
    return NextResponse.json({ error: 'Missing room' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json(
      { error: 'LiveKit server not configured' },
      { status: 500 },
    );
  }

  const roomService = new RoomServiceClient(url, apiKey, apiSecret);
  const rooms = await roomService.listRooms([room]);

  return NextResponse.json({ exists: rooms.length > 0 });
}
