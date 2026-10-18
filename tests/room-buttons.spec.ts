import { expect, type Page, test, type Locator } from '@playwright/test';

const ROOM_READY_TIMEOUT = 15_000;

async function installFakeScreenShare(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const context = canvas.getContext('2d');
      context?.fillRect(0, 0, canvas.width, canvas.height);

      return canvas.captureStream(15);
    };
  });
}

async function joinRoom(page: Page) {
  const roomCode = `B${Date.now().toString(36).slice(-5)}`.toUpperCase();

  await installFakeScreenShare(page);
  await page.goto('/');
  await page.getByPlaceholder('Your name').fill('button-tester');
  await page.getByPlaceholder('Room code').fill(roomCode);
  await page.getByRole('button', { name: 'Join Room' }).click();
  await expect(page).toHaveURL(/\/room$/, { timeout: 15_000 });
  expect(page.url()).not.toContain(roomCode);
  await expect(page.getByTitle('Captions')).toBeVisible({
    timeout: ROOM_READY_TIMEOUT,
  });

  return roomCode;
}

function microphoneButton(page: Page) {
  return page.getByRole('button', { name: /microphone/i });
}

function cameraButton(page: Page) {
  return page.getByRole('button', { name: /camera/i });
}

function screenShareButton(page: Page) {
  return page.getByRole('button', { name: /screen share|share screen/i });
}

function roomCodeButton(page: Page, roomCode: string) {
  return page.getByRole('button', {
    name: new RegExp(`Meeting room code ${roomCode}`),
  });
}

function visibleText(button: Locator, text: string) {
  return button
    .locator('span[aria-hidden="true"]')
    .getByText(text, { exact: true });
}

test.describe('Given a user is in a HandyMeet room', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ permissions: ['camera', 'microphone'] });

  test('Then the microphone button toggles the local microphone', async ({
    page,
  }) => {
    await joinRoom(page);

    const button = microphoneButton(page);
    const initialState = await button.getAttribute('aria-pressed');

    await button.click();
    await expect(button).toHaveAttribute(
      'aria-pressed',
      initialState === 'true' ? 'false' : 'true',
    );

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', initialState!);
  });

  test('Then the camera button toggles the local camera', async ({ page }) => {
    await joinRoom(page);

    const button = cameraButton(page);
    const initialState = await button.getAttribute('aria-pressed');

    await button.click();
    await expect(button).toHaveAttribute(
      'aria-pressed',
      initialState === 'true' ? 'false' : 'true',
    );

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', initialState!);
  });

  test('Then the screen share button starts and stops screen sharing', async ({
    page,
  }) => {
    await joinRoom(page);

    const button = screenShareButton(page);
    await expect(button).toHaveAttribute('aria-pressed', 'false');

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  test('Then the chat button opens and closes the chat panel', async ({
    page,
  }) => {
    await joinRoom(page);

    const chatButton = page.getByRole('button', { name: /^chat/i });
    const chatPanel = page.locator('.lk-chat');

    await expect(chatPanel).toBeHidden();
    await chatButton.click();
    await expect(chatPanel).toBeVisible();

    await chatButton.click();
    await expect(chatPanel).toBeHidden();
  });

  test('Then the captions button opens and controls caption settings', async ({
    page,
  }) => {
    await joinRoom(page);

    await page.getByTitle('Captions').click();
    await expect(page.getByText('Caption Settings')).toBeVisible();

    const settings = page.getByText('Caption Settings').locator('xpath=../..');
    const captionsToggle = settings.getByRole('button').nth(1);
    await captionsToggle.click();

    const fontSize = settings.locator('input[type="range"]');
    await fontSize.fill('28');
    await expect(settings).toContainText('28px');

    await settings.getByTitle('Yellow').click();
    await settings.getByTitle('Black').click();
    await settings.getByRole('button', { name: 'Reset to Defaults' }).click();
    await expect(settings).toContainText('18px');

    await settings.getByTitle('Close').click();
    await expect(page.getByText('Caption Settings')).toBeHidden();
  });

  test('Then the gestures button controls hand tracking and overlay', async ({
    page,
  }) => {
    await joinRoom(page);

    await page.getByTitle('Gestures').click();
    const handTracking = page.getByRole('button', { name: 'Hand tracking' });
    const overlay = page.getByRole('button', { name: 'Show overlay' });

    await expect(handTracking).toBeEnabled();
    await expect(overlay).toBeDisabled();

    await handTracking.click();
    await expect(
      page.getByText(/hand detected|no hand detected/i),
    ).toBeVisible();
    await expect(overlay).toBeEnabled();

    await overlay.click();
    await expect(overlay).toBeEnabled();

    await handTracking.click();
    await expect(overlay).toBeDisabled();
  });

  test('Then hand tracking can be enabled with video off and releases its camera when stopped', async ({
    page,
  }) => {
    await joinRoom(page);
    const camera = cameraButton(page);
    await expect(camera).toHaveAttribute('aria-pressed', 'true');
    await camera.click();
    await expect(camera).toHaveAttribute('aria-pressed', 'false');

    await page.getByTitle('Gestures').click();
    const handTracking = page.getByRole('button', { name: 'Hand tracking' });
    await expect(handTracking).toBeEnabled();
    await handTracking.click();
    await expect(handTracking).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('button', { name: 'Show overlay' }),
    ).toBeDisabled();
    const trackingCamera = page.locator('video[data-hand-tracking-camera]');
    await expect
      .poll(() =>
        trackingCamera.evaluate(
          (video: HTMLVideoElement) =>
            (video.srcObject as MediaStream | null)?.getVideoTracks()[0]
              ?.readyState,
        ),
      )
      .toBe('live');
    await expect(camera).toHaveAttribute('aria-pressed', 'false');

    await handTracking.click();
    await expect
      .poll(() =>
        trackingCamera.evaluate((video: HTMLVideoElement) => video.srcObject),
      )
      .toBeNull();
    await expect(camera).toHaveAttribute('aria-pressed', 'false');
  });

  test.describe('And they use the room code button', () => {
    test.skip(
      ({ browserName }) => browserName !== 'chromium',
      'Clipboard permissions are Chromium-only',
    );
    test.use({
      permissions: [
        'camera',
        'microphone',
        'clipboard-read',
        'clipboard-write',
      ],
    });

    test('Then the room code is hidden until the button is hovered', async ({
      page,
    }) => {
      const roomCode = await joinRoom(page);

      const button = roomCodeButton(page, roomCode);
      const label = button.getByText('Code', { exact: true });
      const code = button.getByText(roomCode);

      await expect(label).toHaveCSS('opacity', '1');
      await expect(code).toHaveCSS('opacity', '0');

      await button.hover();
      await expect(code).toHaveCSS('opacity', '1');
      await expect(label).toHaveCSS('opacity', '0');

      await page.mouse.move(0, 0);
      await expect(code).toHaveCSS('opacity', '0');
      await expect(label).toHaveCSS('opacity', '1');
    });

    test('Then clicking the button copies the room code to the clipboard', async ({
      page,
    }) => {
      const roomCode = await joinRoom(page);

      const button = roomCodeButton(page, roomCode);
      await button.click();

      await expect(visibleText(button, 'Copied!')).toHaveCSS('opacity', '1');
      await expect(button.locator('[role="status"]')).toHaveText('Copied!');

      const clipboard = await page.evaluate(() =>
        navigator.clipboard.readText(),
      );
      expect(clipboard).toBe(roomCode);
    });

    test('Then the button returns to its label after copying without revealing the code', async ({
      page,
    }) => {
      const roomCode = await joinRoom(page);

      const button = roomCodeButton(page, roomCode);
      await button.click();
      await page.mouse.move(0, 0);

      await expect(visibleText(button, 'Copied!')).toHaveCSS('opacity', '0', {
        timeout: 4_000,
      });
      await expect(button.getByText('Code', { exact: true })).toHaveCSS(
        'opacity',
        '1',
      );
      await expect(button.getByText(roomCode)).toHaveCSS('opacity', '0');
    });

    test('Then the room code is revealed when the button is focused by keyboard', async ({
      page,
    }) => {
      const roomCode = await joinRoom(page);

      const button = roomCodeButton(page, roomCode);
      await button.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');

      await expect(button).toBeFocused();
      await expect(button.getByText(roomCode)).toHaveCSS('opacity', '1');
    });
  });

  test('Then leaving opens the transcript summary and its actions work', async ({
    page,
  }) => {
    await joinRoom(page);
    await page.route('/api/summarise', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ summary: 'Test meeting summary' }),
      });
    });

    await page.getByRole('button', { name: 'Leave' }).click();
    await page.getByRole('button', { name: 'Leave Call' }).click();
    await expect(
      page.getByRole('heading', { name: 'Transcript Summary' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'AI Summary' }).click();
    await expect(
      page.getByText('No AI summary generated yet. Click the button below.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Generate Summary' }).click();
    await expect(page.getByText('Test meeting summary')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    await expect((await downloadPromise).suggestedFilename()).toBe(
      'meeting-notes.txt',
    );

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL('/');
  });
});
