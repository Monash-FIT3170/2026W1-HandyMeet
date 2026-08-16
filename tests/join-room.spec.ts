import { test, expect } from '@playwright/test';

const BASE_URL = '/';

test.describe('Given the HandyMeet landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('BASE_URL');
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
    test('Then they are navigated to that specific room URL', async ({
      page,
    }) => {
      await page.getByPlaceholder(/your name/i).fill('Adrian');
      await page.getByPlaceholder(/room code/i).fill('TEST12');
      await page.getByRole('button', { name: 'Join Room' }).click();

      await expect(page).toHaveURL(/\/room\/TEST12\?username=Adrian/i);
    });
  });
});

test.describe('Given 2 users want to join the same room', () => {
  test.describe('When a new room is generated and a second user joins with that code', () => {
    test('Then both users are successfully routed to the exact same room URL', async ({
      browser,
    }) => {
      const adrianContext = await browser.newContext();
      const bobContext = await browser.newContext();

      const adrianPage = await adrianContext.newPage();
      const bobPage = await bobContext.newPage();

      // Setup User 1 (Adrian)
      await adrianPage.goto(BASE_URL);
      await adrianPage.getByPlaceholder(/your name/i).fill('Adrian');
      await adrianPage.getByRole('button', { name: 'Join Room' }).click();

      await expect(adrianPage).toHaveURL(
        /\/room\/[A-Z0-9]{6}\?username=Adrian/i,
      );

      // Extract generated code
      const parsedUrl = new URL(adrianPage.url());
      const roomCode = parsedUrl.pathname.split('/').pop();
      expect(roomCode).toBeTruthy();

      // Setup User 2 (Bob) joining Adrian's room
      await bobPage.goto(BASE_URL);
      await bobPage.getByPlaceholder(/your name/i).fill('Bob');
      await bobPage.getByPlaceholder(/room code/i).fill(roomCode!);
      await bobPage.getByRole('button', { name: 'Join Room' }).click();

      // Assert Bob made it to the same room
      await expect(bobPage).toHaveURL(
        `${BASE_URL}room/${roomCode}?username=Bob`,
      );

      await adrianContext.close();
      await bobContext.close();
    });
  });
});
