import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { gameResultsSchema, type SeatCredentials } from '@warewolf/contracts';
import type { GameStatus } from '@warewolf/domain';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../src/app/store';
import { cancelledResultsFixture, finishedResultsFixture } from '../../src/game/fixtures/results';
import { FIXTURE_GAME_ID, fixturePlayerId } from '../../src/game/fixtures/role';
import { converted, recapOrder, resultsHeadline, useResults } from '../../src/game/state/results';
import { memorySessionStorage } from '../../src/session/storage';

/** WW-903a: the recap data layer the results screen binds to. */

const GAME = FIXTURE_GAME_ID;
const seat: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: fixturePlayerId(4), token: 'ww_token_for_tests_0123456789', isHost: false };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(body: unknown) {
  const requests: Request[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request);
    return json(200, body);
  }) as typeof fetch;
  return { store: makeStore({ environment: { baseUrl: 'http://api.test/api/v1', fetchFn }, storage: memorySessionStorage(seat) }), requests };
}

function Probe({ status }: { status: GameStatus }) {
  const { finished, cancelled } = useResults(status);
  return (
    <p>
      finished:{finished ? finished.winningTeam : '-'} cancelled:{cancelled ? cancelled.cancelReason : '-'}
    </p>
  );
}

afterEach(cleanup);

describe('results fixtures', () => {
  it('match the contract', () => {
    for (const fixture of [finishedResultsFixture(), finishedResultsFixture({ winningTeam: 'VILLAGE' }), finishedResultsFixture({ draw: true }), cancelledResultsFixture('SURRENDER')]) {
      expect(gameResultsSchema.parse(fixture)).toEqual(fixture);
    }
  });

  it('keep the cancelled recap free of roles', () => {
    const text = JSON.stringify(cancelledResultsFixture());
    expect(text).not.toMatch(/RoleId|Faction|alpha_wolf|WOLF_PACK/);
  });
});

describe('recap helpers', () => {
  it('names the outcome, puts winners first, and spots a conversion', () => {
    const wolves = finishedResultsFixture();
    expect(resultsHeadline(wolves)).toEqual({ kind: 'TEAM', team: 'WOLF_PACK' });
    expect(resultsHeadline(finishedResultsFixture({ draw: true }))).toEqual({ kind: 'DRAW' });
    expect(resultsHeadline(finishedResultsFixture({ winningTeam: null }))).toEqual({ kind: 'INDIVIDUALS' });

    const ordered = recapOrder(wolves.seats);
    const firstLoser = ordered.findIndex((s) => !s.won);
    expect(ordered.slice(firstLoser).every((s) => !s.won)).toBe(true);
    const infected = wolves.seats.find((s) => s.playerId === wolves.infections[0]!.targetPlayerId)!;
    expect(converted(infected)).toBe(true);
    expect(infected).toMatchObject({ originalFaction: 'VILLAGE', finalRoleId: 'infected_wolf', won: true });
  });
});

describe('useResults', () => {
  it('does not ask while the game runs', async () => {
    const { store, requests } = setup(finishedResultsFixture());
    render(
      <Provider store={store}>
        <Probe status="ACTIVE" />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByText(/finished:- cancelled:-/)).toBeTruthy());
    expect(requests).toHaveLength(0);
  });

  it('loads a finished recap, and a cancelled one', async () => {
    const finished = setup(finishedResultsFixture());
    render(
      <Provider store={finished.store}>
        <Probe status="FINISHED" />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByText(/finished:WOLF_PACK cancelled:-/)).toBeTruthy());
    expect(new URL(finished.requests[0]!.url).pathname).toBe(`/api/v1/games/${GAME}/results`);
    cleanup();

    const cancelled = setup(cancelledResultsFixture('SURRENDER'));
    render(
      <Provider store={cancelled.store}>
        <Probe status="CANCELLED" />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByText(/finished:- cancelled:SURRENDER/)).toBeTruthy());
  });
});
