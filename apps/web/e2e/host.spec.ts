import { expect, test, type Page } from '@playwright/test';
import { gameStateFixture } from '../src/game/fixtures/phase';
import { hostDashboardFixture } from '../src/game/fixtures/hostDashboard';
import { FIXTURE_GAME_ID, fixturePlayerId } from '../src/game/fixtures/role';

/**
 * The host dashboard (WW-1202). A guest never sees a section. The host can
 * reach every section at phone landscape and portrait, with the phase control
 * still on screen.
 */

const GAME = FIXTURE_GAME_ID;
const hostSeat = {
  gameId: GAME,
  roomCode: 'K7QMPR',
  playerId: fixturePlayerId(1),
  token: 'ww_token_for_tests_0123456789',
  isHost: true,
};
const guestSeat = { ...hostSeat, playerId: fixturePlayerId(2), token: 'ww_token_for_tests_guest_0123456789', isHost: false };

async function openDashboard(page: Page, seat: typeof hostSeat) {
  await page.addInitScript((stored) => sessionStorage.setItem('warewolf.seat', JSON.stringify(stored)), seat);
  const dashboard = hostDashboardFixture();
  await page.route('**/api/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/host/dashboard')) {
      if (!seat.isHost) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_HOST', message: 'Not the host.' } }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboard) });
    }
    if (url.includes('/state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(gameStateFixture({ phase: 'VOTING', roundNumber: 2, you: seat.isHost ? 1 : 2 })) });
    if (url.includes('/events')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }) });
  });
  await page.goto(`/game/${GAME}/host`);
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

test.describe('host dashboard', () => {
  test('a guest sees no sections and no submissions', async ({ page }, info) => {
    test.skip(info.project.name !== 'tablet-land', 'One viewport is enough for the refusal.');
    await openDashboard(page, guestSeat);
    await expect(page.getByText('The host dashboard is only for the host.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Dashboard sections' })).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toContain('Alpha Wolf');
  });

  test('the host reaches every section and the phase control stays on screen', async ({ page }, info) => {
    test.skip(!['phone-land', 'phone-portrait', 'phone-land-sm'].includes(info.project.name), '844×390, 390×844, and the 568×320 check.');
    if (info.project.name === 'phone-land-sm') await page.setViewportSize({ width: 568, height: 320 });
    await openDashboard(page, hostSeat);
    await expect(page.getByRole('heading', { name: 'Host dashboard' })).toBeVisible();
    await expect(page.getByText('Infections used / max')).toBeVisible();
    await expect(page.getByText('1 of 4')).toBeVisible();
    const close = page.getByRole('button', { name: 'End the day' });
    await inView(page, close);
    for (const name of ['Players and roles', 'Infection history', 'Night actions', 'Doctor', 'Votes', 'Eliminations', 'Victory flags', 'Event log', 'Configuration']) {
      await page.getByRole('button', { name }).click();
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Night actions' }).click();
    await expect(page.getByRole('region', { name: 'Submitted night actions' })).toContainText('Wolf kill');
    expect(await page.locator('body').innerText()).not.toContain('alpha_wolf');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await inView(page, close);
  });
});
