import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { room, username } = await req.json();

  if (!room || !username) {
    return NextResponse.json(
      { error: 'Missing room or username' },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ ok: true });
  const opts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 4,
  };
  res.cookies.set('room', room, opts);
  res.cookies.set('username', username, opts);
  return res;
}
