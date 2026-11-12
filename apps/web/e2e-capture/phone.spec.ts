// TEMPORARY (UX-PHONE): drives one Infection game and screenshots each portrait screen.
import { expect, test, type Page } from '@playwright/test';
import { play, villageWin } from '@warewolf/e2e-tools';
import { createInBrowser, hostClose, openSeat, seatButton, startInBrowser } from '../e2e-live/support';

const OUT = process.env['SHOTS'] ?? 'shots';
const only = (process.env['ONLY'] ?? '').split(',').filter(Boolean);
async function shot(page: Page, name: string) {
  if (only.length && !only.some((o) => name.startsWith(o))) return;
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) console.log(`OVERFLOW ${name}: ${overflow}px`);
}

test('phone capture', async ({ page, browser }) => {
  await page.goto('/');
  await shot(page, '01-home');

  const game = await createInBrowser(page, 'Hosta');
  await game.fill(20);
  await page.reload();
  await expect(page.getByText('Configuration valid')).toBeVisible();
  await shot(page, '03-setup-mode');
  await page.getByRole('button', { name: /^(2\s*)?Roles/ }).first().click().catch(() => {});
  await shot(page, '03-setup-roles');

  await page.goto(`/lobby/${game.gameId}`);
  await expect(page.getByRole('button', { name: 'Start game' })).toBeVisible();
  await shot(page, '02-lobby');

  await startInBrowser(page);
  await expect(page.getByRole('region', { name: 'Your role' })).toBeVisible();
  await shot(page, '04-reveal');

  await hostClose(page, game); // Begin the night
  const roster = (await game.roster()).players;
  const alpha = roster.find((p) => p.currentRoleId === 'alpha_wolf')!;
  const victim = roster.find((p) => p.currentRoleId === 'normal_villager' && !p.isHost)!;
  const alphaPage = alpha.isHost ? page : await openSeat(browser, page, game.seat(alpha.playerId), `/game/${game.gameId}`);
  await expect(alphaPage.getByRole('heading', { level: 1, name: 'Night' })).toBeVisible();
  await seatButton(alphaPage, victim).first().click().catch(() => {});
  await shot(alphaPage, '05-night');
  await page.goto(`/game/${game.gameId}`);
  await shot(page, '05-night-host');
  const kill = alpha.abilities.find((a) => a.capability === 'KILL')!;
  await game.submit(game.seat(alpha.playerId), kill.abilityInstanceId, { targetPlayerIds: [victim.playerId] });

  await hostClose(page, game); // Close night actions → host confirm
  await page.goto(`/game/${game.gameId}/host`);
  await expect(page.getByRole('heading', { level: 2, name: 'Night actions' })).toBeVisible();
  await shot(page, '06-host-night');
  await page.getByRole('button', { name: 'Overview' }).click();
  await shot(page, '11-host-overview');
  await page.getByRole('button', { name: 'Night actions' }).click();
  await page.getByRole('region', { name: 'Kill target' }).getByRole('button', { name: `Target ${victim.displayName}` }).click();
  await expect.poll(async () => (await game.killTarget()).decision).toEqual({ kind: 'TARGET', playerId: victim.playerId });
  await hostClose(page, game); // Open reactions
  await hostClose(page, game); // Resolve night
  await expect.poll(async () => (await game.state()).phase).toBe('DAY_ANNOUNCE');
  await page.goto(`/game/${game.gameId}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Morning' })).toBeVisible();
  await shot(page, '07-morning');
  const guest = roster.find((p) => !p.isHost && p.playerId !== victim.playerId && p.playerId !== alpha.playerId)!;
  const guestPage = await openSeat(browser, page, game.seat(guest.playerId), `/game/${game.gameId}`);
  await expect(guestPage.getByRole('heading', { level: 1, name: 'Morning' })).toBeVisible();
  await shot(guestPage, '07-morning-guest');

  await hostClose(page, game); // Continue to day
  const living = (await game.roster()).players.filter((p) => p.lifeStatus === 'ALIVE').sort((a, b) => a.seatNumber - b.seatNumber);
  const lines = ['Morning everyone. Who was up last night?', 'I heard howling near the well.', 'Let us not rush the vote today.', 'I have a strong feeling about seat 7.', 'Same here. Let us hear from them first.'];
  for (const [i, line] of lines.entries()) await game.chat(game.seat(living[(i * 3 + 1) % living.length]!.playerId), line);
  await page.getByRole('textbox', { name: 'Message' }).fill('Hosting today. Speak up!');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(600);
  await shot(page, '08-discussion');
  await shot(guestPage, '08-discussion-guest');

  await hostClose(page, game); // Continue to voting
  await expect(page.getByRole('heading', { level: 1, name: 'Voting' })).toBeVisible();
  const villagers = living.filter((p) => !p.wolfAligned && !p.isHost);
  const [a, b] = villagers;
  await seatButton(page, a!).first().click();
  await shot(page, '09-voting');
  await guestPage.reload();
  await shot(guestPage, '09-voting-guest');
  const rest = living.filter((p) => p !== a && p !== b);
  const ballot = async () => {
    await game.vote(game.seat(a!.playerId), b!.playerId);
    await game.vote(game.seat(b!.playerId), a!.playerId);
    for (const [i, voter] of rest.entries()) await game.vote(game.seat(voter.playerId), rest.length % 2 === 1 && i === rest.length - 1 ? null : i % 2 === 0 ? a!.playerId : b!.playerId);
  };
  await ballot();
  await hostClose(page, game); // End the day → revote
  await expect(page.getByRole('heading', { level: 1, name: 'Revote' })).toBeVisible();
  await page.getByRole('list', { name: /Choose a player/ }).getByRole('button').last().click().catch(() => {});
  await shot(page, '10-revote');

  await play(game, { policy: villageWin, stopWhen: (s) => s.status !== 'ACTIVE' });
  await page.goto(`/game/${game.gameId}/results`);
  await page.waitForTimeout(1000);
  await shot(page, '12-results');
});
