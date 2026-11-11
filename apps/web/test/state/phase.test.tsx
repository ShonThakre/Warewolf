import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { gameStateSchema, type GameState, type SeatCredentials } from '@warewolf/contracts';
import { GAME_PHASES } from '@warewolf/domain';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gameApi } from '../../src/api/game';
import { makeStore } from '../../src/app/store';
import { FIXTURE_SERVER_NOW, gameStateFixture } from '../../src/game/fixtures/phase';
import { FIXTURE_GAME_ID, fixturePlayerId } from '../../src/game/fixtures/role';
import { GAME_STATE_POLL_MS, clockOffset, secondsLeft, useClosePhase, useGameState, useSecondsLeft } from '../../src/game/state/phase';
import { memorySessionStorage } from '../../src/session/storage';

const BASE = 'http://api.test/api/v1';
const GAME = FIXTURE_GAME_ID;
const host: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: fixturePlayerId(1), token: 'ww_token_for_tests_0123456789', isHost: true };
const guest: SeatCredentials = { ...host, playerId: fixturePlayerId(4), isHost: false };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(seat: SeatCredentials | null, routes: Record<string, () => Response>) {
  const requests: Request[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request.clone());
    const path = new URL(request.url).pathname.replace('/api/v1/', '');
    const route = routes[`${request.method} ${path}`];
    return route ? route() : json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }) as typeof fetch;
  const store = makeStore({ environment: { baseUrl: BASE, fetchFn }, storage: memorySessionStorage(seat) });
  return { store, requests };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('game state fixtures', () => {
  it.each(GAME_PHASES)('%s matches the GET /state contract', (phase) => {
    const fixture = gameStateFixture({ phase });
    expect(gameStateSchema.parse(fixture)).toEqual(fixture);
  });

  it('can be timed, and marks dead seats', () => {
    const fixture = gameStateFixture({ secondsLeft: 90, dead: [3], you: 3 });
    expect(fixture).toMatchObject({ pacing: 'TIMED', phaseEndsAt: '2026-11-11T20:01:30.000Z', you: { lifeStatus: 'DEAD', isHost: false } });
  });
});

describe('secondsLeft', () => {
  const server = Date.parse(FIXTURE_SERVER_NOW);
  const endsAt = new Date(server + 90_000).toISOString();

  it('is null for a phase without a deadline', () => {
    expect(secondsLeft(null, 0, server)).toBeNull();
  });

  it('counts down on the server clock, whatever the device clock says', () => {
    const deviceAtReceipt = server - 3_600_000; // The device clock is an hour slow.
    const offset = clockOffset(FIXTURE_SERVER_NOW, deviceAtReceipt);
    expect(offset).toBe(3_600_000);
    expect(secondsLeft(endsAt, offset, deviceAtReceipt)).toBe(90);
    expect(secondsLeft(endsAt, offset, deviceAtReceipt + 30_500)).toBe(60);
  });

  it('rounds up and stops at 0', () => {
    expect(secondsLeft(endsAt, 0, server + 89_001)).toBe(1);
    expect(secondsLeft(endsAt, 0, server + 90_000)).toBe(0);
    expect(secondsLeft(endsAt, 0, server + 200_000)).toBe(0);
  });
});

function StateProbe() {
  const view = useGameState();
  const seconds = useSecondsLeft(view);
  const control = useClosePhase(view.state);
  return (
    <div>
      <p>
        phase:{view.state?.phase ?? '-'} round:{view.state?.roundNumber ?? '-'} seconds:{seconds ?? '-'} canClose:{String(control.canClose)} next:
        {control.close?.next ?? control.close?.resolves ?? '-'} error:{control.error?.code ?? '-'}
      </p>
      <button type="button" onClick={() => void control.closePhase()}>
        close
      </button>
    </div>
  );
}

function renderProbe(store: ReturnType<typeof makeStore>) {
  render(
    <Provider store={store}>
      <StateProbe />
    </Provider>,
  );
}

describe('useGameState and useClosePhase', () => {
  it('reads nothing without a seat', async () => {
    const { store, requests } = setup(null, {});
    renderProbe(store);
    await tick();
    expect(screen.getByText(/phase:- round:- seconds:- canClose:false/)).toBeTruthy();
    expect(requests).toHaveLength(0);
  });

  it('lets the host close the phase, sending the version on screen', async () => {
    let current: GameState = gameStateFixture({ phase: 'NIGHT_SUBMIT' });
    const { store, requests } = setup(host, {
      [`GET games/${GAME}/state`]: () => json(200, current),
      [`POST games/${GAME}/host/phase/close`]: () => {
        current = { ...gameStateFixture({ phase: 'NIGHT_HOST_CONFIRM' }), stateVersion: 31 };
        return json(200, current);
      },
    });
    renderProbe(store);
    await waitFor(() => expect(screen.getByText(/phase:NIGHT_SUBMIT round:1 seconds:- canClose:true next:NIGHT_HOST_CONFIRM/)).toBeTruthy());

    await act(async () => screen.getByRole('button', { name: 'close' }).click());
    await waitFor(() => expect(screen.getByText(/phase:NIGHT_HOST_CONFIRM/)).toBeTruthy());

    const post = requests.find((r) => r.method === 'POST')!;
    expect(await post.json()).toEqual({ stateVersion: 30 });
    expect(post.headers.get('Authorization')).toBe(`Bearer ${host.token}`);
  });

  it('does not offer the close to a guest', async () => {
    const { store, requests } = setup(guest, {
      [`GET games/${GAME}/state`]: () => json(200, gameStateFixture({ phase: 'DAY_DISCUSSION', you: 4 })),
    });
    renderProbe(store);
    await waitFor(() => expect(screen.getByText(/phase:DAY_DISCUSSION .* canClose:false next:-/)).toBeTruthy());
    await act(async () => screen.getByRole('button', { name: 'close' }).click());
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0);
  });

  it('reports a stale close and refetches the state', async () => {
    let gets = 0;
    const { store } = setup(host, {
      [`GET games/${GAME}/state`]: () => {
        gets++;
        return json(200, gets === 1 ? gameStateFixture({ phase: 'VOTING' }) : gameStateFixture({ phase: 'REVOTE' }));
      },
      [`POST games/${GAME}/host/phase/close`]: () => json(409, { error: { code: 'PHASE_CONFLICT', message: 'The game has moved on.' } }),
    });
    renderProbe(store);
    await waitFor(() => expect(screen.getByText(/phase:VOTING/)).toBeTruthy());
    await act(async () => screen.getByRole('button', { name: 'close' }).click());
    await waitFor(() => expect(screen.getByText(/phase:REVOTE .* error:PHASE_CONFLICT/)).toBeTruthy());
  });

  it('counts down a timed phase', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(FIXTURE_SERVER_NOW));
    const { store } = setup(host, {
      [`GET games/${GAME}/state`]: () => json(200, gameStateFixture({ phase: 'NIGHT_SUBMIT', secondsLeft: 90 })),
    });
    renderProbe(store);
    await waitFor(() => expect(screen.getByText(/seconds:90 /)).toBeTruthy());
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText(/seconds:60 /)).toBeTruthy();
  });

  it('polls while the game runs and stops once it is over', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    let gets = 0;
    const { store } = setup(host, {
      [`GET games/${GAME}/state`]: () => {
        gets++;
        return json(200, gameStateFixture({ phase: gets < 3 ? 'VOTING' : 'FINISHED' }));
      },
    });
    renderProbe(store);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(gets).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAME_STATE_POLL_MS * 2);
    });
    expect(gets).toBe(3);
    expect(gameApi.endpoints.getGameState.select(GAME)(store.getState()).data?.status).toBe('FINISHED');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAME_STATE_POLL_MS * 5);
    });
    expect(gets).toBe(3);
    expect(screen.getByText(/phase:FINISHED .* canClose:false/)).toBeTruthy();
  });
});
