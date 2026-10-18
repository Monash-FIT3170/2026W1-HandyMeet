import { test, expect, type Page } from '@playwright/test';

const BASE_URL = '/';

async function sessionCookie(page: Page, name: string) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === name);
}

test.describe('Given the HandyMeet landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test.describe('When the page initially loads', () => {
    test('Then it displays the correct page title', async ({ page }) => {
      await expect(page).toHaveTitle(/HandyMeet/);
    });

    test('Then the "Join Room" button is disabled', async ({ page }) => {
      const joinButton = page.getByRole('button', { name: 'Join Room' });
      await expect(joinButton).toBeDisabled();
    });
  });

  test.describe('When a user enters only a username', () => {
    test('Then the "Join Room" button becomes enabled', async ({ page }) => {
      const joinButton = page.getByRole('button', { name: 'Join Room' });
      await page.getByPlaceholder(/your name/i).fill('Adrian');

      await expect(joinButton).toBeEnabled();
    });
  });

  test.describe('When a user submits a username and a specific room code', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByPlaceholder(/your name/i).fill('Adrian');
      await page.getByPlaceholder(/room code/i).fill('TEST12');
      await page.getByRole('button', { name: 'Join Room' }).click();
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

  test.describe('When joining fails on the server', () => {
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

      await page.getByPlaceholder(/your name/i).fill('Adrian');
      await page.getByPlaceholder(/room code/i).fill('TEST12');
      await page.getByRole('button', { name: 'Join Room' }).click();

      await expect(
        page.getByText('Could not join that room. Try again.'),
      ).toBeVisible();
      await expect(page).toHaveURL(BASE_URL);
      await expect(
        page.getByRole('button', { name: 'Join Room' }),
      ).toBeEnabled();
    });
  });
});

test.describe('Given 2 users want to join the same room', () => {
  test.describe('When a new room is generated and a second user joins with that code', () => {
    test('Then both users are successfully placed in the exact same room', async ({
      browser,
    }) => {
      const adrianContext = await browser.newContext();
      const bobContext = await browser.newContext();

      const adrianPage = await adrianContext.newPage();
      const bobPage = await bobContext.newPage();

      // Setup User 1 (Adrian), who creates a new room by leaving the code blank
      await adrianPage.goto(BASE_URL);
      await adrianPage.getByPlaceholder(/your name/i).fill('Adrian');
      await adrianPage.getByRole('button', { name: 'Join Room' }).click();
      await expect(adrianPage).toHaveURL(/\/room$/);

      // Extract the generated code from the session cookie (it's not in the URL)
      const roomCode = (await sessionCookie(adrianPage, 'room'))?.value;
      expect(roomCode).toMatch(/^[A-Z0-9]{6}$/i);
      expect(adrianPage.url()).not.toContain(roomCode!);

      // Setup User 2 (Bob) joining Adrian's room
      await bobPage.goto(BASE_URL);
      await bobPage.getByPlaceholder(/your name/i).fill('Bob');
      await bobPage.getByPlaceholder(/room code/i).fill(roomCode!);
      await bobPage.getByRole('button', { name: 'Join Room' }).click();
      await expect(bobPage).toHaveURL(/\/room$/);

      // Assert Bob is in the same room, as himself
      expect((await sessionCookie(bobPage, 'room'))?.value).toBe(roomCode);
      expect((await sessionCookie(bobPage, 'username'))?.value).toBe('Bob');
      expect(bobPage.url()).not.toContain(roomCode!);

      await adrianContext.close();
      await bobContext.close();
    });
  });
});
