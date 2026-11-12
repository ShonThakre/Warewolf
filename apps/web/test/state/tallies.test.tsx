import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { DayTally, SeatCredentials } from '@warewolf/contracts';
import type { GamePhase } from '@warewolf/domain';
import { useState } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../src/app/store';
import { finishedResultsFixture } from '../../src/game/fixtures/results';
import { FIXTURE_GAME_ID, fixturePlayerId } from '../../src/game/fixtures/role';
import { talliesOfRound, tallyTotal, useDayTallies } from '../../src/game/state/tallies';
import { memorySessionStorage } from '../../src/session/storage';

/** WW-904: the public tally data layer (OD-85). */

const GAME = FIXTURE_GAME_ID;
const seat: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: fixturePlayerId(4), token: 'ww_token_for_tests_0123456789', isHost: false };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const first: DayTally = {
  roundNumber: 1,
  ballot: 1,
  counts: [
    { targetPlayerId: fixturePlayerId(7), total: 2 },
    { targetPlayerId: fixturePlayerId(9), total: 2 },
  ],
  abstentions: 1,
  votedOutPlayerId: null,
  tiedPlayerIds: [fixturePlayerId(7), fixturePlayerId(9)],
};
const revote: DayTally = { roundNumber: 1, ballot: 2, counts: [{ targetPlayerId: fixturePlayerId(9), total: 4 }], abstentions: 0, votedOutPlayerId: fixturePlayerId(9), tiedPlayerIds: [] };

function setup() {
  let served: DayTally[] = [first];
  const requests: Request[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request);
    return json({ tallies: served });
  }) as typeof fetch;
  const store = makeStore({ environment: { baseUrl: 'http://api.test/api/v1', fetchFn }, storage: memorySessionStorage(seat) });
  return { store, requests, serve: (next: DayTally[]) => (served = next) };
}

function Probe({ phase }: { phase: GamePhase }) {
  const [version, setVersion] = useState(1);
  const { tallies, latest } = useDayTallies(phase, version);
  return (
    <div>
      <p>
        count:{tallies.length} latest:{latest ? `${latest.ballot}:${latest.votedOutPlayerId ?? 'tie'}` : '-'}
      </p>
      <button type="button" onClick={() => setVersion((v) => v + 1)}>
        closed
      </button>
    </div>
  );
}

afterEach(cleanup);

describe('useDayTallies', () => {
  it('asks nothing in the lobby', async () => {
    const { store, requests } = setup();
    render(
      <Provider store={store}>
        <Probe phase="LOBBY" />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByText(/count:0 latest:-/)).toBeTruthy());
    expect(requests).toHaveLength(0);
  });

  it('loads the closed ballots and reads again when a ballot closes', async () => {
    const { store, requests, serve } = setup();
    render(
      <Provider store={store}>
        <Probe phase="REVOTE" />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByText(/count:1 latest:1:tie/)).toBeTruthy());
    expect(new URL(requests[0]!.url).pathname).toBe(`/api/v1/games/${GAME}/tallies`);
    serve([first, revote]);
    await act(async () => screen.getByRole('button', { name: 'closed' }).click());
    await waitFor(() => expect(screen.getByText(new RegExp(`count:2 latest:2:${fixturePlayerId(9)}`))).toBeTruthy());
  });
});

describe('tally helpers', () => {
  it('sums the weight cast and groups by round', () => {
    expect(tallyTotal(first)).toBe(4);
    expect(talliesOfRound([first, revote, { ...revote, roundNumber: 2, ballot: 1 }], 1)).toHaveLength(2);
  });

  it('puts the tally in the finished recap fixture without voter ids', () => {
    const recap = finishedResultsFixture();
    expect(recap.tallies).toHaveLength(1);
    expect(JSON.stringify(recap.tallies)).not.toMatch(/voter/i);
  });
});
