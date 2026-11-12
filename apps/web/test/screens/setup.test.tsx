import type { LobbyProjection, SeatCredentials } from '@warewolf/contracts';
import { configurationResponseSchema } from '@warewolf/contracts';
import type { GameConfiguration } from '@warewolf/domain';
import { validateConfiguration } from '@warewolf/domain';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { configurationFromPack } from '../../src/game/setup/setupDraft';
import { json, renderApp } from '../render';

const GAME = '0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31';
const HOST = '5c1d0e77-1a2b-4c3d-8e9f-001122334455';
const GUEST = '7d2e1f88-2b3c-4d5e-9f00-112233445566';

const hostSeat: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: HOST, token: 'ww_token_for_tests_0123456789', isHost: true };
const guestSeat: SeatCredentials = { ...hostSeat, playerId: GUEST, token: 'ww_guest_token_for_tests_012345', isHost: false };

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function roomFor(draft: GameConfiguration, youIsHost: boolean, startReady: boolean): LobbyProjection {
  const validation = validateConfiguration(draft);
  return {
    gameId: GAME,
    roomCode: 'K7QMPR',
    status: 'LOBBY',
    phase: 'LOBBY',
    mode: draft.mode,
    rolePackId: draft.rolePackId,
    playerCount: draft.playerCount,
    hostPlayerId: HOST,
    stateVersion: 1,
    players: [{ playerId: HOST, displayName: 'Asha', seatNumber: 1, avatarId: 1, isHost: true, connectionStatus: 'DISCONNECTED' }],
    you: { playerId: youIsHost ? HOST : GUEST, isHost: youIsHost },
    configuration: {
      valid: validation.valid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      summary: validation.summary,
    },
    start: {
      ready: startReady,
      blockers: startReady ? [] : ['SEATS_OPEN'],
      requiresWarningAcknowledgement: validation.warnings.length > 0,
    },
  };
}

function fetchSetup(packId: string, editable: boolean, onPut?: (body: GameConfiguration) => void, startReady = false): typeof fetch {
  const draft = configurationFromPack(packId);
  if (!draft) throw new Error(`missing pack ${packId}`);
  const config = configurationResponseSchema.parse({ draft, validation: validateConfiguration(draft), editable });
  const room = roomFor(draft, editable, startReady);
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/configuration') && request.method === 'PUT') {
      const body = (await request.json()) as GameConfiguration;
      onPut?.(body);
      const saved = configurationResponseSchema.parse({ draft: body, validation: validateConfiguration(body), editable: true });
      return json(200, saved);
    }
    if (path.endsWith('/configuration')) return json(200, config);
    if (path.endsWith(GAME)) return json(200, room);
    return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }) as typeof fetch;
}

afterEach(() => {
  cleanup();
  setViewport(1024, 768);
});

describe('configuration browser', () => {
  it('keeps Infection Edition locked and the counts on screen at 1024×768', async () => {
    setViewport(1024, 768);
    renderApp(`/lobby/${GAME}/setup`, { seat: hostSeat, fetchFn: fetchSetup('infection-core', true) });
    expect(await screen.findByRole('navigation', { name: 'Setup steps' })).toBeTruthy();
    const root = document.querySelector('.ww-setup');
    expect(root?.getAttribute('data-steps')).toBe('rail');
    const strip = document.querySelector('.ww-setup-strip');
    expect(strip?.textContent).toContain('Village roles');
    expect(strip?.textContent).toContain('19');
    expect(strip?.textContent).toContain('Wolf roles');
    expect(strip?.textContent).toContain('Remaining seats');
    expect(strip?.textContent).toContain('Infection cap');
    expect(strip?.textContent).toContain('4');
    expect(screen.getByText(/Infection Edition is locked at 20 players/)).toBeTruthy();
    expect((screen.getByRole('spinbutton', { name: 'Players' }) as HTMLInputElement).disabled).toBe(true);
    const steps = screen.getByRole('navigation', { name: 'Setup steps' });
    fireEvent.click(within(steps).getByRole('button', { name: '2. Roles' }));
    expect((screen.getByRole('button', { name: 'Add one Villager' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Start game' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/19 more seats are needed to start \(1 \/ 20\)/)).toBeTruthy();
  });

  it('uses one step and keeps the counts pinned at 390×844', async () => {
    setViewport(390, 844);
    renderApp(`/lobby/${GAME}/setup`, { seat: hostSeat, fetchFn: fetchSetup('infection-core', true) });
    expect(await screen.findByRole('navigation', { name: 'Setup steps' })).toBeTruthy();
    expect(document.querySelector('.ww-setup')?.getAttribute('data-steps')).toBe('one');
    const strip = document.querySelector('.ww-setup-strip');
    expect(strip?.textContent).toContain('Village roles');
    expect(strip?.textContent).toContain('Wolf roles');
    expect(strip?.textContent).toContain('Remaining seats');
  });

  it('names what to fix and keeps Start disabled when the setup is invalid', async () => {
    setViewport(1024, 768);
    renderApp(`/lobby/${GAME}/setup`, { seat: hostSeat, fetchFn: fetchSetup('custom', true, undefined, true) });
    expect(await screen.findByRole('navigation', { name: 'Setup steps' })).toBeTruthy();
    expect(screen.getAllByText(/The roles fill 0 of 10 seats. Add 10 more role seats./).length).toBeGreaterThan(0);
    expect((screen.getByRole('button', { name: 'Start game' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Setup steps' })).getByRole('button', { name: '4. Review' }));
    expect(screen.getAllByText(/The roles fill 0 of 10 seats/).length).toBeGreaterThan(0);
  });

  it('shows a guest the summary and no host controls', async () => {
    setViewport(1024, 768);
    renderApp(`/lobby/${GAME}/setup`, { seat: guestSeat, fetchFn: fetchSetup('infection-core', false) });
    expect(await screen.findByText('Waiting for the host.')).toBeTruthy();
    expect(document.querySelector('.ww-setup-strip')?.textContent).toContain('Village roles');
    expect(screen.queryByRole('button', { name: 'Save setup' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start game' })).toBeNull();
    expect((screen.getByRole('spinbutton', { name: 'Players' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('saves a mode change', async () => {
    setViewport(1024, 768);
    let savedMode = '';
    let savedPack = '';
    renderApp(`/lobby/${GAME}/setup`, {
      seat: hostSeat,
      fetchFn: fetchSetup('infection-core', true, (body) => {
        savedMode = body.mode;
        savedPack = body.rolePackId;
      }),
    });
    expect(await screen.findByRole('navigation', { name: 'Setup steps' })).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: 'Game mode' })).getByRole('button', { name: 'Classic' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    await waitFor(() => expect(savedMode).toBe('CLASSIC'));
    expect(savedPack).toBe('classic-10');
    expect((screen.getByRole('button', { name: 'Start game' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks before a preset replaces edited roles, and offers a reset', async () => {
    setViewport(1024, 768);
    renderApp(`/lobby/${GAME}/setup`, { seat: hostSeat, fetchFn: fetchSetup('classic-10', true) });
    expect(await screen.findByRole('navigation', { name: 'Setup steps' })).toBeTruthy();
    const modes = () => within(screen.getByRole('group', { name: 'Game mode' }));

    // No edits: a mode switch needs no confirmation, and re-clicking the current mode changes nothing.
    fireEvent.click(modes().getByRole('button', { name: 'Classic' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Custom, based on/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '2. Roles' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add one Villager' }));
    fireEvent.click(screen.getByRole('button', { name: '1. Mode and players' }));
    expect(await screen.findByText('Custom, based on Classic')).toBeTruthy();
    expect(screen.getByText('2 Pack Wolf · 1 Seeker · 1 Doctor · 7 Villager · 1 more than the 10 seats')).toBeTruthy();

    // Switching mode asks first. Keep editing leaves the list alone.
    fireEvent.click(modes().getByRole('button', { name: 'Expanded' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace your edited setup?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(modes().getByRole('button', { name: 'Classic' }).getAttribute('aria-pressed')).toBe('true');

    // Reset goes through the same question and restores the preset.
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Classic' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Replace roles' }));
    await waitFor(() => expect(screen.queryByText(/Custom, based on/)).toBeNull());
    const pressed = document.querySelector('.ww-setup-role-open[aria-pressed="true"] .ww-catalog-name');
    expect(pressed?.textContent).toBe('Classic');
  });

  it('starts Custom from the current roles without asking', async () => {
    setViewport(1024, 768);
    renderApp(`/lobby/${GAME}/setup`, { seat: hostSeat, fetchFn: fetchSetup('classic-10', true) });
    expect(await screen.findByRole('navigation', { name: 'Setup steps' })).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: 'Game mode' })).getByRole('button', { name: 'Custom' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByText('Custom, based on Classic')).toBeTruthy();
    expect(screen.getByText('2 Pack Wolf · 1 Seeker · 1 Doctor · 6 Villager')).toBeTruthy();
    expect((screen.getByRole('spinbutton', { name: 'Players' }) as HTMLInputElement).value).toBe('10');
  });
});
