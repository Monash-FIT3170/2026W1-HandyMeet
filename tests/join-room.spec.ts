import { test, expect } from '@playwright/test';

const BASE_URL = 'https://2026-w1-handy-meet.vercel.app/';

test('has title', async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page).toHaveTitle(/HandyMeet/);
});

test('button is disabled until username is entered', async ({ page }) => {
  await page.goto(BASE_URL);
  const joinButton = page.getByRole('button', { name: 'Join Room' });

  // Initially disabled
  await expect(joinButton).toBeDisabled();

  // Enabled after typing a name
  await page.getByPlaceholder(/your name/i).fill('adrian');
  await expect(joinButton).toBeEnabled();
});

test('joins specific room when code provided', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.getByPlaceholder('Your name').fill('adrian');
  await page.getByPlaceholder('Room code').fill('TEST12');

  await page.getByRole('button', { name: 'Join Room' }).click();

  // Verify it routes to the exact room code with the URL-encoded username
  await expect(page).toHaveURL(/\/room\/TEST12\?username=adrian/);
});

test('two users join same room', async ({ browser }) => {
  // Create two isolated browser contexts
  const adrianContext = await browser.newContext();
  const bobContext = await browser.newContext();

  // Open a page for each user
  const adrianPage = await adrianContext.newPage();
  const bobPage = await bobContext.newPage();

  await adrianPage.goto(BASE_URL);
  await adrianPage.getByPlaceholder('Your name').fill('adrian');
  await adrianPage.getByRole('button', { name: 'Join Room' }).click();

  // Wait for navigation to complete
  await expect(adrianPage).toHaveURL(/\/room\/[A-Z0-9]{6}\?username=adrian/i);

  // Extract the generated room code from adrian's URL
  const parsedUrl = new URL(adrianPage.url());
  const roomCode = parsedUrl.pathname.split('/').pop();

  if (!roomCode) {
    throw new Error('Room code could not be extracted from URL');
  }

  await bobPage.goto(BASE_URL);
  await bobPage.getByPlaceholder('Your name').fill('Bob');
  await bobPage.getByPlaceholder('Room code').fill(roomCode);
  await bobPage.getByRole('button', { name: 'Join Room' }).click();

  // Verify Bob is routed to the exact same room code
  await expect(bobPage).toHaveURL(`${BASE_URL}room/${roomCode}?username=Bob`);

  // Clean up contexts
  await adrianContext.close();
  await bobContext.close();
});
