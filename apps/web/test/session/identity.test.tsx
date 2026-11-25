import type { GameLog, LogEntry, SeatCredentials } from '@warewolf/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeStore } from '../../src/app/store';
import { lineText, logLine, matchesFilter } from '../../src/game/components/logCopy';
import { deviceKey, setDeviceKeyForTests } from '../../src/session/device';
import { cleared, revoked, selectCredentials } from '../../src/session/sessionSlice';
import { browserSessionStorage, memorySessionStorage, type SessionStorageAdapter } from '../../src/session/storage';
import { myActionsFixture } from '../../src/game/fixtures/actions';
import { gameStateFixture } from '../../src/game/fixtures/phase';
import { FIXTURE_GAME_ID, ROLE_FIXTURES, fixturePlayerId } from '../../src/game/fixtures/role';
import { json, renderApp } from '../render';

/** ID-01 (device identity, storage, rejoin) and LOG-02 (log copy and the log on screen). */

const GAME = '0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31';
const ME = '5c1d0e77-1a2b-4c3d-8e9f-001122334455';
const BEN = '7d2e1f88-2b3c-4d5e-9f00-112233445566';
const CAL = '9e3f2a99-3c4d-4e5f-8a01-223344556677';
const seat: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: ME, token: 'ww_token_for_tests_0123456789', isHost: false, rejoinCode: 'K7P4QX2M' };

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  } as unknown as Storage & { map: Map<string, string> };
}

describe('seat storage (ID-01)', () => {
  it('keeps the seat in localStorage and moves an old sessionStorage seat over once', () => {
    const local = fakeStorage();
    const session = fakeStorage();
    session.map.set('warewolf.seat', JSON.stringify(seat));
    const adapter = browserSessionStorage(() => local, () => session);
    expect(adapter.load()).toEqual(seat);
    expect(JSON.parse(local.map.get('warewolf.seat')!)).toEqual(seat);
    expect(session.map.has('warewolf.seat')).toBe(false);
  });

  it('a 401 adopts a newer seat another tab stored instead of wiping it', () => {
    const newer = { ...seat, token: 'ww_newer_token_from_other_tab_0123' };
    let stored: SeatCredentials | null = seat;
    const storage: SessionStorageAdapter = {
      load: () => stored,
      save: (next) => {
        stored = next;
      },
    };
    const store = makeStore({ environment: { baseUrl: 'http://api.test/api/v1', fetchFn: fetch }, storage });
    stored = newer; // another tab rejoined
    store.dispatch(cleared());
    expect(selectCredentials(store.getState())).toEqual(newer);
    expect(stored).toEqual(newer);
  });

  it('a 401 with nothing newer clears the stored seat', () => {
    const storage = memorySessionStorage(seat);
    const store = makeStore({ environment: { baseUrl: 'http://api.test/api/v1', fetchFn: fetch }, storage });
    store.dispatch(cleared());
    expect(storage.current).toBeNull();
  });

  it('the device key is stable and URL-safe', () => {
    setDeviceKeyForTests(null);
    const first = deviceKey();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deviceKey()).toBe(first);
  });
});

describe('rejoin and revocation screens (ID-01)', () => {
  it('Home rejoins a seat with the room and rejoin codes', async () => {
    const sent: unknown[] = [];
    const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const path = new URL(request.url).pathname;
      if (path.endsWith('/games/rejoin')) {
        sent.push(await request.json());
        return json(200, { ...seat, resumed: true });
      }
      return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }) as typeof fetch;
    const { router, store } = renderApp('/', { fetchFn });
    fireEvent.click(screen.getByRole('button', { name: /Have a rejoin code/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Rejoin your seat' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Room code' }), { target: { value: 'k7qmpr' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Rejoin code' }), { target: { value: 'k7p4qx2m' } });
    expect((within(dialog).getByRole('textbox', { name: 'Rejoin code' }) as HTMLInputElement).value).toBe('K7P4-QX2M');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rejoin' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/lobby/${GAME}`));
    expect(sent[0]).toMatchObject({ roomCode: 'K7QMPR', rejoinCode: 'K7P4QX2M', deviceKey: expect.any(String) });
    expect(selectCredentials(store.getState())?.playerId).toBe(ME);
  });

  it('a wrong code reads as one generic message', async () => {
    const fetchFn = (async () => json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } })) as typeof fetch;
    renderApp('/', { fetchFn });
    fireEvent.click(screen.getByRole('button', { name: /Have a rejoin code/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Rejoin your seat' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Room code' }), { target: { value: 'K7QMPR' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Rejoin code' }), { target: { value: 'AAAAAAAA' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rejoin' }));
    expect(await within(dialog).findByText(/We could not find that seat/)).toBeTruthy();
  });

  it('explains a seat opened on another device and returns home', async () => {
    const { store, router } = renderApp('/', { seat });
    store.dispatch(revoked('SEAT_RECLAIMED'));
    const dialog = await screen.findByRole('dialog', { name: 'Your seat moved to another device' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to home' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Your seat moved to another device' })).toBeNull());
    expect(router.state.location.pathname).toBe('/');
    expect(selectCredentials(store.getState())).toBeNull();
  });
});

const p = (playerId: string, displayName: string, seatNumber: number) => ({ playerId, displayName, seatNumber, avatarId: seatNumber });
const me = p(ME, 'Mira', 1);
const ben = p(BEN, 'Ben', 2);
const cal = p(CAL, 'Cal', 3);

function entry(over: Partial<LogEntry> & Pick<LogEntry, 'kind'>): LogEntry {
  return { id: `x${Math.random()}`, seq: 1, at: '2026-11-25T12:00:00.000Z', roundNumber: 1, stage: 'NIGHT', visibility: 'PUBLIC', actors: [], targets: [], detail: {}, ...over };
}

describe('log copy (LOG-02)', () => {
  it('says who killed whom only from revealed entries, with the team as a word', () => {
    const kill = entry({ kind: 'KILL', visibility: 'REVEALED', actors: [cal], targets: [ben], detail: { causes: ['WOLF_KILL'], roleId: 'seeker', faction: 'VILLAGE' } });
    expect(lineText(logLine(kill, ME))).toBe('Cal attacked Ben.');
    expect(logLine(kill, ME).detail).toBe('Ben was Seeker (Village).');
    const death = entry({ kind: 'NIGHT_DEATH', targets: [ben], detail: { roleId: null } });
    expect(lineText(logLine(death, ME))).toBe('Ben was found dead at dawn.');
    const dealt = entry({ kind: 'ROLE_DEALT', visibility: 'REVEALED', targets: [cal], detail: { roleId: 'alpha_wolf', faction: 'WOLF_PACK' } });
    expect(lineText(logLine(dealt, ME))).toMatch(/^Cal was .+ \(Wolf\)\.$/);
  });

  it('writes the table, votes, and the viewer’s own record', () => {
    expect(lineText(logLine(entry({ kind: 'PLAYER_KICKED', stage: 'LOBBY', actors: [me], targets: [ben] }), ME))).toBe('Mira removed Ben from the room.');
    expect(lineText(logLine(entry({ kind: 'SEAT_RECLAIMED', targets: [ben], detail: { via: 'CODE' } }), ME))).toBe('Ben rejoined from another device.');
    expect(lineText(logLine(entry({ kind: 'MY_VOTE', stage: 'DAY', visibility: 'PRIVATE', actors: [me], targets: [] }), ME))).toBe('You abstained.');
    const tally = logLine(entry({ kind: 'VOTE_TALLY', stage: 'DAY', targets: [cal], detail: { ballot: 1, counts: [{ player: cal, total: 3 }], abstentions: 1, tied: false } }), ME);
    expect(lineText(tally)).toBe('Vote: Cal received the most votes.');
    expect(tally.detail).toBe('Cal 3 · abstained 1');
  });

  it('filters by deaths, votes, players, and mine', () => {
    const death = entry({ kind: 'DAY_ELIMINATION', targets: [ben] });
    const join = entry({ kind: 'PLAYER_JOINED', targets: [cal] });
    const mine = entry({ kind: 'MY_ACTION', visibility: 'PRIVATE', actors: [me] });
    expect([death, join, mine].filter((e) => matchesFilter(e, 'deaths', ME))).toEqual([death]);
    expect([death, join, mine].filter((e) => matchesFilter(e, 'votes', ME))).toEqual([death]);
    expect([death, join, mine].filter((e) => matchesFilter(e, 'players', ME))).toEqual([join]);
    expect([death, join, mine].filter((e) => matchesFilter(e, 'mine', ME))).toEqual([mine]);
    const votedOut = entry({ kind: 'KILL', visibility: 'REVEALED', targets: [cal], detail: { byVote: true } });
    const shot = entry({ kind: 'KILL', visibility: 'REVEALED', targets: [cal], detail: { byVote: false, causes: ['SNIPER'] } });
    expect([votedOut, shot].filter((e) => matchesFilter(e, 'votes', ME))).toEqual([votedOut]);
  });
});

const LOG: GameLog = {
  status: 'ACTIVE',
  revealed: false,
  lastSeq: 9,
  lobby: [entry({ kind: 'PLAYER_JOINED', stage: 'LOBBY', roundNumber: 0, seq: 2, targets: [ben] })],
  rounds: [
    {
      roundNumber: 1,
      night: [entry({ kind: 'NIGHT_DEATH', seq: 5, targets: [ben], detail: { roleId: null } }), entry({ kind: 'MY_ACTION', seq: null, visibility: 'PRIVATE', actors: [me], targets: [cal], detail: { abilityId: 'x', status: 'RESOLVED' } })],
      day: [],
      summary: { deaths: 1, saves: 0 },
    },
    {
      roundNumber: 2,
      night: [entry({ kind: 'PEACEFUL_NIGHT', roundNumber: 2, seq: null })],
      day: [entry({ kind: 'PLAYER_DISCONNECTED', roundNumber: 2, stage: 'DAY', seq: 9, targets: [cal] })],
      summary: { deaths: 0, saves: 0 },
    },
  ],
  end: [],
};

describe('game log on the table (LOG-02)', () => {
  it('shows the newest round open, older rounds folded to a summary, and private entries labelled', async () => {
    const base = gameStateFixture({ phase: 'NIGHT_SUBMIT', roundNumber: 2 });
    const state = { ...base, players: base.players.map((x, i) => (i === 2 ? { ...x, connectionStatus: 'DISCONNECTED' as const } : { ...x, connectionStatus: 'CONNECTED' as const })) };
    const tableSeat: SeatCredentials = { gameId: FIXTURE_GAME_ID, roomCode: 'K7QMPR', playerId: fixturePlayerId(1), token: 'ww_token_for_tests_0123456789', isHost: false };
    const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const path = new URL(request.url).pathname;
      if (path.endsWith('/log')) return json(200, LOG);
      if (path.endsWith('/state')) return json(200, state);
      if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
      if (path.endsWith('/me/actions')) return json(200, myActionsFixture(ROLE_FIXTURES.villager));
      return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }) as typeof fetch;
    renderApp(`/game/${FIXTURE_GAME_ID}`, { seat: tableSeat, fetchFn });

    // Away is a word on the seat that has no connection.
    expect(await screen.findByText('Away')).toBeTruthy();
    const logTab = await screen.findByRole('tab', { name: /Log/ });
    fireEvent.click(logTab);
    const log = await screen.findByRole('log', { name: 'Game log' });
    const round2 = within(log).getByRole('button', { name: /Round 2/ });
    const round1 = within(log).getByRole('button', { name: /Round 1/ });
    expect(round2.getAttribute('aria-expanded')).toBe('true');
    expect(round1.getAttribute('aria-expanded')).toBe('false');
    expect(within(round1).getByText('1 eliminated')).toBeTruthy();
    expect(within(log).getByText('Nobody died in the night.')).toBeTruthy();
    fireEvent.click(round1);
    expect(within(log).getByText('Only you')).toBeTruthy();
    expect(within(log).queryByText('Revealed')).toBeNull();
    // The lobby group folds under "Before the game".
    expect(within(log).getByRole('button', { name: /Before the game/ })).toBeTruthy();
    // Filters
    fireEvent.click(screen.getByRole('button', { name: 'Players' }));
    expect(within(log).queryByText('Nobody died in the night.')).toBeNull();
    expect(within(log).getByText(/lost connection/)).toBeTruthy();
  });
});
