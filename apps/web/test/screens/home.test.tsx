import type { SeatCredentials } from '@warewolf/contracts';
import { configurationResponseSchema } from '@warewolf/contracts';
import { validateConfiguration } from '@warewolf/domain';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { configurationFromPack } from '../../src/game/setup/setupDraft';
import { json, renderApp } from '../render';

const GAME = '0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31';
const HOST = '5c1d0e77-1a2b-4c3d-8e9f-001122334455';

const credentials: SeatCredentials = {
  gameId: GAME,
  roomCode: 'K7QMPR',
  playerId: HOST,
  token: 'ww_token_for_tests_0123456789',
  isHost: true,
};

const lobby = {
  gameId: GAME,
  roomCode: 'K7QMPR',
  status: 'LOBBY',
  phase: 'LOBBY',
  mode: 'INFECTION',
  rolePackId: 'infection-core',
  playerCount: 20,
  hostPlayerId: HOST,
  stateVersion: 1,
  players: [{ playerId: HOST, displayName: 'Asha', seatNumber: 1, avatarId: 1, isHost: true, connectionStatus: 'DISCONNECTED' }],
  you: { playerId: HOST, isHost: true },
  configuration: {
    valid: true,
    errorCount: 0,
    warningCount: 0,
    summary: {
      playerCount: 20,
      selectedSeats: 20,
      remainingSeats: 0,
      factions: { VILLAGE: 19, WOLF_PACK: 1, NEUTRAL: 0, INDEPENDENT: 0 },
      startingPack: 1,
      wolfCap: 5,
      infectionSuccesses: 4,
    },
  },
  start: { ready: false, blockers: ['SEATS_OPEN'], requiresWarningAcknowledgement: false },
};

function infectionConfiguration() {
  const draft = configurationFromPack('infection-core');
  if (!draft) throw new Error('missing pack infection-core');
  return configurationResponseSchema.parse({ draft, validation: validateConfiguration(draft), editable: true });
}

function fetchRoute(status: number, body: unknown): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/role-packs')) return json(200, []);
    if (request.method === 'POST' && path.endsWith('/games')) return json(status, body);
    if (request.method === 'POST' && path.endsWith('/games/join')) return json(status, body);
    if (path.endsWith(`/games/${GAME}/configuration`)) return json(200, infectionConfiguration());
    if (path.endsWith(`/games/${GAME}`)) return json(200, lobby);
    return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }) as typeof fetch;
}

afterEach(cleanup);

describe('home', () => {
  it('offers create and join on the night scene', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Werewolf' })).toBeTruthy();
    expect(screen.getByText('Infection Edition')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create Game' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join Game' })).toBeTruthy();
    const scene = document.querySelector('.ww-home');
    if (!scene) throw new Error('missing home scene');
    expect(within(scene as HTMLElement).getByRole('link', { name: 'Role Library' })).toBeTruthy();
    expect(within(scene as HTMLElement).getByRole('link', { name: 'How to Play' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Your seat' })).toBeNull();
  });

  it('rejects a short display name before calling the server', async () => {
    renderApp('/', { fetchFn: fetchRoute(201, credentials) });
    fireEvent.click(await screen.findByRole('button', { name: 'Create Game' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a game' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Display name' }), { target: { value: 'A' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Game' }));
    expect(await within(dialog).findByText('Use at least 2 characters.')).toBeTruthy();
  });

  it('creates an Infection Edition game and opens setup', async () => {
    const { router } = renderApp('/', { fetchFn: fetchRoute(201, credentials) });
    fireEvent.click(await screen.findByRole('button', { name: 'Create Game' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a game' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Display name' }), { target: { value: 'Asha' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Game' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/lobby/${GAME}/setup`));
    expect(await screen.findByRole('heading', { name: 'Setup Game – Mode and players' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Back to the lobby/ })).toBeTruthy();
  });

  it('shows a taken display name on the join form', async () => {
    renderApp('/', {
      fetchFn: fetchRoute(409, { error: { code: 'DISPLAY_NAME_TAKEN', message: 'That name is already taken in this room.' } }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Join Game' }));
    const dialog = await screen.findByRole('dialog', { name: 'Join a game' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Room code' }), { target: { value: 'K7QMPR' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Display name' }), { target: { value: 'Asha' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Join Game' }));
    expect(await within(dialog).findByText('That name is already taken in this room.')).toBeTruthy();
  });

  it('sends a finished seat to the results and an open game back in', async () => {
    const finished = { ...lobby, status: 'FINISHED', phase: 'FINISHED' };
    const { unmount } = renderApp('/', {
      seat: credentials,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(new Request(input, init).url).pathname;
        if (path.endsWith('/role-packs')) return json(200, []);
        if (path.endsWith(`/games/${GAME}`)) return json(200, finished);
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    const results = await screen.findByRole('link', { name: 'See the results' });
    expect(results.getAttribute('href')).toBe(`/game/${GAME}/results`);
    expect(screen.getByRole('region', { name: 'Your seat' }).textContent).toContain('K7QMPR');
    unmount();

    const active = { ...lobby, status: 'ACTIVE', phase: 'NIGHT_SUBMIT' };
    renderApp('/', {
      seat: credentials,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(new Request(input, init).url).pathname;
        if (path.endsWith('/role-packs')) return json(200, []);
        if (path.endsWith(`/games/${GAME}`)) return json(200, active);
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    const game = await screen.findByRole('link', { name: 'Return to the game' });
    expect(game.getAttribute('href')).toBe(`/game/${GAME}`);
  });
});
