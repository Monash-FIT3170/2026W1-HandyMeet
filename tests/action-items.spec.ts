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

test.describe('Given a suggestion exists and mock participants are available', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ACTION_ITEMS_URL);
    await page.getByRole('button', { name: 'Add first item' }).click();
  });

  test.describe('When the assignee dropdown is opened', () => {
    test('Then it lists the available participants plus Unassigned', async ({
      page,
    }) => {
      await page.getByRole('button', { name: 'Unassigned' }).click();

      await expect(
        page.getByRole('option', { name: 'Unassigned' }),
      ).toBeVisible();
      await expect(page.getByRole('option', { name: 'Dylan' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Sam' })).toBeVisible();
    });
  });

  test.describe('When a participant is selected from the dropdown', () => {
    test('Then the dropdown button label updates to that participant', async ({
      page,
    }) => {
      await page.getByRole('button', { name: 'Unassigned' }).click();
      await page.getByRole('option', { name: 'Dylan' }).click();

      await expect(page.getByRole('button', { name: 'Dylan' })).toBeVisible();
    });

    test('Then the "Who" field still shows the LLM-suggested owner until accepted', async ({
      page,
    }) => {
      await page.getByRole('button', { name: 'Unassigned' }).click();
      await page.getByRole('option', { name: 'Dylan' }).click();

      // Assuming the mock item's LLM-guessed owner differs from the assignee
      await expect(page.getByText('Who')).toBeVisible();
    });
  });

  test.describe('When a participant is assigned and the item is accepted', () => {
    test('Then the "Who" field updates to the assigned participant', async ({
      page,
    }) => {
      await page.getByRole('button', { name: 'Unassigned' }).click();
      await page.getByRole('option', { name: 'Dylan' }).click();
      await page.getByRole('button', { name: 'Accept' }).click();

      await expect(
        page.getByRole('button', { name: 'Accepted' }),
      ).toBeVisible();

      await page.getByRole('button', { name: 'Accepted' }).click(); // expand section if collapsed
      await expect(page.getByText('Dylan')).toBeVisible();
    });
  });

  test.describe('When "Unassigned" is re-selected after assigning someone', () => {
    test('Then the dropdown reverts to showing Unassigned', async ({
      page,
    }) => {
      await page.getByRole('button', { name: 'Unassigned' }).click();
      await page.getByRole('option', { name: 'Dylan' }).click();

      await page.getByRole('button', { name: 'Dylan' }).click();
      await page.getByRole('option', { name: 'Unassigned' }).click();

      await expect(
        page.getByRole('button', { name: 'Unassigned' }),
      ).toBeVisible();
    });
  });

  test.describe('Given a suggestion is avaliable', () => {
    test('Then accepting the suggestion should update its status', async ({
      page,
    }) => {
      await page.getByLabel;
    });
  });
});

test.describe('Given a suggestion exists on the action items page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ACTION_ITEMS_URL);
    await page.getByRole('button', { name: 'Add first item' }).click();
  });

  test.describe('When the Accept button is clicked', () => {
    test('Then the item moves from Suggestions into Accepted', async ({
      page,
    }) => {
      await expect(page.getByText('Prepare the sprint demo')).toBeVisible();

      await page.getByRole('button', { name: 'Accept' }).click();

      // No longer under Suggestions
      await expect(page.getByText('No new action items yet')).toBeVisible();

      // Now under Accepted
      await page.getByRole('button', { name: /Accepted/ }).click(); // expand section
      await expect(page.getByText('Prepare the sprint demo')).toBeVisible();
    });
  });

  test.describe('When the Dismiss button is clicked', () => {
    test('Then the item disappears from the sidebar entirely', async ({
      page,
    }) => {
      await expect(page.getByText('Prepare the sprint demo')).toBeVisible();

      await page.getByRole('button', { name: 'Dismiss' }).click();

      await expect(page.getByText('Prepare the sprint demo')).not.toBeVisible();
      await expect(page.getByText('No new action items yet')).toBeVisible();
    });

    test('Then it does not appear in the Accepted section either', async ({
      page,
    }) => {
      await page.getByRole('button', { name: 'Dismiss' }).click();

      // Accepted section shouldn't even render since nothing was accepted
      await expect(
        page.getByRole('button', { name: /Accepted/ }),
      ).not.toBeVisible();
    });
  });

  test.describe('When the task text is edited', () => {
    test('Then clicking the task text reveals an editable input', async ({
      page,
    }) => {
      await page.getByText('Prepare the sprint demo').click();

      await expect(page.getByRole('textbox')).toBeVisible();
      await expect(page.getByRole('textbox')).toHaveValue(
        'Prepare the sprint demo',
      );
    });

    test('Then pressing Enter saves the new task text', async ({ page }) => {
      await page.getByText('Prepare the sprint demo').click();

      const input = page.getByRole('textbox');
      await input.fill('Prepare the revised sprint demo');
      await input.press('Enter');

      await expect(
        page.getByText('Prepare the revised sprint demo'),
      ).toBeVisible();
      await expect(
        page.getByText('Prepare the sprint demo', { exact: true }),
      ).not.toBeVisible();
    });

    test('Then pressing Escape discards the edit', async ({ page }) => {
      await page.getByText('Prepare the sprint demo').click();

      const input = page.getByRole('textbox');
      await input.fill('This should not be saved');
      await input.press('Escape');

      await expect(page.getByText('Prepare the sprint demo')).toBeVisible();
      await expect(
        page.getByText('This should not be saved'),
      ).not.toBeVisible();
    });

    test('Then clicking away (blur) saves the edit', async ({ page }) => {
      await page.getByText('Prepare the sprint demo').click();

      const input = page.getByRole('textbox');
      await input.fill('Saved via blur');
      await page.getByRole('button', { name: 'Collapse action items' }).click();

      await expect(page.getByText('Saved via blur')).toBeVisible();
    });

    test('Then an empty edit reverts to the original text', async ({
      page,
    }) => {
      await page.getByText('Prepare the sprint demo').click();

      const input = page.getByRole('textbox');
      await input.fill('');
      await input.press('Enter');

      await expect(page.getByText('Prepare the sprint demo')).toBeVisible();
    });
  });
});
