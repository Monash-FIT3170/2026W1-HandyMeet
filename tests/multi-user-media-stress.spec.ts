/*
import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  test,
} from '@playwright/test';

const USER_COUNT = 10;
const ROOM_READY_TIMEOUT = 30_000;

function createRoomCode() {
  return `S${Date.now().toString(36).slice(-5)}`.toUpperCase();
}

async function joinRoom(page: Page, username: string, roomCode: string) {
  await page.goto('/');
  await page.getByPlaceholder('Your name').fill(username);
  await page.getByPlaceholder('Room code').fill(roomCode);
  await page.getByRole('button', { name: 'Join Room' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/room/${roomCode}\\?username=${username}`),
  );
  await expect(page.getByTitle('Captions')).toBeVisible({
    timeout: ROOM_READY_TIMEOUT,
  });
}

async function createFakeUser(browser: Browser, username: string) {
  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
  });
  const page = await context.newPage();

  return { context, page, username };
}

test.describe('multi-user media stress test', () => {
  test('connects 10 users with fake camera and microphone media', async ({
    browser,
  }) => {
    const roomCode = createRoomCode();
    const users = await Promise.all(
      Array.from({ length: USER_COUNT }, (_, index) =>
        createFakeUser(browser, `stress-user-${index + 1}`),
      ),
    );

    try {
      await Promise.all(
        users.map(({ page, username }) => joinRoom(page, username, roomCode)),
      );

      await expect
        .poll(() => users[0].page.locator('.lk-participant-tile').count(), {
          timeout: ROOM_READY_TIMEOUT,
        })
        .toBe(USER_COUNT);
    } finally {
      await Promise.all(
        users.map(async ({ context }: { context: BrowserContext }) => {
          await context.close();
        }),
      );
    }
  });
});
*/
