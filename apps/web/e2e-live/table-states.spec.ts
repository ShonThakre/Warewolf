import { expect, test } from '@playwright/test';
import { play, idle, type GameDriver } from '@warewolf/e2e-tools';
import { createInBrowser, hostClose, openSeat, startInBrowser } from './support';

/** testing-plan.md §3: "Tie vote", "Player reload", and "Host reload", against the real API. */

async function classicTen(page: Parameters<typeof createInBrowser>[0]): Promise<GameDriver> {
  const game = await createInBrowser(page, 'Hosta', 'Classic');
  const { draft } = await game.configuration();
  await game.saveConfiguration({ ...draft, pacing: 'HOST', timers: null });
  await game.fill(10);
  await page.reload();
  await expect(page.getByText('Configuration valid')).toBeVisible();
  await startInBrowser(page);
  return game;
}

test('Tie vote: the revote ballot lists only the tied players, and a second tie eliminates nobody', async ({ page }) => {
  const game = await classicTen(page);
  await play(game, { policy: idle, stopWhen: (s) => s.phase === 'VOTING' });
  await page.goto(`/game/${game.gameId}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Voting' })).toBeVisible();

  // Two villagers vote for each other; the other eight split four and four.
  const living = (await game.roster()).players.filter((p) => p.lifeStatus === 'ALIVE').sort((a, b) => a.seatNumber - b.seatNumber);
  const [a, b] = living.filter((p) => !p.wolfAligned);
  const rest = living.filter((p) => p !== a && p !== b);
  const ballot = async () => {
    await game.vote(game.seat(a!.playerId), b!.playerId);
    await game.vote(game.seat(b!.playerId), a!.playerId);
    for (const [i, voter] of rest.entries()) await game.vote(game.seat(voter.playerId), i % 2 === 0 ? a!.playerId : b!.playerId);
  };
  await ballot();
  await hostClose(page, game); // End the day → tie → revote

  await expect(page.getByRole('heading', { level: 1, name: 'Revote' })).toBeVisible();
  const choices = page.getByRole('list', { name: /Choose a player/ }).getByRole('button');
  await expect(choices).toHaveCount(2);
  await expect(choices.nth(0)).toContainText(a!.displayName);
  await expect(choices.nth(1)).toContainText(b!.displayName);

  await ballot();
  await hostClose(page, game); // End the revote → tie again → night 2
  await expect.poll(async () => (await game.state()).phase).toBe('NIGHT_SUBMIT');
  expect((await game.state()).players.filter((p) => p.lifeStatus === 'DEAD')).toEqual([]);
  await expect(page.getByRole('heading', { level: 1, name: 'Night' })).toBeVisible();
  await game.cancel();
});

test('Reload: a player gets their own role back, and the host dashboard keeps the roster', async ({ page, browser }) => {
  const game = await classicTen(page);
  const roster = (await game.roster()).players;
  const player = roster.find((p) => !p.isHost)!;
  const roleName = { pack_wolf: 'Pack Wolf', seeker: 'Seeker', doctor: 'Doctor', normal_villager: 'Villager' }[player.currentRoleId]!;

  const seatPage = await openSeat(browser, page, game.seat(player.playerId), `/game/${game.gameId}/reveal`);
  await expect(seatPage.getByRole('heading', { level: 1, name: roleName })).toBeVisible();
  await hostClose(page, game); // Begin the night
  await seatPage.goto(`/game/${game.gameId}`);
  await expect(seatPage.getByRole('region', { name: 'Actions' }).getByText(roleName, { exact: true })).toBeVisible();
  await seatPage.reload();
  await expect(seatPage.getByRole('region', { name: 'Actions' }).getByText(roleName, { exact: true })).toBeVisible();
  await expect(seatPage.getByRole('heading', { level: 1, name: 'Night' })).toBeVisible();

  await page.goto(`/game/${game.gameId}/host`);
  await page.getByRole('button', { name: 'Players and roles' }).click();
  for (const entry of roster) await expect(page.getByText(entry.displayName, { exact: true }).first()).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Players and roles' }).click();
  for (const entry of roster) await expect(page.getByText(entry.displayName, { exact: true }).first()).toBeVisible();
  await game.cancel();
});
