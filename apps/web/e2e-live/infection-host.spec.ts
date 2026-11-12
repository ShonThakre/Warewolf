import { expect, test, type Page } from '@playwright/test';
import { createInBrowser, hostClose, openSeat, startInBrowser } from './support';

/**
 * Infection Edition, 20 seats (testing-plan.md §3, "Infection start"): the
 * Alpha names a victim, the host picks that target on the Host dashboard, the
 * informed Doctor sees the target on their own screen and saves, and the
 * morning has no death. Every seat but the host and the Doctor is a bot.
 */
test('Infection: host picks the kill on the dashboard, the Doctor saves, nobody dies', async ({ page, browser }) => {
  const game = await createInBrowser(page, 'Hosta');
  await game.fill(20);
  await page.reload();
  await expect(page.getByText('Configuration valid')).toBeVisible();
  await startInBrowser(page);

  const roster = (await game.roster()).players;
  const alpha = roster.find((p) => p.currentRoleId === 'alpha_wolf')!;
  const doctor = roster.find((p) => p.currentRoleId === 'doctor')!;
  const victim = roster.find((p) => p.currentRoleId === 'normal_villager' && !p.isHost)!;
  const doctorPage: Page = doctor.isHost ? page : await openSeat(browser, page, game.seat(doctor.playerId), `/game/${game.gameId}`);

  await hostClose(page, game); // Begin the night
  const kill = alpha.abilities.find((a) => a.capability === 'KILL')!;
  expect((await game.submit(game.seat(alpha.playerId), kill.abilityInstanceId, { targetPlayerIds: [victim.playerId] })).status).toBe(200);

  await page.waitForURL(new RegExp(`/game/${game.gameId}$`));
  await hostClose(page, game); // Close night actions → host confirm
  await expect(page.getByRole('heading', { level: 1, name: 'Host confirm' })).toBeVisible();

  // The host dashboard: Night actions shows the submission, and the kill picker lists the named player.
  await page.getByRole('link', { name: 'Host controls' }).click();
  await page.waitForURL(/\/host$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Night actions' })).toBeVisible();
  const picker = page.getByRole('region', { name: 'Kill target' });
  await picker.getByRole('button', { name: `Target ${victim.displayName}` }).click();
  await expect.poll(async () => (await game.killTarget()).decision).toEqual({ kind: 'TARGET', playerId: victim.playerId });
  await hostClose(page, game); // Open reactions
  expect((await game.state()).phase).toBe('NIGHT_REACTION');

  // The informed Doctor sees who will be attacked, and saves them from their own screen.
  if (!doctor.isHost) await doctorPage.reload();
  else await page.goto(`/game/${game.gameId}`);
  await expect(doctorPage.getByText(victim.displayName).first()).toBeVisible();
  await doctorPage.getByRole('button', { name: 'Submit' }).click();
  await expect(doctorPage.getByRole('button', { name: /Choice sent|Update choice/ }).first()).toBeVisible();

  if (doctor.isHost) await page.goto(`/game/${game.gameId}/host`);
  await hostClose(page, game); // Resolve night
  await expect.poll(async () => (await game.state()).phase).toBe('DAY_ANNOUNCE');
  const state = await game.state();
  expect(state.players.find((p) => p.playerId === victim.playerId)?.lifeStatus).toBe('ALIVE');
  expect(state.players.every((p) => p.lifeStatus === 'ALIVE')).toBe(true);

  // The morning on the Doctor's table names no death.
  if (doctorPage !== page) {
    await expect(doctorPage.getByRole('heading', { level: 1, name: 'Morning' })).toBeVisible();
    await expect(doctorPage.getByText(/No one was eliminated/)).toBeVisible();
    await expect(doctorPage.getByText(new RegExp(`${victim.displayName} was eliminated`))).toHaveCount(0);
  }
  await game.cancel();
});
