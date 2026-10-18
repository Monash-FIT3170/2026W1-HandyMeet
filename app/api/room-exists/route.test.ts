import { NextRequest } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';
import { GET } from './route';

jest.mock('livekit-server-sdk', () => ({
  RoomServiceClient: jest.fn(),
}));

const listRooms = jest.fn();
const RoomServiceClientMock = RoomServiceClient as unknown as jest.Mock;

const ENV_KEYS = ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_URL'];
const originalEnv: Record<string, string | undefined> = {};

function roomExistsRequest(params: Record<string, string>): NextRequest {
  const search = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost/api/room-exists?${search}`);
}

beforeAll(() => {
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
});

beforeEach(() => {
  process.env.LIVEKIT_API_KEY = 'test-key';
  process.env.LIVEKIT_API_SECRET = 'test-secret';
  process.env.LIVEKIT_URL = 'wss://livekit.test';
  listRooms.mockReset();
  RoomServiceClientMock.mockReset();
  RoomServiceClientMock.mockImplementation(() => ({ listRooms }));
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe('GET /api/room-exists', () => {
  test('returns 400 when room is missing', async () => {
    const response = await GET(roomExistsRequest({}));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Missing room/);
    expect(listRooms).not.toHaveBeenCalled();
  });

  test.each(ENV_KEYS)('returns 500 when %s is not configured', async (key) => {
    delete process.env[key];

    const response = await GET(roomExistsRequest({ room: 'ABC' }));

    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(
      /LiveKit server not configured/,
    );
  });

  test('returns exists: true when LiveKit has an active room with that name', async () => {
    listRooms.mockResolvedValueOnce([{ name: 'ABC' }]);

    const response = await GET(roomExistsRequest({ room: 'ABC' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ exists: true });
    expect(RoomServiceClientMock).toHaveBeenCalledWith(
      'wss://livekit.test',
      'test-key',
      'test-secret',
    );
    expect(listRooms).toHaveBeenCalledWith(['ABC']);
  });

  test('returns exists: false when no active room matches', async () => {
    listRooms.mockResolvedValueOnce([]);

    const response = await GET(roomExistsRequest({ room: 'NOPE' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ exists: false });
  });
});
