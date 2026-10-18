import { POST } from './route';

function roomRequest(body: Record<string, string>): Request {
  return new Request('http://localhost/api/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/room', () => {
  test('returns 400 when room is missing', async () => {
    const response = await POST(roomRequest({ username: 'sam' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/Missing room or username/);
  });

  test('returns 400 when username is missing', async () => {
    const response = await POST(roomRequest({ room: 'standup' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/Missing room or username/);
  });

  test('does not set any cookies when the request is rejected', async () => {
    const response = await POST(roomRequest({ room: 'standup' }));

    expect(response.cookies.get('room')).toBeUndefined();
    expect(response.cookies.get('username')).toBeUndefined();
  });

  test('stores the room and username in httpOnly cookies', async () => {
    const response = await POST(
      roomRequest({ room: 'standup', username: 'sam' }),
    );

    expect(response.status).toBe(200);

    const room = response.cookies.get('room');
    const username = response.cookies.get('username');

    expect(room?.value).toBe('standup');
    expect(username?.value).toBe('sam');

    for (const cookie of [room, username]) {
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe('lax');
      expect(cookie?.path).toBe('/');
      expect(cookie?.maxAge).toBe(60 * 60 * 4);
    }
  });

  test('does not expose the room code in the response body', async () => {
    const response = await POST(
      roomRequest({ room: 'standup', username: 'sam' }),
    );

    expect(JSON.stringify(await response.json())).not.toContain('standup');
  });
});
