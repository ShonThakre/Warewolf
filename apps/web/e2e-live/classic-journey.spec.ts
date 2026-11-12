import { expect, test, type Page } from '@playwright/test';
import type { RosterEntry } from '@warewolf/contracts';
import { createInBrowser, hostClose, openSeat, seatButton, startInBrowser, voteInBrowser } from './support';

/**
 * Classic, 10 seats, start to finish in the browser (testing-plan.md §3,
 * "Classic short", extended to a result). The host plays and paces from the
 * screen. A second browser is the Seeker. The other seats are bots that never
 * act at night and vote out a wolf each day, so the Village wins on day 2.
 */
test('Classic: create, set up, start, investigate, discuss, vote, and see the Village win', async ({ page, browser }) => {
  const game = await createInBrowser(page, 'Hosta', 'Classic');
  // Host pacing, so a 90-second timer cannot race the script. Timers are covered in the API suite.
  const { draft } = await game.configuration();
  await game.saveConfiguration({ ...draft, pacing: 'HOST', timers: null });
  await game.fill(10);
  await page.reload();
  await expect(page.getByText('Configuration valid')).toBeVisible();

  await startInBrowser(page);
  const roster = (await game.roster()).players;
  const host = roster.find((p) => p.isHost)!;
  const seekerEntry = roster.find((p) => p.currentRoleId === 'seeker')!;
  const wolves = roster.filter((p) => p.wolfAligned).sort((a, b) => a.seatNumber - b.seatNumber);

  // Reveal: the host reads their own role, never anyone else's.
  await expect(page.getByRole('region', { name: 'Your role' }).getByRole('heading', { level: 1 })).toHaveText(roleName(host.currentRoleId));

  const seekerPage: Page = seekerEntry.isHost ? page : await openSeat(browser, page, game.seat(seekerEntry.playerId), `/game/${game.gameId}/reveal`);
  if (!seekerEntry.isHost) {
    await expect(seekerPage.getByRole('heading', { level: 1, name: 'Seeker' })).toBeVisible();
    await seekerPage.getByRole('link', { name: 'I understand' }).click();
  }

  await hostClose(page, game); // Begin the night
  await page.waitForURL(new RegExp(`/game/${game.gameId}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Night' })).toBeVisible();

  // Night 1: the Seeker investigates the first wolf from the screen.
  const firstWolf = wolves[0]!;
  await seatButton(seekerPage, firstWolf).click();
  await seekerPage.getByRole('button', { name: 'Submit' }).click();
  await expect(seekerPage.getByRole('button', { name: /Choice sent|Update choice/ }).first()).toBeVisible();

  await hostClose(page, game); // Close night actions → resolves the night (Classic has no host confirm)
  await expect(page.getByRole('heading', { level: 1, name: 'Morning' })).toBeVisible();
  // Only the Seeker reads the result.
  await expect(seekerPage.getByText(new RegExp(`${firstWolf.displayName} is a Wolf\\.`))).toBeVisible();
  if (!seekerEntry.isHost) await expect(page.getByText(/is a Wolf\./)).toHaveCount(0);

  for (let day = 1; day <= wolves.length; day++) {
    const state = await game.state();
    if (state.status !== 'ACTIVE') break;
    if (state.phase === 'NIGHT_SUBMIT') {
      await hostClose(page, game); // a quiet night
    }
    if ((await game.state()).phase === 'DAY_ANNOUNCE') await hostClose(page, game); // Continue to day

    // Day discussion: the host speaks and the Seeker's screen shows it live.
    const line = `Day ${day}: I think it is ${wolves[day - 1]!.displayName}.`;
    await page.getByRole('textbox', { name: 'Message' }).fill(line);
    await page.getByRole('button', { name: 'Send' }).click();
    if (seekerPage !== page) await expect(seekerPage.getByText(line)).toBeVisible();
    await hostClose(page, game); // Continue to voting
    await expect(page.getByRole('heading', { level: 1, name: 'Voting' })).toBeVisible();

    const living = (await game.roster()).players.filter((p) => p.lifeStatus === 'ALIVE');
    const target = living.filter((p) => p.wolfAligned).sort((a, b) => a.seatNumber - b.seatNumber)[0]!;
    await castFromScreen(page, host, target, living);
    if (seekerPage !== page && living.some((p) => p.playerId === seekerEntry.playerId)) await castFromScreen(seekerPage, seekerEntry, target, living);
    for (const voter of living) {
      if (voter.isHost || voter.playerId === seekerEntry.playerId) continue;
      await game.vote(game.seat(voter.playerId), voter.playerId === target.playerId ? null : target.playerId);
    }
    await hostClose(page, game); // End the day
  }

  await page.waitForURL(new RegExp(`/game/${game.gameId}/results$`));
  await expect(page.getByRole('heading', { name: 'Village wins' })).toBeVisible();
  if (seekerPage !== page) {
    await seekerPage.waitForURL(/\/results$/);
    await expect(seekerPage.getByRole('heading', { name: 'Village wins' })).toBeVisible();
  }
  const results = await game.results();
  expect(results.status === 'FINISHED' && results.winningTeam).toBe('VILLAGE');
});

async function castFromScreen(page: Page, voter: RosterEntry, target: RosterEntry, living: readonly RosterEntry[]): Promise<void> {
  if (!living.some((p) => p.playerId === voter.playerId)) return;
  await voteInBrowser(page, voter.playerId === target.playerId ? null : target);
}

const ROLE_NAMES: Record<string, string> = { pack_wolf: 'Pack Wolf', seeker: 'Seeker', doctor: 'Doctor', normal_villager: 'Villager' };
const roleName = (id: string) => ROLE_NAMES[id] ?? id;
