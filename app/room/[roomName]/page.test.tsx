import { redirect } from 'next/navigation';
import RoomPage from './page';

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

function renderPage(roomName: string, username?: string) {
  return RoomPage({
    params: Promise.resolve({ roomName }),
    searchParams: Promise.resolve(username === undefined ? {} : { username }),
  });
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

  test('redirects home when the room code is longer than 12 characters', async () => {
    await expect(renderPage('A'.repeat(13), 'Sam')).rejects.toThrow(
      'NEXT_REDIRECT',
    );
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  test('measures the decoded room code length', async () => {
    // 12 characters once decoded, but 18 while still URL-encoded.
    await renderPage('%20%20%20ABCDEFGHI', 'Sam');

    expect(redirectMock).not.toHaveBeenCalled();
  });
});
