import { expect, type Browser, type Page } from '@playwright/test';
import { GameDriver, Http, type Seat } from '@warewolf/e2e-tools';

/**
 * Shared steps for the live browser flows (E2E-03). A browser page is one
 * seat; every other seat is a bot on @warewolf/e2e-tools, talking to the same
 * API. Nothing here mocks a route.
 */

export const API_URL = (process.env['E2E_API_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');
export const newHttp = () => new Http(API_URL);

const SEAT_KEY = 'warewolf.seat';

export type ModeButton = 'Infection Edition' | 'Classic' | 'Expanded' | 'Custom' | 'Ultimate 20';

/** Home → Create Game → Game setup, as a host would. Optionally picks another mode and saves it. */
export async function createInBrowser(page: Page, hostName: string, mode?: ModeButton): Promise<GameDriver> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create Game' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Create a game' });
  await dialog.getByRole('textbox', { name: 'Display name' }).fill(hostName);
  await dialog.getByRole('button', { name: 'Create Game' }).click();
  await page.waitForURL(/\/lobby\/[^/]+\/setup$/);
  await expect(page.getByRole('heading', { level: 1, name: /Setup Game/ })).toBeVisible();
  if (mode && mode !== 'Infection Edition') {
    await page.getByRole('group', { name: 'Game mode' }).getByRole('button', { name: mode, exact: true }).click();
    await page.getByRole('button', { name: 'Save setup' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  }
  const seat = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? 'null'), SEAT_KEY);
  expect(seat, 'the browser holds its seat').toBeTruthy();
  return GameDriver.attach(newHttp(), { ...seat, displayName: hostName });
}

/** A second browser for one seat, signed in the way a reload finds it: the seat in sessionStorage. */
export async function openSeat(browser: Browser, like: Page, seat: Seat, path: string): Promise<Page> {
  const context = await browser.newContext({ viewport: like.viewportSize() });
  const { displayName: _name, ...credentials } = seat;
  await context.addInitScript(
    ([key, value]) => {
      sessionStorage.setItem(key, value);
    },
    [SEAT_KEY, JSON.stringify(credentials)] as const,
  );
  const page = await context.newPage();
  await page.goto(path);
  return page;
}

/** Start game from Game setup or the lobby, acknowledging warnings when asked. Lands on the reveal. */
export async function startInBrowser(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start game' }).click();
  const warn = page.getByRole('dialog', { name: 'Acknowledge warnings' });
  if (await appears(warn)) await warn.getByRole('button', { name: 'Start the game' }).click();
  await page.waitForURL(/\/game\/[^/]+\/reveal$/);
}

async function appears(locator: ReturnType<Page['locator']>, timeout = 1_500): Promise<boolean> {
  return locator.waitFor({ state: 'visible', timeout }).then(
    () => true,
    () => false,
  );
}

/**
 * The host closes the phase with the on-screen control, confirming when the
 * screen asks, and waits until the server has moved on.
 */
export async function hostClose(page: Page, game: GameDriver): Promise<string> {
  const before = (await game.state()).stateVersion;
  const group = page.getByRole('group', { name: /^(Host controls|Continue|Close this phase)$/ });
  const button = (await appears(group, 3_000)) ? group.getByRole('button').last() : page.getByRole('button', { name: 'Begin the night' });
  await expect(button).toBeEnabled();
  const label = (await button.innerText()).trim();
  await button.click();
  const confirm = page.getByRole('dialog', { name: `${label}?` });
  if (await appears(confirm)) await confirm.getByRole('button', { name: label }).click();
  await expect.poll(async () => (await game.state()).stateVersion, { message: `"${label}" moved the game on` }).toBeGreaterThan(before);
  return label;
}

/** The seat's grid button: "3. Name Alive" at night, "Seat 3 • Name Living" on a ballot. */
export function seatButton(page: Page, seat: { seatNumber: number; displayName: string }) {
  return page.getByRole('button', { name: new RegExp(`^(${seat.seatNumber}\\. |Seat ${seat.seatNumber} • )${escape(seat.displayName)}\\b`) });
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Casts this page's ballot for a seat, or abstains with null. */
export async function voteInBrowser(page: Page, target: { seatNumber: number; displayName: string } | null): Promise<void> {
  if (target) {
    await seatButton(page, target).click();
  } else {
    await page.getByRole('button', { name: 'Abstain' }).click();
  }
  await page.getByRole('button', { name: /^Submit (re)?vote$/ }).click();
  await expect(page.getByRole('button', { name: /^(Vote sent|Change vote)$/ }).first()).toBeVisible();
}
