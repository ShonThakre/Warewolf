import { expect, test, type Page } from '@playwright/test';
import { NARROW_LANDSCAPE_CHECK, PRIORITY_VIEWPORTS } from '../src/game/layout/viewports';

function specFor(name: string) {
  const spec = PRIORITY_VIEWPORTS.find((viewport) => viewport.project === name);
  if (!spec) throw new Error(`Unknown viewport project ${name}`);
  return spec;
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

async function buttonInView(page: Page, name: string) {
  const box = await page.getByRole('button', { name }).boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
  return box!;
}

test.describe('fixture shell', () => {
  test('lobby keeps every region and the action row on screen', async ({ page }, info) => {
    const spec = specFor(info.project.name);
    await page.goto('/dev/layout/lobby');
    await expect(page.getByRole('region', { name: 'Game status' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Village' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Actions' })).toBeVisible();
    await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-layout', spec.mode);
    await buttonInView(page, 'Start game');
    await noHorizontalScroll(page);

    if (spec.mode === 'portrait') {
      await expect(page.getByRole('region', { name: 'Room' })).toBeVisible();
      await expect(page.getByRole('tablist', { name: 'Show' })).toHaveCount(0);
    } else {
      await expect(page.getByRole('region', { name: 'Room' })).toBeVisible();
    }

    if (spec.height < 700 || spec.mode === 'portrait') {
      await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-status-row', 'false');
    }
  });

  test('night keeps the action row on screen and names no role id', async ({ page }, info) => {
    const spec = specFor(info.project.name);
    await page.goto('/dev/layout/night');
    await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-layout', spec.mode);
    await expect(page.getByRole('region', { name: 'Village' })).toBeVisible();
    const submit = await buttonInView(page, 'Submit');
    await noHorizontalScroll(page);
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('alpha_wolf');
    expect(text).not.toContain('normal_villager');

    if (spec.mode === 'portrait') {
      await page.getByRole('tab', { name: 'Room' }).click();
      await expect(page.getByText('No public events yet.')).toBeVisible();
      await buttonInView(page, 'Submit');
    }

    if (spec.project === 'phone-land-sm') {
      expect(submit.height).toBeGreaterThanOrEqual(40);
      const fontSize = await page.locator('body').evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(12);

      await page.setViewportSize({ width: NARROW_LANDSCAPE_CHECK.width, height: NARROW_LANDSCAPE_CHECK.height });
      await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-layout', 'narrow-landscape');
      await expect(page.getByRole('button', { name: 'Room' })).toHaveAttribute('aria-expanded', 'false');
      await buttonInView(page, 'Submit');
      await noHorizontalScroll(page);
      await page.getByRole('button', { name: 'Room' }).click();
      await expect(page.getByRole('button', { name: 'Room' })).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByText('No public events yet.')).toBeVisible();
      await buttonInView(page, 'Submit');
      await noHorizontalScroll(page);
    }
  });

  test('reveal, day, voting, and results keep the primary button on screen', async ({ page }, info) => {
    const spec = specFor(info.project.name);
    const stages = [
      { stage: 'reveal', button: 'Waiting for host' },
      { stage: 'night-results', button: 'Continue to day' },
      { stage: 'day', button: 'Open voting' },
      { stage: 'voting', button: 'Confirm vote' },
      { stage: 'results', button: 'Play again' },
    ];
    for (const { stage, button } of stages) {
      await page.goto(`/dev/layout/${stage}`);
      await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-layout', spec.mode);
      await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-stage', stage);
      await expect(page.getByRole('region', { name: 'Game status' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Village' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Actions' })).toBeVisible();
      await buttonInView(page, button);
      await noHorizontalScroll(page);
      if (spec.mode === 'portrait' && stage === 'voting') {
        await expect(page.getByRole('tab', { name: 'Players' })).toBeVisible();
        await page.getByRole('tab', { name: 'Room' }).click();
        await expect(page.getByText('No public events yet.')).toBeVisible();
        await buttonInView(page, button);
      }
    }

    if (spec.project === 'phone-land-sm') {
      await page.setViewportSize({ width: NARROW_LANDSCAPE_CHECK.width, height: NARROW_LANDSCAPE_CHECK.height });
      await page.goto('/dev/layout/voting');
      await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-layout', 'narrow-landscape');
      await buttonInView(page, 'Confirm vote');
      await noHorizontalScroll(page);
    }
  });
});
