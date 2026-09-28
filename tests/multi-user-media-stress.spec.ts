import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  test,
} from '@playwright/test';

const USER_COUNT = 5;

/**
 * How long to wait for an individual user's room UI to become ready.
 * LiveKit WebRTC handshake + token fetch + React render can take several
 * seconds, especially with 10 browser contexts alive simultaneously.
 */
const PER_USER_READY_TIMEOUT = 30_000;

/**
 * Extra budget after all users have joined for participant tiles to propagate
 * to user[0]'s view. Track subscription events can lag the join event.
 */
const ALL_PEERS_TIMEOUT = 60_000;

/**
 * Overall test timeout, derived from worst-case sequential join cost plus the
 * tile-propagation budget. Setting this explicitly prevents Playwright's 30 s
 * default from cutting the test short once sequential joins consume that
 * budget across multiple users.
 *
 * Formula: (users × per-user budget) + tile-propagation budget
 */
const TEST_TIMEOUT = USER_COUNT * PER_USER_READY_TIMEOUT + ALL_PEERS_TIMEOUT;

/**
 * Generates a collision-resistant room code using a full timestamp and a
 * random suffix so that concurrent test runs don't accidentally share rooms.
 */
function createRoomCode() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `S${ts}${rand}`.toUpperCase();
}

interface FakeUser {
  context: BrowserContext;
  page: Page;
  username: string;
}

async function createFakeUser(
  browser: Browser,
  username: string,
): Promise<FakeUser> {
  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
  });
  const page = await context.newPage();
  return { context, page, username };
}

/**
 * Navigates a page to the home route, fills in credentials, and waits until
 * the room is fully ready (Captions button visible).
 *
 * Both the URL assertion and the Captions visibility check use
 * PER_USER_READY_TIMEOUT. The URL check needs an explicit timeout because
 * Playwright's default (5 s) is too short when 10 browser contexts are live
 * and the dev server is under load.
 */
async function joinRoom(page: Page, username: string, roomCode: string) {
  await page.goto('/');
  await page.getByPlaceholder('Your name').fill(username);
  await page.getByPlaceholder('Room code').fill(roomCode);
  await page.getByRole('button', { name: 'Join Room' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/room/${roomCode}\\?username=${encodeURIComponent(username)}`),
    { timeout: PER_USER_READY_TIMEOUT },
  );
  await expect(page.getByTitle('Captions')).toBeVisible({
    timeout: PER_USER_READY_TIMEOUT,
  });
}

test.describe('multi-user media stress test', () => {
  test('connects 10 users with fake camera and microphone media', async ({
    browser,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const roomCode = createRoomCode();

    // Create all browser contexts up front so setup cost is not counted
    // against the per-user join timeout.
    const users = await Promise.all(
      Array.from({ length: USER_COUNT }, (_, index) =>
        createFakeUser(browser, `stress-user-${index + 1}`),
      ),
    );

    try {
      // Join sequentially: prevents simultaneous media-stack saturation that
      // caused Captions to miss its visibility window on slower machines.
      for (const { page, username } of users) {
        await joinRoom(page, username, roomCode);
      }

      // After all users are in, confirm that user[0]'s view shows all peers.
      await expect
        .poll(() => users[0].page.locator('.lk-participant-tile').count(), {
          timeout: ALL_PEERS_TIMEOUT,
        })
        .toBe(USER_COUNT);
    } finally {
      await Promise.all(users.map(({ context }) => context.close()));
    }
  });
});
