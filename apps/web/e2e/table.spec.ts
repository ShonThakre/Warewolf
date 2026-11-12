import { expect, test, type Page } from '@playwright/test';
import { myActionsFixture } from '../src/game/fixtures/actions';
import { chatMessageFixture, chatViewFixture } from '../src/game/fixtures/chat';
import { killTargetFixture } from '../src/game/fixtures/killTarget';
import { gameStateFixture } from '../src/game/fixtures/phase';
import { ROLE_FIXTURES, fixturePlayerId } from '../src/game/fixtures/role';
import { PRIORITY_VIEWPORTS } from '../src/game/layout/viewports';

/**
 * The table with a mocked phase state. Viewport reachability for the status
 * line and the host button (WEB-06). The dev server proxies /api, and this
 * route fulfills it in the browser instead.
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

function seat(n: number) {
  return {
    playerId: `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`,
    displayName: n === 1 ? 'Asha' : `Seat ${n}`,
    seatNumber: n,
    avatarId: n,
    isHost: n === 1,
    lifeStatus: 'ALIVE' as const,
  };
}

function nightState(phaseEndsAt: string | null) {
  const you = seat(1);
  return {
    gameId: GAME,
    status: 'ACTIVE',
    phase: 'NIGHT_SUBMIT',
    roundNumber: 1,
    stateVersion: 30,
    pacing: phaseEndsAt ? 'TIMED' : 'HOST',
    phaseStartedAt: SERVER_NOW,
    phaseEndsAt,
    serverNow: SERVER_NOW,
    close: phaseEndsAt ? { next: null, resolves: 'NIGHT' } : { next: 'NIGHT_HOST_CONFIRM', resolves: null },
    voting: { abstain: true, changeUntilClose: true },
    players: Array.from({ length: 20 }, (_, index) => seat(index + 1)),
    you: { playerId: you.playerId, isHost: true, lifeStatus: 'ALIVE' },
  };
}

function morningState() {
  return {
    ...nightState(null),
    phase: 'DAY_ANNOUNCE',
    pacing: 'HOST',
    phaseEndsAt: null,
    close: { next: 'DAY_DISCUSSION', resolves: null },
  };
}

function specFor(name: string) {
  const spec = PRIORITY_VIEWPORTS.find((viewport) => viewport.project === name);
  if (!spec) throw new Error(`Unknown viewport project ${name}`);
  return spec;
}

async function seatAndMock(page: Page, state: () => unknown) {
  await page.clock.install({ time: new Date(SERVER_NOW) });
  await page.addInitScript((seat) => sessionStorage.setItem('warewolf.seat', JSON.stringify(seat)), hostSeat);
  await page.route('**/api/v1/**', (route) => {
    if (route.request().url().includes('/state')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state()) });
    }
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }),
    });
  });
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
  return box!;
}

test.describe('table phase bar', () => {
  test('keeps the status line and the host button on screen', async ({ page }, info) => {
    const spec = specFor(info.project.name);
    await seatAndMock(page, () => nightState(new Date(Date.parse(SERVER_NOW) + 90_000).toISOString()));
    await page.goto(`/game/${GAME}`);

    const status = page.getByRole('region', { name: 'Game status' });
    await expect(status.getByRole('heading', { name: 'Night' })).toBeVisible();
    await expect(status.getByText('Round 1', { exact: true })).toBeVisible();
    await expect(status.locator('.ww-countdown')).toHaveText('1:30');
    await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-layout', spec.mode);
    await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-stage', 'night');
    await inView(page, status);
    const button = await inView(page, page.getByRole('button', { name: 'Resolve night' }));
    await inView(page, page.getByText('Waiting for night to end', { exact: true }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    expect(await page.locator('body').innerText()).not.toContain('alpha_wolf');
    if (spec.height < 500) expect(button.height).toBeGreaterThanOrEqual(40);
  });

  test('a timed night moves on when the clock reaches 0', async ({ page }, info) => {
    test.skip(info.project.name !== 'tablet-land', 'One viewport is enough for the clock.');
    let expired = false;
    await seatAndMock(page, () => (expired ? morningState() : nightState(new Date(Date.parse(SERVER_NOW) + 90_000).toISOString())));
    await page.goto(`/game/${GAME}`);
    await expect(page.getByRole('heading', { name: 'Night' })).toBeVisible();
    await expect(page.locator('.ww-countdown')).toHaveText('1:30');
    expired = true;
    await page.clock.fastForward(90_000);
    await expect(page.getByRole('heading', { name: 'Morning' })).toBeVisible();
    await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-stage', 'night-results');
  });
});

test.describe('night action', () => {
  test('a Seeker chooses a living player and can change it', async ({ page }, info) => {
    test.skip(!['tablet-land', 'phone-land', 'phone-portrait'].includes(info.project.name), 'Three viewports cover the action row.');
    const role = ROLE_FIXTURES.seeker;
    const actions = myActionsFixture(role, { availability: { seeker_public_reveal: 'NOT_THIS_PHASE' } });
    const state = gameStateFixture({ phase: 'NIGHT_SUBMIT', you: 4, dead: [3] });
    await page.clock.install({ time: new Date(SERVER_NOW) });
    await page.addInitScript(
      (seat) => sessionStorage.setItem('warewolf.seat', JSON.stringify(seat)),
      { ...hostSeat, playerId: role.playerId, isHost: false },
    );
    await page.route('**/api/v1/**', (route) => {
      const url = route.request().url();
      if (route.request().method() === 'POST' && url.includes('/actions')) {
        const body = route.request().postDataJSON() as { abilityInstanceId: string; targetPlayerIds: string[] };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            actionId: '00000000-0000-4000-8000-000000009000',
            status: 'PENDING',
            abilityInstanceId: body.abilityInstanceId,
            roundNumber: 1,
            phase: 'NIGHT_SUBMIT',
            targetPlayerIds: body.targetPlayerIds,
            payload: {},
          }),
        });
      }
      if (url.includes('/me/actions')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(actions) });
      if (url.includes('/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(role) });
      if (url.includes('/state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) });
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }) });
    });
    await page.goto(`/game/${GAME}`);

    await expect(page.getByText('Seeker', { exact: true })).toBeVisible();
    await expect(page.locator('.ww-game-rail')).not.toContainText('Seeker');
    const submit = page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: 'Submit' });
    await expect(submit).toBeDisabled();
    await page.getByRole('button', { name: /Rafi/ }).click();
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByRole('region', { name: 'Actions' })).toContainText('Submitted');
    await page.getByRole('button', { name: /Asha/ }).click();
    await expect(page.getByRole('region', { name: 'Actions' })).toContainText('Asha');
    await expect(submit).toBeEnabled();
    await page.getByRole('button', { name: 'Hide role' }).click();
    await expect(page.getByText('Your role', { exact: true })).toBeVisible();
    await expect(page.getByText('Seeker', { exact: true })).toHaveCount(0);
    await inView(page, submit);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    expect(await page.locator('body').innerText()).not.toContain('seeker');
    expect(await page.locator('body').innerText()).not.toContain(fixturePlayerId(2));
  });
});

test.describe('day ballot', () => {
  test('a living player confirms a vote and can change it', async ({ page }, info) => {
    test.skip(!['tablet-land', 'phone-land', 'phone-portrait'].includes(info.project.name), 'Three viewports cover the ballot.');
    const spec = specFor(info.project.name);
    const state = gameStateFixture({ phase: 'VOTING', you: 4, dead: [3] });
    await page.clock.install({ time: new Date(SERVER_NOW) });
    await page.addInitScript(
      (seat) => sessionStorage.setItem('warewolf.seat', JSON.stringify(seat)),
      { ...hostSeat, playerId: state.you.playerId, isHost: false },
    );
    await page.route('**/api/v1/**', (route) => {
      const url = route.request().url();
      if (route.request().method() === 'POST' && url.includes('/votes')) {
        const body = route.request().postDataJSON() as { targetPlayerId: string | null };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ballot: 1, targetPlayerId: body.targetPlayerId, supersedes: null }),
        });
      }
      if (url.includes('/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROLE_FIXTURES.villager) });
      if (url.includes('/state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) });
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }) });
    });
    await page.goto(`/game/${GAME}`);

    await expect(page.getByRole('heading', { name: 'Voting' })).toBeVisible();
    await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-layout', spec.mode);
    await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-stage', 'voting');
    const confirm = page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: 'Submit vote' });
    await expect(confirm).toBeDisabled();
    await expect(page.getByRole('button', { name: /Mira/ })).toBeDisabled();
    await page.getByRole('button', { name: /Rafi/ }).click();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByRole('region', { name: 'Actions' })).toContainText('Vote sent. Your vote is Rafi. You can change it until voting closes.');
    await page.getByRole('button', { name: 'Abstain' }).click();
    const change = page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: 'Change vote' });
    await expect(change).toBeEnabled();
    await inView(page, change);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    if (spec.mode === 'portrait') await expect(page.getByRole('tab', { name: 'Players' })).toBeVisible();
  });

  test('hides abstain and locks the ballot when the room forbids both', async ({ page }, info) => {
    test.skip(info.project.name !== 'tablet-land', 'One viewport covers the locked ballot.');
    const state = gameStateFixture({ phase: 'VOTING', you: 4, voting: { abstain: false, changeUntilClose: false } });
    await page.clock.install({ time: new Date(SERVER_NOW) });
    await page.addInitScript(
      (seat) => sessionStorage.setItem('warewolf.seat', JSON.stringify(seat)),
      { ...hostSeat, playerId: state.you.playerId, isHost: false },
    );
    await page.route('**/api/v1/**', (route) => {
      const url = route.request().url();
      if (route.request().method() === 'POST' && url.includes('/votes')) {
        const body = route.request().postDataJSON() as { targetPlayerId: string | null };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ballot: 1, targetPlayerId: body.targetPlayerId, supersedes: null }),
        });
      }
      if (url.includes('/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROLE_FIXTURES.villager) });
      if (url.includes('/state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) });
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }) });
    });
    await page.goto(`/game/${GAME}`);

    const actions = page.getByRole('region', { name: 'Actions' });
    await expect(actions).toContainText('Choose a player to eliminate.');
    await expect(actions.getByRole('button', { name: 'Abstain' })).toHaveCount(0);
    await page.getByRole('button', { name: /Rafi/ }).click();
    await actions.getByRole('button', { name: 'Submit vote' }).click();
    await expect(actions).toContainText('Vote sent. Your vote is Rafi. This ballot is locked.');
    await expect(page.getByRole('button', { name: /Asha/ })).toBeDisabled();
  });
});

test.describe('host kill target', () => {
  test('the host confirms a named player and can switch to no kill', async ({ page }, info) => {
    test.skip(!['tablet-land', 'phone-land', 'phone-portrait'].includes(info.project.name), 'Three viewports cover the kill row.');
    const state = gameStateFixture({ phase: 'NIGHT_HOST_CONFIRM' });
    let decision: { kind: 'TARGET'; playerId: string } | { kind: 'NO_KILL' } | null = null;
    await page.clock.install({ time: new Date(SERVER_NOW) });
    await page.addInitScript((seat) => sessionStorage.setItem('warewolf.seat', JSON.stringify(seat)), hostSeat);
    await page.route('**/api/v1/**', (route) => {
      const url = route.request().url();
      if (route.request().method() === 'POST' && url.includes('/host/kill-target')) {
        const body = route.request().postDataJSON() as { targetPlayerId?: string; noKill?: true };
        decision = body.noKill ? { kind: 'NO_KILL' } : { kind: 'TARGET', playerId: body.targetPlayerId! };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(killTargetFixture({ decision, editable: true })) });
      }
      if (url.includes('/host/kill-target')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(killTargetFixture({ decision, editable: true })) });
      if (url.includes('/chat')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(chatViewFixture({ you: { canPost: false, refusal: 'CLOSED' } })) });
      if (url.includes('/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROLE_FIXTURES.villager) });
      if (url.includes('/state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) });
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }) });
    });
    await page.goto(`/game/${GAME}`);

    const confirm = page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: 'Confirm target' });
    await expect(confirm).toBeDisabled();
    await page.getByRole('button', { name: 'Target Diego' }).click();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByRole('region', { name: 'Actions' })).toContainText('Submitted. The attack is on Diego.');
    await page.getByRole('button', { name: 'No kill' }).click();
    await expect(confirm).toBeEnabled();
    await inView(page, confirm);
    await expect(page.locator('.ww-game-rail')).not.toContainText('Named by');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    expect(await page.locator('body').innerText()).not.toContain('alpha_wolf');
  });
});

test.describe('discussion composer', () => {
  test('stays reachable and sends when the day is open', async ({ page }, info) => {
    const spec = specFor(info.project.name);
    const state = gameStateFixture({ phase: 'DAY_DISCUSSION', you: 4 });
    const seat = { ...hostSeat, playerId: state.you.playerId, isHost: false };
    await page.clock.install({ time: new Date(SERVER_NOW) });
    await page.addInitScript((stored) => sessionStorage.setItem('warewolf.seat', JSON.stringify(stored)), seat);
    await page.route('**/api/v1/**', (route) => {
      const url = route.request().url();
      if (route.request().method() === 'POST' && url.includes('/chat/messages')) {
        const body = route.request().postDataJSON() as { body: string };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(chatMessageFixture(6, { body: body.body, playerId: seat.playerId })) });
      }
      if (url.includes('/chat')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(chatViewFixture({ count: 1 })) });
      if (url.includes('/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROLE_FIXTURES.villager) });
      if (url.includes('/state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) });
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }) });
    });
    await page.goto(`/game/${GAME}`);

    await expect(page.getByRole('heading', { name: 'Day' })).toBeVisible();
    await expect(page.locator('.ww-game-layout')).toHaveAttribute('data-layout', spec.mode);
    const send = page.getByRole('button', { name: 'Send' });
    await expect(send).toBeDisabled();
    await page.getByRole('textbox', { name: 'Message' }).fill('Hello table');
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.getByRole('list', { name: 'Messages' })).toContainText('Hello table');
    await inView(page, send);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    expect(await page.locator('.ww-game-rail').innerText()).not.toContain('Villager');

    if (info.project.name === 'phone-land-sm') {
      await page.setViewportSize({ width: 568, height: 320 });
      await page.getByRole('button', { name: 'Discussion' }).click();
      await inView(page, page.getByRole('button', { name: 'Send' }));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    }
  });
});

test.describe('public tally', () => {
  test('the morning shows the closed vote and voting does not', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone-portrait', 'One portrait check covers the card.');
    const named = seat(7);
    const other = seat(9);
    const tally = {
      roundNumber: 1,
      ballot: 1,
      counts: [
        { targetPlayerId: named.playerId, total: 4 },
        { targetPlayerId: other.playerId, total: 2 },
      ],
      abstentions: 1,
      votedOutPlayerId: named.playerId,
      tiedPlayerIds: [] as string[],
    };
    await page.addInitScript((stored) => sessionStorage.setItem('warewolf.seat', JSON.stringify(stored)), hostSeat);
    await page.route('**/api/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('/tallies')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tallies: [tally] }) });
      if (url.includes('/state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(morningState()) });
      if (url.includes('/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROLE_FIXTURES.villager) });
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }) });
    });
    await page.goto(`/game/${GAME}`);
    const card = page.getByRole('region', { name: 'Vote' });
    await expect(card).toContainText('Seat 7 was named.');
    await expect(card).toContainText('1 abstention');
    await inView(page, card);
    expect(await page.locator('body').innerText()).not.toContain(named.playerId);
  });

  test('the morning shows the seat’s own result', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone-portrait', 'One portrait check covers the report.');
    const target = seat(2);
    await page.addInitScript((stored) => sessionStorage.setItem('warewolf.seat', JSON.stringify(stored)), hostSeat);
    await page.route('**/api/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('/events')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            events: [
              { seq: 1, type: 'INVESTIGATION_RESULT', audience: 'PLAYER', payload: { kind: 'ALIGNMENT_WOLF_OR_NOT', targetPlayerIds: [target.playerId], result: { value: 'NOT_WOLF' } } },
              { seq: 2, type: 'INFECTION_OCCURRED', audience: 'HOST', payload: { sourcePlayerId: seat(4).playerId, targetPlayerId: target.playerId, roleId: 'infected_wolf' } },
            ],
          }),
        });
      }
      if (url.includes('/state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(morningState()) });
      if (url.includes('/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROLE_FIXTURES.villager) });
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }) });
    });
    await page.goto(`/game/${GAME}`);
    const report = page.getByRole('list', { name: 'Your report' });
    await expect(report).toContainText('Seat 2 is not a Wolf.');
    await expect(report).not.toContainText('Infected Wolf');
    await inView(page, report);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
});
