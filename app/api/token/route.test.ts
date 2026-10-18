import { GET } from './route';

const mockCookies = new Map<string, string>();

jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      mockCookies.has(name)
        ? { name, value: mockCookies.get(name) }
        : undefined,
  }),
}));

function setCookies(values: Record<string, string>) {
  mockCookies.clear();
  for (const [name, value] of Object.entries(values)) {
    mockCookies.set(name, value);
  }
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

describe('GET /api/token', () => {
  beforeEach(() => {
    mockCookies.clear();
  });

  test('returns 400 when the room cookie is missing', async () => {
    setCookies({ username: 'sam' });

    const response = await GET();

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/Missing room or username/);
  });

  test('returns 400 when the username cookie is missing', async () => {
    setCookies({ room: 'standup' });

    const response = await GET();

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/Missing room or username/);
  });

  test('returns 400 when username is longer than 30 characters', async () => {
    const response = await GET(
      tokenRequest({ room: 'standup', username: 'a'.repeat(31) }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/Room or username is too long/);
  });

  test('returns 400 when room is longer than 12 characters', async () => {
    const response = await GET(
      tokenRequest({ room: 'A'.repeat(13), username: 'sam' }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/Room or username is too long/);
  });

  test('accepts a username and room at exactly the maximum lengths', async () => {
    const response = await withLiveKitEnv(
      { apiKey: 'test-key', apiSecret: 'test-secret' },
      () =>
        GET(tokenRequest({ room: 'A'.repeat(12), username: 'a'.repeat(30) })),
    );

    expect(response.status).not.toBe(400);
  });

  test('returns 500 when LiveKit server credentials are not configured', async () => {
    setCookies({ room: 'standup', username: 'sam' });

    const response = await withLiveKitEnv({}, () => GET());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatch(/LiveKit server not configured/);
  });
});
