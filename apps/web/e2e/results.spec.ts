import { expect, test, type Page } from '@playwright/test';
import { roleLabel } from '../src/game/components/resultsCopy';
import { gameStateFixture } from '../src/game/fixtures/phase';
import { cancelledResultsFixture, finishedResultsFixture } from '../src/game/fixtures/results';

/**
 * The live results route with a mocked recap (WW-903). The layout preview
 * still covers the empty results shell. This checks the projection.
 */

const GAME = '0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31';
const SERVER_NOW = '2026-11-11T20:00:00.000Z';
const hostSeat = {
  gameId: GAME,
  roomCode: 'K7QMPR',
  playerId: '00000000-0000-4000-8000-000000000001',
  token: 'ww_token_for_tests_0123456789',
  isHost: true,
};

async function openResults(page: Page, phase: 'FINISHED' | 'CANCELLED', body: unknown) {
  await page.clock.install({ time: new Date(SERVER_NOW) });
  await page.addInitScript((seat) => sessionStorage.setItem('warewolf.seat', JSON.stringify(seat)), hostSeat);
  await page.route('**/api/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/results')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.includes('/state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(gameStateFixture({ phase })) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }) });
  });
  await page.goto(`/game/${GAME}/results`);
}

async function inView(page: Page, locator: ReturnType<Page['locator']>) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

test.describe('results', () => {
  test('shows the winning team, the recap, and Play again', async ({ page }) => {
    const recap = finishedResultsFixture();
    const infected = recap.seats.find((seat) => seat.playerId === recap.infections[0]!.targetPlayerId)!;
    await openResults(page, 'FINISHED', recap);

    await expect(page.getByRole('heading', { name: 'Wolf wins' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Game stats' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Recap' })).toContainText(`Started as ${roleLabel(infected.originalRoleId)}. Ended as Infected Wolf.`);
    const named = recap.seats.find((seat) => seat.playerId === recap.tallies[0]?.votedOutPlayerId)!;
    await expect(page.getByRole('region', { name: 'Vote' })).toContainText(`${named.displayName} was named.`);
    await expect(page.getByRole('region', { name: 'Vote' })).toContainText('2 abstentions');
    const play = page.getByRole('link', { name: 'Play again' });
    await inView(page, play);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    expect(await page.locator('body').innerText()).not.toContain('alpha_wolf');
    expect(await page.locator('body').innerText()).not.toContain('infected_wolf');
    await expect(page.getByRole('textbox', { name: 'Message' })).toHaveCount(0);
  });

  test('the stat row fits the wide and portrait stages', async ({ page }, info) => {
    test.skip(!['desktop-fhd', 'phone-portrait'].includes(info.project.name), '1920×1080 and 390×844 are the fit checks.');
    await openResults(page, 'FINISHED', finishedResultsFixture());
    await inView(page, page.getByRole('list', { name: 'Game stats' }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });

  test('narrow landscape keeps Play again and the recap on screen', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone-land-sm', '568×320 runs inside the narrow-landscape check.');
    await page.setViewportSize({ width: 568, height: 320 });
    await openResults(page, 'FINISHED', finishedResultsFixture());
    await inView(page, page.getByRole('list', { name: 'Game stats' }));
    await page.getByRole('button', { name: 'Recap' }).click();
    await expect(page.getByRole('region', { name: 'Recap' })).toBeVisible();
    await inView(page, page.getByRole('link', { name: 'Play again' }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });

  test('a cancelled game lists seats and no roles', async ({ page }, info) => {
    test.skip(info.project.name !== 'tablet-land', 'One viewport is enough for the cancellation.');
    await openResults(page, 'CANCELLED', cancelledResultsFixture());
    await expect(page.getByRole('heading', { name: 'Cancelled' })).toBeVisible();
    await expect(page.getByText('The host cancelled the game.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Recap' })).not.toContainText('Alpha Wolf');
    expect(await page.locator('body').innerText()).not.toContain('alpha_wolf');
    await inView(page, page.getByRole('link', { name: 'Play again' }));
  });
});
