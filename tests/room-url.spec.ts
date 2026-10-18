import { expect, type Page, test } from '@playwright/test';

const ROOM_READY_TIMEOUT = 15_000;
const USERNAME = 'url-tester';

async function joinRoom(page: Page, visitedUrls: string[]) {
  const roomCode = `U${Date.now().toString(36).slice(-5)}`.toUpperCase();

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visitedUrls.push(frame.url());
  });

  await page.goto('/');
  await page.getByPlaceholder('Your name').fill(USERNAME);
  await page.getByPlaceholder('Room code').fill(roomCode);
  await page.getByRole('button', { name: 'Join Room' }).click();
  await expect(page).toHaveURL(/\/room$/);
  await expect(page.getByTitle('Captions')).toBeVisible({
    timeout: ROOM_READY_TIMEOUT,
  });

  return roomCode;
}

test.describe('Given a user joins a HandyMeet room', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ permissions: ['camera', 'microphone'] });

  test('Then the room code and username never appear in the URL', async ({
    page,
  }) => {
    const visitedUrls: string[] = [];
    const roomCode = await joinRoom(page, visitedUrls);

    await page.reload();
    await expect(page).toHaveURL(/\/room$/);
    // Still in the room after a reload, so the session survived without the URL
    await expect(page.getByTitle('Captions')).toBeVisible({
      timeout: ROOM_READY_TIMEOUT,
    });

    for (const url of [...visitedUrls, page.url()]) {
      expect(url).not.toContain(roomCode);
      expect(url).not.toContain(USERNAME);
    }
  });

  test('Then the session cookies are httpOnly and hidden from page scripts', async ({
    page,
    context,
  }) => {
    const roomCode = await joinRoom(page, []);

    const cookies = await context.cookies();
    const room = cookies.find((cookie) => cookie.name === 'room');
    const username = cookies.find((cookie) => cookie.name === 'username');

    expect(room?.value).toBe(roomCode);
    expect(room?.httpOnly).toBe(true);
    expect(username?.value).toBe(USERNAME);
    expect(username?.httpOnly).toBe(true);

    const scriptVisibleCookies = await page.evaluate(() => document.cookie);
    expect(scriptVisibleCookies).not.toContain(roomCode);
    expect(scriptVisibleCookies).not.toContain(USERNAME);
  });
});

test.describe('Given a user has not joined a room', () => {
  test('Then visiting /room redirects to the home page', async ({ page }) => {
    await page.goto('/room');
    await expect(page).toHaveURL('/');
  });

  test('Then the old /room/<code> URL format no longer exists', async ({
    page,
  }) => {
    const response = await page.goto('/room/OLD123?username=someone');
    expect(response?.status()).toBe(404);
  });
});
