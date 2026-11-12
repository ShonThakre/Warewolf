import type { SeatCredentials } from '@warewolf/contracts';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { roleLabel } from '../../src/game/components/resultsCopy';
import { cancelledResultsFixture, finishedResultsFixture } from '../../src/game/fixtures/results';
import { gameStateFixture } from '../../src/game/fixtures/phase';
import { FIXTURE_GAME_ID, fixturePlayerId } from '../../src/game/fixtures/role';
import { json, renderApp } from '../render';

const GAME = FIXTURE_GAME_ID;
const host: SeatCredentials = {
  gameId: GAME,
  roomCode: 'K7QMPR',
  playerId: fixturePlayerId(1),
  token: 'ww_token_for_tests_0123456789',
  isHost: true,
};

function endedFetch(phase: 'FINISHED' | 'CANCELLED', results: unknown): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/results')) return json(200, results);
    if (path.endsWith('/state')) return json(200, gameStateFixture({ phase }));
    return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }) as typeof fetch;
}

afterEach(cleanup);

describe('results screen', () => {
  it('sends an unseated visit home', async () => {
    const { router } = renderApp(`/game/${GAME}/results`);
    expect(await screen.findByRole('heading', { name: 'Werewolf' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows original and final roles, and no ballot', async () => {
    const recap = finishedResultsFixture();
    const infected = recap.seats.find((seat) => seat.playerId === recap.infections[0]!.targetPlayerId)!;
    const source = recap.seats.find((seat) => seat.playerId === recap.infections[0]!.sourcePlayerId)!;
    renderApp(`/game/${GAME}/results`, { seat: host, fetchFn: endedFetch('FINISHED', recap) });

    expect(await screen.findByRole('heading', { name: 'Wolf wins' })).toBeTruthy();
    const stats = screen.getByRole('list', { name: 'Game stats' });
    expect(within(stats).getByText('Rounds')).toBeTruthy();
    expect(within(stats).getByText('Infections')).toBeTruthy();
    expect(within(stats).getByText('Eliminations')).toBeTruthy();
    expect(within(stats).getByText(String(recap.infections.length))).toBeTruthy();
    const rail = screen.getByRole('region', { name: 'Recap' });
    expect(within(rail).getByText(`Started as ${roleLabel(infected.originalRoleId)}. Ended as Infected Wolf.`)).toBeTruthy();
    expect(within(rail).getByText(`${source.displayName} infected ${infected.displayName} on night 1.`)).toBeTruthy();
    const named = recap.seats.find((seat) => seat.playerId === recap.tallies[0]?.votedOutPlayerId);
    expect(named).toBeTruthy();
    expect(within(rail).getByRole('region', { name: 'Vote' }).textContent).toContain(`${named!.displayName} was named.`);
    expect(within(rail).getByText('2 abstentions')).toBeTruthy();
    expect(within(rail).getAllByText('Wolf').length).toBeGreaterThan(0);
    expect(rail.textContent).not.toMatch(/alpha_wolf|infected_wolf|ballot/i);
    expect(screen.getByRole('link', { name: 'Play again' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull();
  });

  it('Play again clears the finished seat and goes home (GAP-04)', async () => {
    const view = renderApp(`/game/${GAME}/results`, { seat: host, fetchFn: endedFetch('FINISHED', finishedResultsFixture()) });
    fireEvent.click(await screen.findByRole('link', { name: 'Play again' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/'));
    expect(view.storage.load()).toBeNull();
    expect(screen.queryByText(/return to your seat/i)).toBeNull();
  });

  it('shows a draw without a team win', async () => {
    renderApp(`/game/${GAME}/results`, { seat: host, fetchFn: endedFetch('FINISHED', finishedResultsFixture({ draw: true })) });
    expect(await screen.findByRole('heading', { name: 'Draw' })).toBeTruthy();
    expect(screen.getAllByText(/The table drew/).length).toBeGreaterThan(0);
  });

  it('keeps a cancelled game free of roles', async () => {
    const recap = cancelledResultsFixture();
    renderApp(`/game/${GAME}/results`, { seat: host, fetchFn: endedFetch('CANCELLED', recap) });
    expect(await screen.findByRole('heading', { name: 'Cancelled' })).toBeTruthy();
    expect(screen.getAllByText(/The host cancelled the game/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Roles stay hidden/).length).toBeGreaterThan(0);
    const rail = screen.getByRole('region', { name: 'Recap' });
    expect(within(rail).getByText(recap.seats[0]!.displayName)).toBeTruthy();
    expect(rail.textContent).not.toMatch(/Alpha Wolf|Infected Wolf|Villager|Wolf|Village/);
    expect(document.body.textContent).not.toMatch(/alpha_wolf|WOLF_PACK/);
  });

  it('shows the server error and does not invent a winner', async () => {
    renderApp(`/game/${GAME}/results`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/results')) return json(404, { error: { code: 'NOT_FOUND', message: 'That game could not be found.' } });
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'FINISHED' }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    expect(await screen.findByText('That game could not be found.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Wolf wins' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  });

  it('sends a game that is still running back to the table', async () => {
    const { router } = renderApp(`/game/${GAME}/results`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'DAY_DISCUSSION' }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    expect(await screen.findByRole('heading', { name: 'Day' })).toBeTruthy();
    expect(router.state.location.pathname).toBe(`/game/${GAME}`);
  });
});
