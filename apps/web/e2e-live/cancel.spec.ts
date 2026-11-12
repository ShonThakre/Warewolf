import { expect, test } from '@playwright/test';
import { createInBrowser, hostClose, openSeat, startInBrowser } from './support';

/**
 * GAP-02: the host cancels from the Host dashboard during an active game.
 * Every seat lands on Results with roles still hidden.
 */
test('Cancel game: host cancels from the dashboard and every seat sees Results with no roles', async ({ page, browser }) => {
  const game = await createInBrowser(page, 'Hosta', 'Classic');
  const { draft } = await game.configuration();
  await game.saveConfiguration({ ...draft, pacing: 'HOST', timers: null });
  await game.fill(10);
  await page.reload();
  await expect(page.getByText('Configuration valid')).toBeVisible();
  await startInBrowser(page);

  const roster = (await game.roster()).players;
  const guest = roster.find((p) => !p.isHost)!;
  const guestPage = await openSeat(browser, page, game.seat(guest.playerId), `/game/${game.gameId}/reveal`);
  await expect(guestPage.getByRole('heading', { level: 1 })).toBeVisible();

  await hostClose(page, game); // Begin the night
  await page.waitForURL(new RegExp(`/game/${game.gameId}$`));
  await page.getByRole('link', { name: 'Host controls' }).click();
  await page.waitForURL(/\/host$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Host dashboard' })).toBeVisible();

  await page.getByRole('button', { name: 'Cancel game' }).click();
  const confirm = page.getByRole('dialog', { name: 'Cancel this game?' });
  await expect(confirm).toContainText('Roles stay hidden');
  await confirm.getByRole('button', { name: 'Cancel game' }).click();

  await page.waitForURL(new RegExp(`/game/${game.gameId}/results$`));
  await expect(page.getByRole('heading', { name: 'Cancelled' })).toBeVisible();
  await expect(page.getByText('Roles stay hidden for a cancelled game.')).toBeVisible();
  await expect(page.getByText(/Pack Wolf|Seeker|Doctor|Villager|Alpha Wolf/)).toHaveCount(0);

  await guestPage.waitForURL(/\/results$/);
  await expect(guestPage.getByRole('heading', { name: 'Cancelled' })).toBeVisible();
  await expect(guestPage.getByText('Roles stay hidden for a cancelled game.')).toBeVisible();
  await expect(guestPage.getByText(/Pack Wolf|Seeker|Doctor|Villager|Alpha Wolf/)).toHaveCount(0);

  const results = await game.results();
  expect(results.status).toBe('CANCELLED');
  if (results.status === 'CANCELLED') {
    expect(results.seats.every((seat) => !('finalRoleId' in seat) && !('originalRoleId' in seat))).toBe(true);
  }
});
