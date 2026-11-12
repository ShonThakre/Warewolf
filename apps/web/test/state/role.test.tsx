import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { hostRosterSchema, myRoleSchema, type SeatCredentials } from '@warewolf/contracts';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { apiErrorOf } from '../../src/api/api';
import { gameApi } from '../../src/api/game';
import { lobbyApi } from '../../src/api/lobby';
import { makeStore } from '../../src/app/store';
import { FIXTURE_GAME_ID, ROLE_FIXTURES, hostRosterFixture, ownRoleFixture } from '../../src/game/fixtures/role';
import { gamePath, nightAbilitiesForRound, useHostRoster, useMyRole } from '../../src/game/state/role';
import { cleared } from '../../src/session/sessionSlice';
import { memorySessionStorage } from '../../src/session/storage';

const BASE = 'http://api.test/api/v1';
const GAME = FIXTURE_GAME_ID;
const host: SeatCredentials = {
  gameId: GAME,
  roomCode: 'K7QMPR',
  playerId: '00000000-0000-4000-8000-000000000001',
  token: 'ww_token_for_tests_0123456789',
  isHost: true,
};
const guest: SeatCredentials = { ...host, playerId: '00000000-0000-4000-8000-000000000004', isHost: false };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A store whose fetch is answered by path. Requests are recorded. */
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

const lobbyBody = {
  gameId: GAME,
  roomCode: 'K7QMPR',
  status: 'ACTIVE',
  phase: 'ROLE_REVEAL',
  mode: 'CLASSIC',
  rolePackId: 'classic-10',
  playerCount: 10,
  hostPlayerId: host.playerId,
  stateVersion: 12,
  players: [],
  you: { playerId: host.playerId, isHost: true },
  configuration: {
    valid: true,
    errorCount: 0,
    warningCount: 1,
    summary: { playerCount: 10, selectedSeats: 10, remainingSeats: 0, factions: { VILLAGE: 8, WOLF_PACK: 2, NEUTRAL: 0, INDEPENDENT: 0 }, startingPack: 2, wolfCap: 2, infectionSuccesses: null },
  },
  start: { ready: false, blockers: ['NOT_LOBBY'], requiresWarningAcknowledgement: true },
};

afterEach(cleanup);

describe('role fixtures', () => {
  it.each(Object.entries(ROLE_FIXTURES))('%s matches the GET /me contract', (_name, fixture) => {
    expect(myRoleSchema.parse(fixture)).toEqual(fixture);
  });

  it('the host roster matches its contract and deals Infection Edition', () => {
    const roster = hostRosterSchema.parse(hostRosterFixture());
    expect(roster.players).toHaveLength(20);
    expect(roster.players.filter((p) => p.originalRoleId === 'alpha_wolf')).toHaveLength(1);
    expect(roster.players.filter((p) => p.originalRoleId === 'normal_villager')).toHaveLength(14);
  });

  it('a conversion keeps the original role and grants the new role abilities', () => {
    const { infected } = ROLE_FIXTURES;
    expect(infected.originalRole.id).toBe('seeker');
    expect(infected.currentRole).toMatchObject({ id: 'infected_wolf', faction: 'WOLF_PACK' });
    expect(infected.abilities.map((a) => a.abilityId)).toEqual(['infected_kill']);
  });
});

describe('gamePath', () => {
  it.each([
    ['LOBBY', 'LOBBY', `/lobby/${GAME}`],
    ['ACTIVE', 'ROLE_REVEAL', `/game/${GAME}/reveal`],
    ['ACTIVE', 'NIGHT_SUBMIT', `/game/${GAME}`],
    ['ACTIVE', 'VOTING', `/game/${GAME}`],
    ['FINISHED', 'FINISHED', `/game/${GAME}/results`],
    ['CANCELLED', 'CANCELLED', `/game/${GAME}/results`],
  ] as const)('%s / %s goes to %s', (status, phase, path) => {
    expect(gamePath(GAME, status, phase)).toBe(path);
  });
});

describe('nightAbilitiesForRound', () => {
  const ids = (role: Parameters<typeof nightAbilitiesForRound>[0], round = 1) => nightAbilitiesForRound(role, round).map((a) => a.abilityId);

  it('is empty for a role with no night action', () => {
    expect(ids(ROLE_FIXTURES.villager)).toEqual([]);
  });

  it('keeps night abilities and leaves out day ones', () => {
    expect(ids(ROLE_FIXTURES.seeker)).toEqual(['seeker_investigate']);
    expect(ids(ROLE_FIXTURES.alphaWolf)).toEqual(['alpha_infect', 'alpha_kill']);
  });

  it('counts the reaction window as a night action', () => {
    expect(ids(ROLE_FIXTURES.doctor)).toEqual(['doctor_save']);
  });

  it('leaves out spent and not-yet-available abilities', () => {
    expect(ids(ROLE_FIXTURES.witchPoisonUsed)).toEqual(['witch_save']);
    expect(ids(ROLE_FIXTURES.infected, 1)).toEqual([]);
    expect(ids(ROLE_FIXTURES.infected, 2)).toEqual(['infected_kill']);
  });

  it('honours a single allowed round and an expiry', () => {
    const once = ownRoleFixture('seeker', { abilities: { seeker_investigate: { onlyRound: 1 } } });
    expect(ids(once, 1)).toEqual(['seeker_investigate']);
    expect(ids(once, 2)).toEqual([]);
    const copied = ownRoleFixture('seeker', { abilities: { seeker_investigate: { expiresRound: 2 } } });
    expect(ids(copied, 2)).toEqual(['seeker_investigate']);
    expect(ids(copied, 3)).toEqual([]);
  });
});

describe('start', () => {
  it('posts only the acknowledgement, then refreshes the lobby', async () => {
    const { store, requests } = setup(host, {
      [`GET games/${GAME}`]: () => json(200, lobbyBody),
      [`POST games/${GAME}/start`]: () => json(200, { gameId: GAME, status: 'ACTIVE', phase: 'ROLE_REVEAL', roundNumber: 1, stateVersion: 12 }),
    });
    store.dispatch(lobbyApi.endpoints.getLobby.initiate(GAME));
    await tick();

    const result = await store.dispatch(gameApi.endpoints.startGame.initiate({ gameId: GAME, acknowledgeWarnings: true }));
    expect(result.data).toEqual({ gameId: GAME, status: 'ACTIVE', phase: 'ROLE_REVEAL', roundNumber: 1, stateVersion: 12 });
    const post = requests.find((r) => r.method === 'POST')!;
    expect(await post.json()).toEqual({ acknowledgeWarnings: true });
    expect(post.headers.get('Authorization')).toBe(`Bearer ${host.token}`);

    await tick();
    expect(requests.filter((r) => r.method === 'GET' && r.url.endsWith(`/games/${GAME}`))).toHaveLength(2);
  });

  it('reports a refusal by its contract code', async () => {
    const { store } = setup(host, {
      [`POST games/${GAME}/start`]: () => json(422, { error: { code: 'WARNINGS_UNACKNOWLEDGED', message: 'Review and accept the setup warnings to start.' } }),
    });
    const result = await store.dispatch(gameApi.endpoints.startGame.initiate({ gameId: GAME }));
    expect(apiErrorOf(result.error)?.code).toBe('WARNINGS_UNACKNOWLEDGED');
  });
});

function RoleProbe() {
  const { role, error } = useMyRole();
  const { roster } = useHostRoster();
  return (
    <p>
      role:{role?.currentRole.id ?? '-'} roster:{roster?.players.length ?? '-'} error:{error?.code ?? '-'}
    </p>
  );
}

function renderProbe(store: ReturnType<typeof makeStore>) {
  render(
    <Provider store={store}>
      <RoleProbe />
    </Provider>,
  );
}

describe('role hooks', () => {
  it('load the guest own role and never ask for the roster', async () => {
    const { store, requests } = setup(guest, { [`GET games/${GAME}/me`]: () => json(200, ROLE_FIXTURES.seeker) });
    renderProbe(store);
    expect(await screen.findByText('role:seeker roster:- error:-')).toBeTruthy();
    expect(requests.map((r) => new URL(r.url).pathname)).toEqual([`/api/v1/games/${GAME}/me`]);
  });

  it('load the roster for the host', async () => {
    const { store } = setup(host, {
      [`GET games/${GAME}/me`]: () => json(200, ownRoleFixture('normal_villager', { seat: 1 })),
      [`GET games/${GAME}/host/roster`]: () => json(200, hostRosterFixture()),
    });
    renderProbe(store);
    expect(await screen.findByText('role:normal_villager roster:20 error:-')).toBeTruthy();
  });

  it('report PHASE_CONFLICT before the deal', async () => {
    const { store } = setup(guest, { [`GET games/${GAME}/me`]: () => json(409, { error: { code: 'PHASE_CONFLICT', message: 'That is not possible right now.' } }) });
    renderProbe(store);
    expect(await screen.findByText('role:- roster:- error:PHASE_CONFLICT')).toBeTruthy();
  });

  it('drop the private role from memory once the seat is cleared', async () => {
    const { store } = setup(guest, { [`GET games/${GAME}/me`]: () => json(200, ROLE_FIXTURES.seeker) });
    renderProbe(store);
    await screen.findByText(/role:seeker/);
    expect(gameApi.endpoints.getMyRole.select(GAME)(store.getState()).data?.currentRole.id).toBe('seeker');

    act(() => {
      store.dispatch(cleared());
    });
    expect(await screen.findByText(/role:-/)).toBeTruthy();
    // RTK removes the entry on its own timer after the hook unsubscribes, so wait for it rather than guess a delay.
    await waitFor(() => expect(gameApi.endpoints.getMyRole.select(GAME)(store.getState()).data).toBeUndefined());
    expect(JSON.stringify(store.getState().api.queries)).not.toContain('seeker');
  });
});
