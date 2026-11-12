import { expect, test } from '@playwright/test';

/** HOWTO-01: the page is reached from Home, covers every mode, and fits the screen. */
test('How to play opens from Home, lists every mode, and never scrolls sideways', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: 'How to Play' }).click();
  await page.waitForURL(/\/how-to-play$/);
  await expect(page.getByRole('heading', { level: 1, name: 'How to play' })).toBeVisible();
  const modes = page.getByRole('list', { name: 'Game modes' });
  for (const name of ['Infection Edition', 'Classic', 'Expanded', 'Custom', 'Ultimate 20']) {
    await expect(modes.getByRole('heading', { level: 3, name })).toBeVisible();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await modes.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('how-to-play.png'), fullPage: false });
  await page.getByRole('link', { name: 'See all roles' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Role catalog' })).toBeVisible();
});
