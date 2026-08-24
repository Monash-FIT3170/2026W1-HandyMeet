import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from './route';

function tokenRequest(params: Record<string, string>): NextRequest {
  const search = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost/api/token?${search}`);
}

async function withLiveKitEnv<T>(
  values: { apiKey?: string; apiSecret?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const originalKey = process.env.LIVEKIT_API_KEY;
  const originalSecret = process.env.LIVEKIT_API_SECRET;

  if (values.apiKey === undefined) {
    delete process.env.LIVEKIT_API_KEY;
  } else {
    process.env.LIVEKIT_API_KEY = values.apiKey;
  }
  if (values.apiSecret === undefined) {
    delete process.env.LIVEKIT_API_SECRET;
  } else {
    process.env.LIVEKIT_API_SECRET = values.apiSecret;
  }

  try {
    return await fn();
  } finally {
    if (originalKey === undefined) {
      delete process.env.LIVEKIT_API_KEY;
    } else {
      process.env.LIVEKIT_API_KEY = originalKey;
    }
    if (originalSecret === undefined) {
      delete process.env.LIVEKIT_API_SECRET;
    } else {
      process.env.LIVEKIT_API_SECRET = originalSecret;
    }
  }
}

test('returns 400 when room is missing', async () => {
  const response = await GET(tokenRequest({ username: 'sam' }));

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /Missing room or username/);
});

test('returns 400 when username is missing', async () => {
  const response = await GET(tokenRequest({ room: 'standup' }));

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /Missing room or username/);
});

test('returns 500 when LiveKit server credentials are not configured', async () => {
  const response = await withLiveKitEnv({}, () =>
    GET(tokenRequest({ room: 'standup', username: 'sam' })),
  );

  assert.equal(response.status, 500);
  const body = await response.json();
  assert.match(body.error, /LiveKit server not configured/);
});

test('issues a signed access token scoped to the requested room and identity', async () => {
  const response = await withLiveKitEnv(
    { apiKey: 'test-key', apiSecret: 'test-secret' },
    () => GET(tokenRequest({ room: 'standup', username: 'sam' })),
  );

  assert.equal(response.status, 200);
  const body = await response.json();

  // A JWT is three base64url segments separated by dots.
  assert.match(body.token, /^[\w-]+\.[\w-]+\.[\w-]+$/);

  const payload = JSON.parse(
    Buffer.from(body.token.split('.')[1], 'base64url').toString('utf8'),
  );
  assert.equal(payload.sub, 'sam');
  assert.equal(payload.video.room, 'standup');
  assert.equal(payload.video.roomJoin, true);
});
