import { test, expect } from '@playwright/test';

const LIVE_ACTION_ITEMS_URL = '/test/live-action-items';
const SUGGESTED_TASK = 'Prepare the release notes';

test.describe('Given the agent publishes an action item update', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIVE_ACTION_ITEMS_URL);
  });

  test.describe('When the client receives the update', () => {
    test('Then the suggestion appears in the sidebar within five seconds', async ({
      page,
    }) => {
      await page
        .getByRole('button', { name: 'Simulate agent action item update' })
        .click();

      await expect(page.getByText(SUGGESTED_TASK)).toBeVisible({
        timeout: 5_000,
      });
    });
  });
});
