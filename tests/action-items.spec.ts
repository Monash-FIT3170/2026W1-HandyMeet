import { test, expect } from '@playwright/test';

const ACTION_ITEMS_URL = '/test/action-items';

test.describe('Given the action item sidebar has no suggestions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ACTION_ITEMS_URL);
  });

  test.describe('When the page initially loads', () => {
    test('Then the sidebar starts collapsed', async ({ page }) => {
      await expect(
        page.getByRole('button', { name: 'Open action items' }),
      ).toBeVisible();
    });
  });

  test.describe('When the first suggestion is added', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: 'Add first item' }).click();
    });

    test('Then the sidebar opens and displays the suggestion', async ({
      page,
    }) => {
      await expect(
        page.getByText('Prepare the sprint demonstration'),
      ).toBeVisible();
    });

    test.describe('When the sidebar is collapsed and another suggestion is added', () => {
      test('Then it remains collapsed and displays the unread count', async ({
        page,
      }) => {
        await page
          .getByRole('button', { name: 'Collapse action items' })
          .click();
        await page.getByRole('button', { name: 'Add another item' }).click();

        await expect(
          page.getByRole('button', {
            name: 'Open action items, 1 unread suggestion',
          }),
        ).toBeVisible();
      });
    });
  });
});
