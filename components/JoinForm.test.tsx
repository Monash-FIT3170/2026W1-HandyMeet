/** @jest-environment jsdom */
import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import JoinForm from './JoinForm';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const fetchMock = jest.fn();

function mockFetchResponse(status: number, body: unknown = {}) {
  fetchMock.mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });
}

function sessionRequestBody() {
  const call = fetchMock.mock.calls.find(([url]) => url === '/api/room');
  return call ? JSON.parse(call[1].body) : undefined;
}

function roomExistsCalled() {
  return fetchMock.mock.calls.some(([url]) =>
    String(url).includes('/api/room-exists'),
  );
}

function nameInput(): HTMLInputElement {
  return screen.getByPlaceholderText('Your name') as HTMLInputElement;
}

function codeInput(placeholder = 'Room code'): HTMLInputElement {
  return screen.getByPlaceholderText(placeholder) as HTMLInputElement;
}

function submitButton(label: RegExp): HTMLButtonElement {
  return screen.getByRole('button', { name: label }) as HTMLButtonElement;
}

async function submit(label: RegExp) {
  await act(async () => {
    fireEvent.click(submitButton(label));
  });
}

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;

  fetchMock.mockImplementation(async (url: string) =>
    url === '/api/room'
      ? { status: 200, ok: true, json: async () => ({ ok: true }) }
      : { status: 500, ok: false, json: async () => ({}) },
  );
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(cleanup);

describe('JoinForm', () => {
  describe('mode selection', () => {
    test('shows only the Create and Join buttons initially', () => {
      render(<JoinForm />);

      expect(screen.getByText('Get started')).toBeTruthy();
      expect(submitButton(/create meeting/i)).toBeTruthy();
      expect(submitButton(/join meeting/i)).toBeTruthy();
      expect(screen.queryByPlaceholderText('Your name')).toBeNull();
    });

    test('reveals the create form when Create Meeting is clicked', () => {
      render(<JoinForm />);
      fireEvent.click(submitButton(/create meeting/i));

      expect(screen.getByText('Create a meeting')).toBeTruthy();
      expect(nameInput()).toBeTruthy();
      expect(codeInput('Room code (optional)')).toBeTruthy();
    });

    test('reveals the join form when Join Meeting is clicked', () => {
      render(<JoinForm />);
      fireEvent.click(submitButton(/join meeting/i));

      expect(screen.getByText('Join a meeting')).toBeTruthy();
      expect(nameInput()).toBeTruthy();
      expect(codeInput()).toBeTruthy();
    });

    test('Back returns to selection and clears the room code and errors', async () => {
      render(<JoinForm />);
      fireEvent.click(submitButton(/join meeting/i));
      fireEvent.change(codeInput(), { target: { value: 'ab' } });
      await submit(/join meeting/i);
      expect(screen.getByText('Please enter your name.')).toBeTruthy();

      fireEvent.click(submitButton(/back/i));
      expect(screen.getByText('Get started')).toBeTruthy();

      fireEvent.click(submitButton(/join meeting/i));
      expect(codeInput().value).toBe('');
      expect(screen.queryByText('Please enter your name.')).toBeNull();
    });
  });

  describe('input limits', () => {
    test('room code input is uppercased and stripped of non-alphanumerics', () => {
      render(<JoinForm />);
      fireEvent.click(submitButton(/join meeting/i));
      fireEvent.change(codeInput(), { target: { value: 'ab-c 1!2' } });

      expect(codeInput().value).toBe('ABC12');
    });

    test('name and room code inputs enforce max lengths', () => {
      render(<JoinForm />);
      fireEvent.click(submitButton(/join meeting/i));

      expect(nameInput().maxLength).toBe(30);
      expect(codeInput().maxLength).toBe(12);
    });
  });

  describe('creating a meeting', () => {
    beforeEach(() => {
      render(<JoinForm />);
      fireEvent.click(submitButton(/create meeting/i));
    });

    test('shows an error and does not navigate when name is empty', async () => {
      fireEvent.change(nameInput(), { target: { value: '   ' } });
      await submit(/create meeting/i);

      expect(screen.getByText('Please enter your name.')).toBeTruthy();
      expect(nameInput().getAttribute('aria-invalid')).toBe('true');
      expect(push).not.toHaveBeenCalled();
    });

    test('clears the name error once the user types', async () => {
      await submit(/create meeting/i);
      fireEvent.change(nameInput(), { target: { value: 'S' } });

      expect(screen.queryByText('Please enter your name.')).toBeNull();
      expect(nameInput().getAttribute('aria-invalid')).toBe('false');
    });

    test('rejects a custom room code shorter than 3 characters', async () => {
      fireEvent.change(nameInput(), { target: { value: 'Sam' } });
      fireEvent.change(codeInput('Room code (optional)'), {
        target: { value: 'AB' },
      });
      await submit(/create meeting/i);

      expect(
        screen.getByText('Room code must be at least 3 characters.'),
      ).toBeTruthy();
      expect(push).not.toHaveBeenCalled();
    });

    test('starts a session with the trimmed name and uppercased room code, then opens /room', async () => {
      fireEvent.change(nameInput(), { target: { value: '  Sam Lee  ' } });
      fireEvent.change(codeInput('Room code (optional)'), {
        target: { value: 'standup' },
      });
      await submit(/create meeting/i);

      expect(sessionRequestBody()).toEqual({
        room: 'STANDUP',
        username: 'Sam Lee',
      });
      expect(push).toHaveBeenCalledWith('/room');
    });

    test('generates a 6-character room code when none is given', async () => {
      fireEvent.change(nameInput(), { target: { value: 'Sam' } });
      await submit(/create meeting/i);

      expect(sessionRequestBody().room).toMatch(/^[A-Z0-9]{6}$/);
      expect(push).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith('/room');
    });

    test('does not check whether the room exists', async () => {
      fireEvent.change(nameInput(), { target: { value: 'Sam' } });
      await submit(/create meeting/i);

      expect(roomExistsCalled()).toBe(false);
    });

    test('submits when Enter is pressed in the form', async () => {
      fireEvent.change(nameInput(), { target: { value: 'Sam' } });
      await act(async () => {
        fireEvent.submit(nameInput().form!);
      });

      expect(push).toHaveBeenCalledTimes(1);
    });
  });

  describe('joining a meeting', () => {
    beforeEach(() => {
      render(<JoinForm />);
      fireEvent.click(submitButton(/join meeting/i));
    });

    function fillIn(name: string, code: string) {
      fireEvent.change(nameInput(), { target: { value: name } });
      fireEvent.change(codeInput(), { target: { value: code } });
    }

    test('shows name and room code errors together when both are missing', async () => {
      await submit(/join meeting/i);

      expect(screen.getByText('Please enter your name.')).toBeTruthy();
      expect(screen.getByText('Please enter a room code.')).toBeTruthy();
      expect(codeInput().getAttribute('aria-invalid')).toBe('true');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('rejects a room code shorter than 3 characters without calling the API', async () => {
      fillIn('Sam', 'AB');
      await submit(/join meeting/i);

      expect(
        screen.getByText('Room code must be at least 3 characters.'),
      ).toBeTruthy();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('checks the room exists and navigates when it does', async () => {
      mockFetchResponse(200, { exists: true });
      fillIn(' Sam ', 'abc123');
      await submit(/join meeting/i);

      expect(fetchMock).toHaveBeenCalledWith('/api/room-exists?room=ABC123');
      expect(sessionRequestBody()).toEqual({ room: 'ABC123', username: 'Sam' });
      expect(push).toHaveBeenCalledWith('/room');
    });

    test('shows a not-found error when the room does not exist', async () => {
      mockFetchResponse(200, { exists: false });
      fillIn('Sam', 'NOPE');
      await submit(/join meeting/i);

      expect(
        screen.getByText(
          'No meeting found with code "NOPE". Check the code and try again.',
        ),
      ).toBeTruthy();
      expect(sessionRequestBody()).toBeUndefined();
      expect(push).not.toHaveBeenCalled();
    });

    test('shows a not-found error when the API returns a 4xx', async () => {
      mockFetchResponse(400, { error: 'Missing room' });
      fillIn('Sam', 'ABC');
      await submit(/join meeting/i);

      expect(screen.getByText(/No meeting found with code "ABC"/)).toBeTruthy();
      expect(push).not.toHaveBeenCalled();
    });

    test('shows a server error when the API returns a 5xx', async () => {
      mockFetchResponse(500);
      fillIn('Sam', 'ABC');
      await submit(/join meeting/i);

      expect(
        screen.getByText('Something went wrong on our end. Please try again.'),
      ).toBeTruthy();
      expect(push).not.toHaveBeenCalled();
    });

    test('shows a verification error when the request fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'));
      fillIn('Sam', 'ABC');
      await submit(/join meeting/i);

      expect(
        screen.getByText('Could not verify the room code. Please try again.'),
      ).toBeTruthy();
      expect(push).not.toHaveBeenCalled();
    });

    test('disables the button and shows Checking... while the request is pending', async () => {
      let resolve!: (value: unknown) => void;
      fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
      fillIn('Sam', 'ABC');
      await submit(/join meeting/i);

      const button = submitButton(/checking/i);
      expect(button.disabled).toBe(true);

      await act(async () => {
        resolve({
          status: 200,
          ok: true,
          json: async () => ({ exists: true }),
        });
      });
      expect(submitButton(/join meeting/i).disabled).toBe(false);
    });

    test('clears the not-found error when the room code is edited', async () => {
      mockFetchResponse(200, { exists: false });
      fillIn('Sam', 'NOPE');
      await submit(/join meeting/i);
      expect(screen.getByText(/No meeting found/)).toBeTruthy();

      fireEvent.change(codeInput(), { target: { value: 'NOPE2' } });
      expect(screen.queryByText(/No meeting found/)).toBeNull();
    });
  });
});
