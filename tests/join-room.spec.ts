import { test, expect, type Page } from '@playwright/test';

const BASE_URL = '/';
const ROOM_READY_TIMEOUT = 15_000;

async function sessionCookie(page: Page, name: string) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === name);
}

async function chooseMode(page: Page, mode: 'create' | 'join') {
  await page
    .getByRole('button', {
      name: mode === 'create' ? 'Create Meeting' : 'Join Meeting',
    })
    .click();
}

test.describe('Given the HandyMeet landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test.describe('When the page initially loads', () => {
    test('Then it displays the correct page title', async ({ page }) => {
      await expect(page).toHaveTitle(/HandyMeet/);
    });

    test('Then it offers the Create Meeting and Join Meeting options', async ({
      page,
    }) => {
      await expect(
        page.getByRole('heading', { name: 'Get started' }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Create Meeting' }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Join Meeting' }),
      ).toBeVisible();
    });

    test('Then the name and room code fields are hidden until a mode is chosen', async ({
      page,
    }) => {
      await expect(page.getByPlaceholder(/your name/i)).toBeHidden();
      await expect(page.getByPlaceholder(/room code/i)).toBeHidden();
    });
  });

  test.describe('When a user chooses to create a meeting', () => {
    test('Then the name field and an optional room code field appear', async ({
      page,
    }) => {
      await chooseMode(page, 'create');

      await expect(page.getByPlaceholder(/your name/i)).toBeVisible();
      await expect(page.getByPlaceholder('Room code (optional)')).toBeVisible();
    });
  });

  test.describe('When a user chooses to join a meeting', () => {
    test('Then the name field and a required room code field appear', async ({
      page,
    }) => {
      await chooseMode(page, 'join');

      await expect(page.getByPlaceholder(/your name/i)).toBeVisible();
      await expect(
        page.getByPlaceholder('Room code', { exact: true }),
      ).toBeVisible();
    });
  });

  test.describe('When a user creates a meeting with a specific room code', () => {
    test.beforeEach(async ({ page }) => {
      await chooseMode(page, 'create');
      await page.getByPlaceholder(/your name/i).fill('Adrian');
      await page.getByPlaceholder(/room code/i).fill('TEST12');
      await page.getByRole('button', { name: 'Create Meeting' }).click();
      await expect(page).toHaveURL(/\/room$/);
    });

    test('Then the room code and username are not in the URL', async ({
      page,
    }) => {
      expect(page.url()).not.toContain('TEST12');
      expect(page.url()).not.toContain('Adrian');
    });

    test('Then their session cookies hold that room code and username', async ({
      page,
    }) => {
      expect((await sessionCookie(page, 'room'))?.value).toBe('TEST12');
      expect((await sessionCookie(page, 'username'))?.value).toBe('Adrian');
    });
  });

  test.describe('When starting the session fails on the server', () => {
    test('Then an error is shown and the user stays on the landing page', async ({
      page,
    }) => {
      await page.route('**/api/room', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' }),
        });
      });

      await chooseMode(page, 'create');
      await page.getByPlaceholder(/your name/i).fill('Adrian');
      await page.getByPlaceholder(/room code/i).fill('TEST12');
      await page.getByRole('button', { name: 'Create Meeting' }).click();

      await expect(page).toHaveURL(BASE_URL);
      await expect(
        page.getByRole('button', { name: 'Create Meeting' }),
      ).toBeEnabled();
      expect(await sessionCookie(page, 'room')).toBeUndefined();
    });
  });

  test.describe('When a user tries to join a meeting that does not exist', () => {
    test('Then a not-found error is shown and no session is started', async ({
      page,
    }) => {
      await chooseMode(page, 'join');
      await page.getByPlaceholder(/your name/i).fill('Bob');
      await page.getByPlaceholder('Room code', { exact: true }).fill('NOPE99');
      await page.getByRole('button', { name: 'Join Meeting' }).click();

      await expect(
        page.getByText(/No meeting found with code "NOPE99"/),
      ).toBeVisible();
      await expect(page).toHaveURL(BASE_URL);
      expect(await sessionCookie(page, 'room')).toBeUndefined();
    });
  });
});

test.describe('Given 2 users want to join the same room', () => {
  test.describe('When a new room is created and a second user joins with that code', () => {
    test('Then both users are successfully placed in the exact same room', async ({
      browser,
    }) => {
      test.setTimeout(60_000);

      const adrianContext = await browser.newContext({
        permissions: ['camera', 'microphone'],
      });
      const bobContext = await browser.newContext();

      try {
        const adrianPage = await adrianContext.newPage();
        const bobPage = await bobContext.newPage();

        // Setup User 1 (Adrian), who creates a new room by leaving the code blank
        await adrianPage.goto(BASE_URL);
        await chooseMode(adrianPage, 'create');
        await adrianPage.getByPlaceholder(/your name/i).fill('Adrian');
        await adrianPage
          .getByRole('button', { name: 'Create Meeting' })
          .click();
        await expect(adrianPage).toHaveURL(/\/room$/);

        const roomCode = (await sessionCookie(adrianPage, 'room'))?.value;
        expect(roomCode).toMatch(/^[A-Z0-9]{6}$/i);
        expect(adrianPage.url()).not.toContain(roomCode!);

        await expect(adrianPage.getByTitle('Captions')).toBeVisible({
          timeout: ROOM_READY_TIMEOUT,
        });
        await expect
          .poll(
            async () => {
              const response = await adrianPage.request.get(
                `/api/room-exists?room=${roomCode}`,
              );
              return (await response.json()).exists;
            },
            { timeout: ROOM_READY_TIMEOUT },
          )
          .toBe(true);

        // Setup User 2 (Bob) joining Adrian's room
        await bobPage.goto(BASE_URL);
        await chooseMode(bobPage, 'join');
        await bobPage.getByPlaceholder(/your name/i).fill('Bob');
        await bobPage
          .getByPlaceholder('Room code', { exact: true })
          .fill(roomCode!);
        await bobPage.getByRole('button', { name: 'Join Meeting' }).click();
        await expect(bobPage).toHaveURL(/\/room$/);

        // Assert Bob is in the same room, as himself
        expect((await sessionCookie(bobPage, 'room'))?.value).toBe(roomCode);
        expect((await sessionCookie(bobPage, 'username'))?.value).toBe('Bob');
        expect(bobPage.url()).not.toContain(roomCode!);
      } finally {
        await adrianContext.close();
        await bobContext.close();
      }
    });
  });
});
