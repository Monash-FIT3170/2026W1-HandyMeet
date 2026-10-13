import { test, expect } from '@playwright/test';

const LIVE_ACTION_ITEMS_URL = '/test/live-action-items';
const SUGGESTED_TASK = 'Prepare the release notes';

test('Then a participant is elected locally while the agent is unavailable', async ({
  page,
}) => {
  await page.goto('/test/live-action-items/offline');

  await expect(page.getByText('You are coordinating')).toBeVisible();
});

test('Then two participants see synced items and coordinator handoff', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const alice = await context.newPage();
  const sam = await context.newPage();

  await Promise.all([
    alice.goto('/test/live-action-items/shared/alice'),
    sam.goto('/test/live-action-items/shared/sam'),
  ]);

  await expect(alice.getByText('You are coordinating')).toBeVisible();
  await expect(sam.getByText('Alice is coordinating')).toBeVisible();

  await alice
    .getByRole('button', { name: 'Simulate two participants talking' })
    .click();
  await expect(
    alice.getByText('Prepare the release notes after the discussion'),
  ).toBeVisible();
  await expect(
    sam.getByText('Prepare the release notes after the discussion'),
  ).toBeVisible();

  await alice
    .getByText('Prepare the release notes after the discussion')
    .click();
  await alice
    .getByRole('textbox')
    .fill('Prepare the revised release notes after the discussion');
  await alice.getByRole('textbox').press('Enter');
  await expect(
    alice.getByText('Prepare the revised release notes after the discussion'),
  ).toBeVisible();
  await expect(
    sam.getByText('Prepare the revised release notes after the discussion'),
  ).toBeVisible();

  await alice.locator('#action-item-handoff').selectOption('sam');
  await alice.getByRole('button', { name: 'Hand off' }).click();

  await expect(alice.getByText('Sam is coordinating')).toBeVisible();
  await expect(sam.getByText('You are coordinating')).toBeVisible();
  await expect(alice.getByRole('button', { name: 'Accept' })).toBeDisabled();
  await expect(sam.getByRole('button', { name: 'Accept' })).toBeEnabled();

  await sam.getByRole('button', { name: 'Accept' }).click();
  await expect(alice.getByText('No new action items yet')).toBeVisible();
  await expect(sam.getByText('No new action items yet')).toBeVisible();

  await alice.getByRole('button', { name: /Accepted/ }).click();
  await sam.getByRole('button', { name: /Accepted/ }).click();
  await expect(
    alice
      .locator('#accepted-action-items')
      .getByText('Prepare the revised release notes after the discussion'),
  ).toBeVisible();
  await expect(
    sam
      .locator('#accepted-action-items')
      .getByText('Prepare the revised release notes after the discussion'),
  ).toBeVisible();

  await context.close();
});

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

    test('Then the elected coordinator can update the item and see the agent broadcast', async ({
      page,
    }) => {
      await page
        .getByRole('button', { name: 'Simulate agent action item update' })
        .click();

      await expect(page.getByText('You are coordinating')).toBeVisible();

      await page.getByRole('button', { name: 'Unassigned' }).click();
      await page
        .getByRole('listbox')
        .getByRole('option', { name: 'Sam' })
        .click();
      await expect(page.getByRole('button', { name: 'Sam' })).toBeVisible();

      await page.getByText(SUGGESTED_TASK).click();
      await page.getByRole('textbox').fill('Prepare the revised release notes');
      await page.getByRole('textbox').press('Enter');

      await page.getByRole('button', { name: 'Accept' }).click();
      await page.getByRole('button', { name: /Accepted/ }).click();

      await expect(
        page.getByText('Prepare the revised release notes'),
      ).toBeVisible();
      await expect(
        page
          .locator('#accepted-action-items')
          .getByText('Sam', { exact: true }),
      ).toBeVisible();
    });

    test('Then dismissing the item removes it after the agent broadcast', async ({
      page,
    }) => {
      await page
        .getByRole('button', { name: 'Simulate agent action item update' })
        .click();

      await page.getByRole('button', { name: 'Dismiss' }).click();

      await expect(page.getByText(SUGGESTED_TASK)).not.toBeVisible();
      await expect(page.getByText('No new action items yet')).toBeVisible();
    });

    test('Then handing off coordination disables editing for the old coordinator', async ({
      page,
    }) => {
      await page
        .getByRole('button', { name: 'Simulate agent action item update' })
        .click();

      await page.locator('#action-item-handoff').selectOption('sam');
      await page.getByRole('button', { name: 'Hand off' }).click();

      await expect(page.getByText('Sam is coordinating')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Accept' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Edit' })).toBeDisabled();
      await expect(
        page.getByRole('button', { name: 'Dismiss' }),
      ).toBeDisabled();
    });
  });
});
