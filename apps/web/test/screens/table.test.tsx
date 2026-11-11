import type { GameState, SeatCredentials } from '@warewolf/contracts';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_SERVER_NOW, gameStateFixture } from '../../src/game/fixtures/phase';
import { FIXTURE_GAME_ID, ROLE_FIXTURES, fixturePlayerId } from '../../src/game/fixtures/role';
import { json, renderApp } from '../render';

const GAME = FIXTURE_GAME_ID;
const host: SeatCredentials = {
  gameId: GAME,
  roomCode: 'K7QMPR',
  playerId: fixturePlayerId(1),
  token: 'ww_token_for_tests_0123456789',
  isHost: true,
};
const guest: SeatCredentials = {
  ...host,
  playerId: fixturePlayerId(4),
  token: 'ww_guest_token_for_tests_012345',
  isHost: false,
};

function stateFetch(body: GameState | ((request: Request) => GameState), onPost?: (body: unknown) => void): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
    if (request.method === 'POST' && path.endsWith('/host/phase/close')) {
      onPost?.(await request.json());
      return json(200, typeof body === 'function' ? body(request) : body);
    }
    if (path.endsWith('/state')) return json(200, typeof body === 'function' ? body(request) : body);
    return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }) as typeof fetch;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('table', () => {
  it('sends an unseated visit home', async () => {
    const { router } = renderApp(`/game/${GAME}`);
    expect(await screen.findByRole('heading', { name: 'Werewolf' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows the phase, the round, and a host button, and hides that button from a guest', async () => {
    const reveal = (request: Request) => gameStateFixture({ phase: 'ROLE_REVEAL', you: request.headers.get('Authorization')?.includes(guest.token) ? 4 : 1 });
    const { container: hostRoot } = renderApp(`/game/${GAME}`, { seat: host, fetchFn: stateFetch(reveal) });
    const { container: guestRoot } = renderApp(`/game/${GAME}`, { seat: guest, fetchFn: stateFetch(reveal) });

    const hostStatus = await within(hostRoot).findByRole('region', { name: 'Game status' });
    expect(within(hostStatus).getByRole('heading', { name: 'Role reveal' })).toBeTruthy();
    expect(within(hostStatus).getByText('Round 1')).toBeTruthy();
    expect(within(hostStatus).getByText('Waiting for host')).toBeTruthy();
    expect(hostRoot.querySelector('[data-stage="reveal"]')).toBeTruthy();
    expect(within(hostRoot).getByRole('button', { name: 'Begin the night' })).toBeTruthy();

    const guestStatus = await within(guestRoot).findByRole('region', { name: 'Game status' });
    expect(within(guestStatus).getByText('Waiting for host')).toBeTruthy();
    expect(within(guestRoot).queryByRole('button', { name: 'Begin the night' })).toBeNull();
    expect(within(guestRoot).getByRole('region', { name: 'Actions' }).textContent).toContain('Waiting for host');
    expect(guestRoot.textContent).not.toContain('NIGHT_SUBMIT');
    expect(guestRoot.textContent).not.toContain('alpha_wolf');
  });

  it('shows a Classic night as a clock and an End the night button', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(FIXTURE_SERVER_NOW));
    const classic = {
      ...gameStateFixture({ phase: 'NIGHT_SUBMIT', secondsLeft: 90 }),
      close: { next: null, resolves: 'NIGHT' as const },
    };
    renderApp(`/game/${GAME}`, { seat: host, fetchFn: stateFetch(classic) });
    const status = await screen.findByRole('region', { name: 'Game status' });
    expect(within(status).getByRole('heading', { name: 'Night' })).toBeTruthy();
    expect(within(status).getByText('1:30')).toBeTruthy();
    expect(within(status).queryByText('Waiting for host')).toBeNull();
    expect(screen.getByRole('button', { name: 'End the night' })).toBeTruthy();
    expect(await screen.findByText('Waiting for night to end')).toBeTruthy();
    expect(document.querySelector('[data-stage="night"]')).toBeTruthy();
  });

  it('reads the next phase when a timed night has already reached 0', async () => {
    let reads = 0;
    const expired = {
      ...gameStateFixture({ phase: 'NIGHT_SUBMIT', secondsLeft: -30 }),
      close: { next: null, resolves: 'NIGHT' as const },
    };
    const morning = gameStateFixture({ phase: 'DAY_ANNOUNCE' });
    renderApp(`/game/${GAME}`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        if (!new URL(request.url).pathname.endsWith('/state')) return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
        reads += 1;
        return json(200, reads === 1 ? expired : morning);
      }) as typeof fetch,
    });
    expect(await screen.findByRole('heading', { name: 'Morning' })).toBeTruthy();
    expect(document.querySelector('[data-stage="night-results"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue to day' })).toBeTruthy();
    expect(reads).toBeGreaterThanOrEqual(2);
  });

  it('names a dead seat and does not invent a role', async () => {
    renderApp(`/game/${GAME}`, { seat: host, fetchFn: stateFetch(gameStateFixture({ phase: 'DAY_DISCUSSION', dead: [3] })) });
    expect(await screen.findByRole('heading', { name: 'Day' })).toBeTruthy();
    expect(screen.getByText('Eliminated')).toBeTruthy();
    expect(screen.getAllByText('Alive').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-stage="day"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Villager');
  });

  it('says the game moved on when the close was stale', async () => {
    let reads = 0;
    renderApp(`/game/${GAME}`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (request.method === 'POST' && path.endsWith('/host/phase/close')) {
          return json(409, { error: { code: 'PHASE_CONFLICT', message: 'The game has moved on.' } });
        }
        if (path.endsWith('/state')) {
          reads += 1;
          return json(200, gameStateFixture({ phase: reads === 1 ? 'VOTING' : 'REVOTE' }));
        }
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'End the day' }));
    expect(await screen.findByText('The game moved on.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Revote' })).toBeTruthy();
  });

  it('keeps a cancelled game on the table without roles', async () => {
    renderApp(`/game/${GAME}`, { seat: host, fetchFn: stateFetch(gameStateFixture({ phase: 'CANCELLED' })) });
    const status = await screen.findByRole('region', { name: 'Game status' });
    expect(within(status).getByRole('heading', { name: 'Cancelled' })).toBeTruthy();
    expect(within(status).queryByText('Waiting for host')).toBeNull();
    expect(screen.getByRole('heading', { name: 'This game was cancelled' })).toBeTruthy();
    expect(screen.getByText('Roles stay hidden.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Play again' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Begin the night' })).toBeNull();
  });
});

describe('leaving role reveal', () => {
  it('moves both seats to the night when the host closes, and the guest has no close button', async () => {
    let phase: 'ROLE_REVEAL' | 'NIGHT_SUBMIT' = 'ROLE_REVEAL';
    const posts: unknown[] = [];
    const fetchFn = stateFetch(
      (request) => gameStateFixture({ phase, you: request.headers.get('Authorization')?.includes(guest.token) ? 4 : 1 }),
      (body) => {
        posts.push(body);
        phase = 'NIGHT_SUBMIT';
      },
    );
    const hostView = renderApp(`/game/${GAME}/reveal`, { seat: host, fetchFn });
    const guestView = renderApp(`/game/${GAME}/reveal`, { seat: guest, fetchFn });

    expect(await within(hostView.container).findByRole('button', { name: 'Begin the night' })).toBeTruthy();
    expect(await within(guestView.container).findByText('Waiting for host')).toBeTruthy();
    expect(within(guestView.container).queryByRole('button', { name: 'Begin the night' })).toBeNull();
    expect(within(hostView.container).getByRole('heading', { name: 'Villager' })).toBeTruthy();

    fireEvent.click(within(hostView.container).getByRole('button', { name: 'Begin the night' }));
    await waitFor(() => expect(hostView.router.state.location.pathname).toBe(`/game/${GAME}`));
    expect(await within(hostView.container).findByRole('heading', { name: 'Night' })).toBeTruthy();
    expect(posts).toEqual([{ stateVersion: 30 }]);

    await waitFor(() => expect(guestView.router.state.location.pathname).toBe(`/game/${GAME}`), { timeout: 5000 });
    expect(within(guestView.container).queryByRole('button', { name: 'Close night actions' })).toBeNull();
    expect(within(hostView.container).getByRole('heading', { name: 'Night' })).toBeTruthy();
    expect(posts).toHaveLength(1);
  });
});
