import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { hostDashboardSchema, type SeatCredentials } from '@warewolf/contracts';
import type { GamePhase } from '@warewolf/domain';
import { useState } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../src/app/store';
import { hostDashboardFixture } from '../../src/game/fixtures/hostDashboard';
import { FIXTURE_GAME_ID, fixturePlayerId } from '../../src/game/fixtures/role';
import { dashboardSeat, openBallot, useHostDashboard, wolfSubmissions } from '../../src/game/state/hostDashboard';
import { memorySessionStorage } from '../../src/session/storage';

/** WW-1202a: the host dashboard data layer. */

const GAME = FIXTURE_GAME_ID;
const host: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: fixturePlayerId(1), token: 'ww_token_for_tests_0123456789', isHost: true };
const guest: SeatCredentials = { ...host, playerId: fixturePlayerId(4), isHost: false };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(seat: SeatCredentials) {
  const requests: Request[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request);
    return json(200, hostDashboardFixture());
  }) as typeof fetch;
  return { store: makeStore({ environment: { baseUrl: 'http://api.test/api/v1', fetchFn }, storage: memorySessionStorage(seat) }), requests };
}

function Probe({ initial }: { initial: GamePhase }) {
  const [version, setVersion] = useState(1);
  const { dashboard } = useHostDashboard(initial, version);
  return (
    <div>
      <p>round:{dashboard ? dashboard.overview.roundNumber : '-'}</p>
      <button type="button" onClick={() => setVersion((v) => v + 1)}>
        bump
      </button>
    </div>
  );
}

afterEach(cleanup);

describe('host dashboard fixture and helpers', () => {
  it('matches the contract', () => {
    expect(hostDashboardSchema.parse(hostDashboardFixture())).toEqual(hostDashboardFixture());
  });

  it('finds the open ballot, the wolves’ submissions, and a seat by id', () => {
    const dashboard = hostDashboardFixture();
    expect(openBallot(dashboard)).toMatchObject({ roundNumber: 2, open: true });
    const wolves = wolfSubmissions(dashboard);
    expect(wolves).toHaveLength(1);
    expect(dashboardSeat(dashboard, wolves[0]!.playerId)?.originalRoleId).toBe('alpha_wolf');
    expect(dashboardSeat(dashboard, null)).toBeNull();
  });
});

describe('useHostDashboard', () => {
  it('never asks for a guest or in the lobby', async () => {
    const asGuest = setup(guest);
    render(
      <Provider store={asGuest.store}>
        <Probe initial="VOTING" />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByText('round:-')).toBeTruthy());
    cleanup();
    const inLobby = setup(host);
    render(
      <Provider store={inLobby.store}>
        <Probe initial="LOBBY" />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByText('round:-')).toBeTruthy());
    expect(asGuest.requests).toHaveLength(0);
    expect(inLobby.requests).toHaveLength(0);
  });

  it('loads for the host and reads again on a new state version', async () => {
    const { store, requests } = setup(host);
    render(
      <Provider store={store}>
        <Probe initial="DAY_DISCUSSION" />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByText('round:2')).toBeTruthy());
    expect(new URL(requests[0]!.url).pathname).toBe(`/api/v1/games/${GAME}/host/dashboard`);
    const before = requests.length;
    await act(async () => screen.getByRole('button', { name: 'bump' }).click());
    await waitFor(() => expect(requests.length).toBeGreaterThan(before));
  });
});
