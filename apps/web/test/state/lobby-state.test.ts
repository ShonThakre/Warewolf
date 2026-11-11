import type { LobbyProjection, SeatCredentials } from '@warewolf/contracts';
import { describe, expect, it } from 'vitest';
import { api, apiErrorOf } from '../../src/api/api';
import { lobbyApi } from '../../src/api/lobby';
import { makeStore } from '../../src/app/store';
import { cleared, seated, selectCredentials } from '../../src/session/sessionSlice';
import { browserSessionStorage, memorySessionStorage } from '../../src/session/storage';

const BASE = 'http://api.test/api/v1';
const GAME = '0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31';
const HOST = '5c1d0e77-1a2b-4c3d-8e9f-001122334455';
const GUEST = '7d2e1f88-2b3c-4d5e-9f00-112233445566';

const credentials: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: HOST, token: 'ww_token_for_tests_0123456789', isHost: true };

function projection(overrides: Partial<LobbyProjection> = {}): LobbyProjection {
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
    you: { playerId: HOST, isHost: true },
    configuration: {
      valid: true,
      errorCount: 0,
      warningCount: 1,
      summary: { playerCount: 10, selectedSeats: 10, remainingSeats: 0, factions: { VILLAGE: 8, WOLF_PACK: 2, NEUTRAL: 0, INDEPENDENT: 0 }, startingPack: 2, wolfCap: 2, infectionSuccesses: null },
    },
    start: { ready: false, blockers: ['SEATS_OPEN'], requiresWarningAcknowledgement: true },
    ...overrides,
  };
}

type Route = (request: Request) => Response | Promise<Response>;
/** Lets onQueryStarted continuations run after a mutation's promise resolves. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const errorBody = (status: number, code: string, message = 'x') => json(status, { error: { code, message } });

/** A store whose fetch is answered by `route`. Requests are recorded. */
function setup(route: Route, initial: SeatCredentials | null = null) {
  const requests: Request[] = [];
  const storage = memorySessionStorage(initial);
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request.clone());
    return route(request);
  }) as typeof fetch;
  const store = makeStore({ environment: { baseUrl: BASE, fetchFn }, storage });
  return { store, storage, requests };
}

describe('session storage', () => {
  const fakeStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      map,
    } as unknown as Storage & { map: Map<string, string> };
  };

  it('round-trips credentials', () => {
    const backing = fakeStorage();
    const adapter = browserSessionStorage(() => backing);
    adapter.save(credentials);
    expect(adapter.load()).toEqual(credentials);
    adapter.save(null);
    expect(adapter.load()).toBeNull();
  });

  it('ignores unreadable or wrong-shaped data', () => {
    const backing = fakeStorage();
    const adapter = browserSessionStorage(() => backing);
    backing.map.set('warewolf.seat', '{not json');
    expect(adapter.load()).toBeNull();
    backing.map.set('warewolf.seat', JSON.stringify({ token: 1 }));
    expect(adapter.load()).toBeNull();
  });

  it('fails safe when storage throws', () => {
    const adapter = browserSessionStorage(() => {
      throw new Error('blocked');
    });
    expect(adapter.load()).toBeNull();
    expect(() => adapter.save(credentials)).not.toThrow();
  });
});

describe('store and session', () => {
  it('restores a saved seat and persists changes', () => {
    const { store, storage } = setup(() => json(200, {}), credentials);
    expect(selectCredentials(store.getState())).toEqual(credentials);
    store.dispatch(cleared());
    expect(storage.current).toBeNull();
    store.dispatch(seated(credentials));
    expect(storage.current).toEqual(credentials);
  });
});

describe('API client', () => {
  it('parses responses with the contract schema', async () => {
    const { store } = setup(() => json(200, { status: 'ok' }));
    const result = await store.dispatch(api.endpoints.getHealth.initiate());
    expect(result.data).toEqual({ status: 'ok' });
  });

  it('reports a response with the wrong shape instead of passing it to screens', async () => {
    const { store } = setup(() => json(200, { status: 'maybe' }));
    const result = await store.dispatch(api.endpoints.getHealth.initiate());
    expect(result.data).toBeUndefined();
    expect(apiErrorOf(result.error)?.code).toBe('BAD_RESPONSE');
  });

  it('reports network failures', async () => {
    const { store } = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    const result = await store.dispatch(api.endpoints.getHealth.initiate());
    expect(apiErrorOf(result.error)).toMatchObject({ status: 'NETWORK', code: 'NETWORK_ERROR' });
  });
});

describe('lobby endpoints', () => {
  it('create game posts the request and seats the caller', async () => {
    const { store, storage, requests } = setup(() => json(201, credentials));
    const result = await store.dispatch(lobbyApi.endpoints.createGame.initiate({ displayName: 'Asha', mode: 'CLASSIC' }));
    expect(result.data).toEqual(credentials);
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url).toBe(`${BASE}/games`);
    expect(await requests[0]?.json()).toEqual({ displayName: 'Asha', mode: 'CLASSIC' });
    expect(selectCredentials(store.getState())).toEqual(credentials);
    expect(storage.current).toEqual(credentials);
  });

  it('join errors carry the contract code and leave the session alone', async () => {
    const { store } = setup(() => errorBody(409, 'DISPLAY_NAME_TAKEN', 'That name is already taken in this room.'));
    const result = await store.dispatch(lobbyApi.endpoints.joinGame.initiate({ roomCode: 'K7QMPR', displayName: 'Asha' }));
    expect(apiErrorOf(result.error)).toEqual({ status: 409, code: 'DISPLAY_NAME_TAKEN', message: 'That name is already taken in this room.', issues: [] });
    expect(selectCredentials(store.getState())).toBeNull();
  });

  it('sends the seat token on member routes', async () => {
    const { store, requests } = setup(() => json(200, projection()), credentials);
    const result = await store.dispatch(lobbyApi.endpoints.getLobby.initiate(GAME));
    expect(result.data?.players).toHaveLength(2);
    expect(requests[0]?.headers.get('Authorization')).toBe(`Bearer ${credentials.token}`);
    expect(requests[0]?.url).toBe(`${BASE}/games/${GAME}`);
  });

  it('drops the session when the server rejects the token', async () => {
    const { store, storage } = setup(() => errorBody(401, 'UNAUTHENTICATED'), credentials);
    await store.dispatch(lobbyApi.endpoints.getLobby.initiate(GAME));
    expect(selectCredentials(store.getState())).toBeNull();
    expect(storage.current).toBeNull();
  });

  it('a kick stores the returned lobby without a refetch', async () => {
    const after = projection({ players: projection().players.slice(0, 1), stateVersion: 2 });
    const { store, requests } = setup((req) => (req.method === 'POST' ? json(200, after) : json(200, projection())), credentials);
    store.dispatch(lobbyApi.endpoints.getLobby.initiate(GAME));
    await store.dispatch(lobbyApi.endpoints.getLobby.initiate(GAME, { forceRefetch: true }));
    await store.dispatch(lobbyApi.endpoints.kickPlayer.initiate({ gameId: GAME, playerId: GUEST }));
    await tick();
    const cached = lobbyApi.endpoints.getLobby.select(GAME)(store.getState());
    expect(cached.data?.stateVersion).toBe(2);
    expect(cached.data?.players.map((p) => p.displayName)).toEqual(['Asha']);
    expect(requests.at(-1)?.url).toBe(`${BASE}/games/${GAME}/players/${GUEST}/kick`);
  });

  it('a host transfer updates the host flag in the session', async () => {
    const after = projection({ hostPlayerId: GUEST, you: { playerId: HOST, isHost: false } });
    const { store } = setup(() => json(200, after), credentials);
    await store.dispatch(lobbyApi.endpoints.transferHost.initiate({ gameId: GAME, playerId: GUEST }));
    await tick();
    expect(selectCredentials(store.getState())?.isHost).toBe(false);
  });

  it('changing avatar stores the returned lobby', async () => {
    const players = projection().players.map((p) => (p.playerId === HOST ? { ...p, avatarId: 20 } : p));
    const { store, requests } = setup(() => json(200, projection({ players, stateVersion: 4 })), credentials);
    await store.dispatch(lobbyApi.endpoints.changeAvatar.initiate({ gameId: GAME, avatarId: 20 }));
    await tick();
    expect(requests[0]?.method).toBe('PUT');
    expect(await requests[0]?.json()).toEqual({ avatarId: 20 });
    expect(lobbyApi.endpoints.getLobby.select(GAME)(store.getState()).data?.players[0]?.avatarId).toBe(20);
  });

  it('a taken avatar reports AVATAR_TAKEN', async () => {
    const { store } = setup(() => errorBody(409, 'AVATAR_TAKEN', 'That avatar is already taken.'), credentials);
    const result = await store.dispatch(lobbyApi.endpoints.changeAvatar.initiate({ gameId: GAME, avatarId: 1 }));
    expect(apiErrorOf(result.error)?.code).toBe('AVATAR_TAKEN');
  });

  it('leaving clears the session', async () => {
    const { store, storage } = setup(() => json(200, { gameCancelled: false }), credentials);
    const result = await store.dispatch(lobbyApi.endpoints.leaveGame.initiate({ gameId: GAME }));
    expect(result.data).toEqual({ gameCancelled: false });
    await tick();
    expect(storage.current).toBeNull();
  });
});
