import type { LobbyProjection, SeatCredentials } from '@warewolf/contracts';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROLE_FIXTURES } from '../../src/game/fixtures/role';
import { json, renderApp } from '../render';

const GAME = '0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31';
const HOST = '5c1d0e77-1a2b-4c3d-8e9f-001122334455';
const GUEST = '7d2e1f88-2b3c-4d5e-9f00-112233445566';

const hostSeat: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: HOST, token: 'ww_token_for_tests_0123456789', isHost: true };
const guestSeat: SeatCredentials = { ...hostSeat, playerId: GUEST, token: 'ww_guest_token_for_tests_012345', isHost: false };

function projection(youIsHost: boolean): LobbyProjection {
  return {
    gameId: GAME,
    roomCode: 'K7QMPR',
    status: 'LOBBY',
    phase: 'LOBBY',
    mode: 'CLASSIC',
    rolePackId: 'classic-10',
    playerCount: 10,
    hostPlayerId: HOST,
    stateVersion: 1,
    players: [
      { playerId: HOST, displayName: 'Asha', seatNumber: 1, avatarId: 1, isHost: true, connectionStatus: 'DISCONNECTED' },
      { playerId: GUEST, displayName: 'Rafi', seatNumber: 2, avatarId: 2, isHost: false, connectionStatus: 'DISCONNECTED' },
    ],
    you: { playerId: youIsHost ? HOST : GUEST, isHost: youIsHost },
    configuration: {
      valid: true,
      errorCount: 0,
      warningCount: 1,
      summary: {
        playerCount: 10,
        selectedSeats: 10,
        remainingSeats: 0,
        factions: { VILLAGE: 8, WOLF_PACK: 2, NEUTRAL: 0, INDEPENDENT: 0 },
        startingPack: 2,
        wolfCap: 2,
        infectionSuccesses: null,
      },
    },
    start: { ready: false, blockers: ['SEATS_OPEN'], requiresWarningAcknowledgement: true },
  };
}

const pack = {
  id: 'classic-10',
  name: 'Classic 10',
  status: 'RECOMMENDED',
  description: 'A short game.',
  mode: 'CLASSIC',
  playerCount: 10,
  blockedBy: [],
  errorCodes: [],
  warningCodes: [],
};

function fetchRoute(room: LobbyProjection, onPost?: (request: Request) => void): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/role-packs')) return json(200, [pack]);
    if (request.method === 'POST') {
      onPost?.(request);
      return json(200, request.url.endsWith('/leave') ? { gameCancelled: false } : room);
    }
    return json(200, room);
  }) as typeof fetch;
}

afterEach(cleanup);

describe('lobby screen', () => {
  it('sends an unseated visit home', async () => {
    const { router } = renderApp(`/lobby/${GAME}`);
    expect(await screen.findByRole('heading', { name: 'Werewolf' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows the room, the pack, and a closed start for the host', async () => {
    renderApp(`/lobby/${GAME}`, { seat: hostSeat, fetchFn: fetchRoute(projection(true)) });
    expect(await screen.findByRole('heading', { name: 'Moonlit Village' })).toBeTruthy();
    expect(screen.getByText('K7QMPR')).toBeTruthy();
    expect(screen.getByText('Classic 10')).toBeTruthy();
    expect(screen.getAllByText('Village 8').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Wolf 2').length).toBeGreaterThan(0);
    expect(screen.getByText(/8 more seats are needed to start \(2 \/ 10\)/)).toBeTruthy();
    const start = screen.getByRole('button', { name: 'Start game' });
    expect(start.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Remove Rafi' })).toBeTruthy();
    expect(document.querySelector('[data-scene="lobby_campfire"]')).toBeTruthy();
  });

  it('shows a waiting line for a guest and hides host controls', async () => {
    renderApp(`/lobby/${GAME}`, { seat: guestSeat, fetchFn: fetchRoute(projection(false)) });
    expect(await screen.findByText(/^Waiting for .+ to start the game\.$/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View setup' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start game' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Rafi' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Asha' })).toBeNull();
  });

  it('copies the room code', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderApp(`/lobby/${GAME}`, { seat: hostSeat, fetchFn: fetchRoute(projection(true)) });
    fireEvent.click(await screen.findByRole('button', { name: 'Copy room code K 7 Q M P R' }));
    expect(writeText).toHaveBeenCalledWith('K7QMPR');
    expect(await screen.findByText('Room code copied.')).toBeTruthy();
    expect(screen.getByText('✓ Copied')).toBeTruthy();
  });

  it('starts a ready room and opens the reveal', async () => {
    const posts: { url: string; body: unknown }[] = [];
    const ready = projection(true);
    ready.start.ready = true;
    ready.start.blockers = [];
    ready.start.requiresWarningAcknowledgement = false;
    const started = { gameId: GAME, status: 'ACTIVE', phase: 'ROLE_REVEAL', roundNumber: 1, stateVersion: 2 };
    renderApp(`/lobby/${GAME}`, {
      seat: hostSeat,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (request.method === 'POST' && path.endsWith('/start')) {
          posts.push({ url: path, body: await request.json() });
          return json(200, started);
        }
        if (path.endsWith('/me')) return json(200, { ...ROLE_FIXTURES.villager, gameId: GAME, playerId: HOST });
        if (path.endsWith('/role-packs')) return json(200, [pack]);
        return json(200, ready);
      }) as typeof fetch,
    });
    const start = await screen.findByRole('button', { name: 'Start game' });
    expect(start.hasAttribute('disabled')).toBe(false);
    fireEvent.click(start);
    expect(await screen.findByRole('heading', { name: 'Villager' })).toBeTruthy();
    expect(posts[0]?.body).toEqual({ acknowledgeWarnings: false });
    expect(document.body.textContent).not.toContain('alpha_wolf');
  });

  it('removes another player after confirmation', async () => {
    const posts: string[] = [];
    renderApp(`/lobby/${GAME}`, {
      seat: hostSeat,
      fetchFn: fetchRoute(projection(true), (request) => {
        posts.push(`${request.method} ${new URL(request.url).pathname}`);
      }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Rafi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove Rafi?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await screen.findByRole('heading', { name: 'Moonlit Village' });
    expect(posts.some((line) => line.endsWith(`/players/${GUEST}/kick`))).toBe(true);
  });

  it('changes the host avatar and keeps a taken one closed', async () => {
    const puts: unknown[] = [];
    renderApp(`/lobby/${GAME}`, {
      seat: hostSeat,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        if (request.method === 'PUT' && request.url.endsWith('/me/avatar')) {
          puts.push(await request.json());
          const next = projection(true);
          next.players = next.players.map((player) => (player.playerId === HOST ? { ...player, avatarId: 3 } : player));
          return json(200, next);
        }
        return fetchRoute(projection(true))(input, init);
      }) as typeof fetch,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Change avatar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose an avatar' });
    expect(within(dialog).getByRole('button', { name: 'Avatar 2, taken' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Avatar 3' }));
    await waitFor(() => expect(puts).toEqual([{ avatarId: 3 }]));
  });

  it('says when the chosen avatar is already taken', async () => {
    renderApp(`/lobby/${GAME}`, {
      seat: hostSeat,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        if (request.method === 'PUT') {
          return json(409, { error: { code: 'AVATAR_TAKEN', message: 'That avatar is already taken.' } });
        }
        return fetchRoute(projection(true))(input, init);
      }) as typeof fetch,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Change avatar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Avatar 3' }));
    expect(await screen.findByText('That avatar is already taken.')).toBeTruthy();
  });
});
