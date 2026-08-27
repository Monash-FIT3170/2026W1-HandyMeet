import { test, expect } from '@playwright/test';

const LIVE_ACTION_ITEMS_URL = '/test/live-action-items';
const TEST_TRANSCRIPT = "Param: I'll prepare the release notes.";
const SUGGESTED_TASK = 'Prepare the release notes';

test.describe('Given a completed transcript line contains an action item', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/live-insights', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          newActionItems: [
            {
              task: SUGGESTED_TASK,
              owner: 'Param',
              dueDate: null,
            },
          ],
        }),
      });
    });

    await page.goto(LIVE_ACTION_ITEMS_URL);
  });

  test.describe('When live insights processes the transcript', () => {
    test('Then the suggestion appears in the sidebar within five seconds', async ({
      page,
    }) => {
      const requestPromise = page.waitForRequest('**/api/live-insights');

      await page
        .getByRole('button', { name: 'Add completed transcript line' })
        .click();

      await expect(page.getByText(SUGGESTED_TASK)).toBeVisible({
        timeout: 5_000,
      });

      const request = await requestPromise;
      expect(request.postDataJSON()).toMatchObject({
        transcript: TEST_TRANSCRIPT,
        knownActionItems: [],
      });
    });
  });
});
