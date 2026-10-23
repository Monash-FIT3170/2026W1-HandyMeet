import { redirect } from 'next/navigation';
import RoomPage from './page';

const mockCookies = new Map<string, string>();

jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      mockCookies.has(name)
        ? { name, value: mockCookies.get(name) }
        : undefined,
  }),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

jest.mock('@/components/RoomClient', () => ({
  __esModule: true,
  default: () => null,
}));

const redirectMock = redirect as unknown as jest.Mock;

function renderPage(roomName?: string, username?: string) {
  mockCookies.clear();
  if (roomName !== undefined) mockCookies.set('room', roomName);
  if (username !== undefined) mockCookies.set('username', username);
  return RoomPage();
}

beforeEach(() => redirectMock.mockClear());

describe('RoomPage', () => {
  test('renders the room with a trimmed username', async () => {
    const element = await renderPage('ABC123', '  Sam  ');

    expect(redirectMock).not.toHaveBeenCalled();
    expect(element.props).toEqual({ roomName: 'ABC123', username: 'Sam' });
  });

  test.each([
    ['missing', undefined],
    ['empty', ''],
    ['whitespace only', '   '],
    ['longer than 30 characters', 'a'.repeat(31)],
  ])('redirects home when the username is %s', async (_, username) => {
    await expect(renderPage('ABC123', username)).rejects.toThrow(
      'NEXT_REDIRECT',
    );
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  test('accepts a username of exactly 30 characters', async () => {
    await renderPage('ABC123', 'a'.repeat(30));

    expect(redirectMock).not.toHaveBeenCalled();
  });

  test('redirects home when there is no room cookie', async () => {
    await expect(renderPage(undefined, 'Sam')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  test('redirects home when there is no session at all', async () => {
    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  test('redirects home when the room code is longer than 12 characters', async () => {
    await expect(renderPage('A'.repeat(13), 'Sam')).rejects.toThrow(
      'NEXT_REDIRECT',
    );
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  test('accepts a room code of exactly 12 characters', async () => {
    await renderPage('A'.repeat(12), 'Sam');

    expect(redirectMock).not.toHaveBeenCalled();
  });
});
