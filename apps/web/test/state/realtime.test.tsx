import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { SeatCredentials } from '@warewolf/contracts';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../src/app/store';
import { gameStateFixture } from '../../src/game/fixtures/phase';
import { FIXTURE_GAME_ID, fixturePlayerId } from '../../src/game/fixtures/role';
import { ROLE_FIXTURES } from '../../src/game/fixtures/role';
import { useGameState } from '../../src/game/state/phase';
import { useMyRole } from '../../src/game/state/role';
import { setPlayConnectorForTests, type PlayClient } from '../../src/realtime/play';
import { memorySessionStorage } from '../../src/session/storage';

const BASE = 'http://api.test/api/v1';
const GAME = FIXTURE_GAME_ID;
const host: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: fixturePlayerId(1), token: 'ww_token_for_tests_0123456789', isHost: true };
const guest: SeatCredentials = { ...host, playerId: fixturePlayerId(4), token: 'ww_token_for_tests_guest_0123456789', isHost: false };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

class FakePlay implements PlayClient {
  private readonly handlers = new Map<string, ((body: unknown) => void)[]>();
  readonly sent: { event: string; body: unknown }[] = [];
  readonly registered: string[] = [];

  on(event: string, handler: (body: unknown) => void): void {
    this.registered.push(event);
    this.handlers.set(event, [handler]);
  }

  emit(event: string, body: unknown): void {
    this.sent.push({ event, body });
  }

  close(): void {}

  fire(event: string, body: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) handler(body);
  }
}

function setup(seat: SeatCredentials) {
  let phase: 'NIGHT_SUBMIT' | 'DAY_ANNOUNCE' = 'NIGHT_SUBMIT';
  const requests: Request[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request.clone());
    return json(200, gameStateFixture({ phase, you: seat.isHost ? 1 : 4 }));
  }) as typeof fetch;
  const store = makeStore({ environment: { baseUrl: BASE, fetchFn }, storage: memorySessionStorage(seat) });
  return {
    store,
    requests,
    moveToDay() {
      phase = 'DAY_ANNOUNCE';
    },
  };
}

function Probe() {
  const { state } = useGameState();
  return <p>phase:{state?.phase ?? '-'}</p>;
}

afterEach(() => {
  cleanup();
  setPlayConnectorForTests(null);
});

describe('phase events (WW-1103)', () => {
  it('refetches the state for the host and a guest when the phase signal arrives', async () => {
    const hostPlay = new FakePlay();
    const guestPlay = new FakePlay();
    const byToken = new Map<string, FakePlay>([
      [host.token, hostPlay],
      [guest.token, guestPlay],
    ]);
    setPlayConnectorForTests((token) => byToken.get(token) ?? new FakePlay());

    const hostSide = setup(host);
    const guestSide = setup(guest);
    render(
      <Provider store={hostSide.store}>
        <Probe />
      </Provider>,
    );
    render(
      <Provider store={guestSide.store}>
        <Probe />
      </Provider>,
    );
    await waitFor(() => expect(screen.getAllByText('phase:NIGHT_SUBMIT')).toHaveLength(2));

    hostPlay.fire('connect', {});
    guestPlay.fire('connect', {});
    expect([...hostPlay.registered].sort()).toEqual(['PHASE_CHANGED', 'connect']);
    expect(hostPlay.sent).toEqual([{ event: 'join-session', body: { gameId: GAME, afterSeq: 0 } }]);
    expect(guestPlay.sent).toEqual([{ event: 'join-session', body: { gameId: GAME, afterSeq: 0 } }]);

    hostSide.moveToDay();
    guestSide.moveToDay();
    const signal = { seq: 4, type: 'PHASE_CHANGED', audience: 'PUBLIC', payload: { phase: 'DAY_ANNOUNCE', roundNumber: 1, stateVersion: 8 } };
    act(() => {
      hostPlay.fire('PHASE_CHANGED', signal);
      guestPlay.fire('PHASE_CHANGED', signal);
    });
    await waitFor(() => expect(screen.getAllByText('phase:DAY_ANNOUNCE')).toHaveLength(2));

    hostPlay.fire('connect', {});
    expect(hostPlay.sent[1]).toEqual({ event: 'join-session', body: { gameId: GAME, afterSeq: 4 } });
  });
});

/** GET /me answers the dealt Seeker until `infect()` flips it to the converted fixture. */
function roleSetup(seat: SeatCredentials) {
  let infected = false;
  const requests: string[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(new URL(request.url).pathname);
    return json(200, infected ? ROLE_FIXTURES.infected : ROLE_FIXTURES.seeker);
  }) as typeof fetch;
  const store = makeStore({ environment: { baseUrl: BASE, fetchFn }, storage: memorySessionStorage(seat) });
  return {
    store,
    requests,
    infect() {
      infected = true;
    },
  };
}

function RoleProbe({ version }: { version: number }) {
  const { role } = useMyRole(version);
  return <p>role:{role?.currentRole.id ?? '-'}</p>;
}

describe('own role refresh (PLAY-FIX-01)', () => {
  it('reads the role again when the phase moves, so an infected seat sees its new card', async () => {
    setPlayConnectorForTests(() => new FakePlay());
    const side = roleSetup(guest);
    const view = render(
      <Provider store={side.store}>
        <RoleProbe version={1} />
      </Provider>,
    );
    expect(await screen.findByText('role:seeker')).toBeTruthy();

    side.infect();
    view.rerender(
      <Provider store={side.store}>
        <RoleProbe version={2} />
      </Provider>,
    );
    expect(await screen.findByText('role:infected_wolf')).toBeTruthy();
  });

  it('reads the role again when the seat is told it was converted', async () => {
    const play = new FakePlay();
    setPlayConnectorForTests(() => play);
    const side = roleSetup(guest);
    render(
      <Provider store={side.store}>
        <RoleProbe version={1} />
      </Provider>,
    );
    expect(await screen.findByText('role:seeker')).toBeTruthy();
    expect(play.registered).toEqual(expect.arrayContaining(['ROLE_CONVERTED', 'INFECTION_OCCURRED']));

    side.infect();
    act(() => {
      play.fire('ROLE_CONVERTED', { seq: 9, type: 'ROLE_CONVERTED', audience: 'PLAYER', payload: { roundNumber: 1, roleId: 'infected_wolf' } });
    });
    expect(await screen.findByText('role:infected_wolf')).toBeTruthy();
  });
});
