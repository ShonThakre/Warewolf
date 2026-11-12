import type { SeatCredentials } from '@warewolf/contracts';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { gameStateFixture } from '../../src/game/fixtures/phase';
import { hostDashboardFixture } from '../../src/game/fixtures/hostDashboard';
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
const guest: SeatCredentials = { ...host, playerId: fixturePlayerId(2), token: 'ww_token_for_tests_guest_0123456789', isHost: false };

function dashboardFetch(): typeof fetch {
  const dashboard = hostDashboardFixture();
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/host/dashboard')) return json(200, dashboard);
    if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'VOTING', roundNumber: 2 }));
    if (path.endsWith('/events')) return json(200, { events: [{ seq: 1, type: 'PHASE_CHANGED', audience: 'PUBLIC', payload: {} }] });
    return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }) as typeof fetch;
}

afterEach(cleanup);

describe('host dashboard screen', () => {
  it('sends an unseated visit home', async () => {
    const { router } = renderApp(`/game/${GAME}/host`);
    expect(await screen.findByRole('heading', { name: 'Werewolf' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });

  it('refuses a guest and does not request the dashboard', async () => {
    const calls: string[] = [];
    renderApp(`/game/${GAME}/host`, {
      seat: guest,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        calls.push(new URL(request.url).pathname);
        if (request.url.includes('/host/dashboard')) return json(500, { error: { code: 'NOT_HOST', message: 'Not the host.' } });
        if (new URL(request.url).pathname.endsWith('/state')) return json(200, gameStateFixture({ phase: 'VOTING', roundNumber: 2, you: 2 }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    expect(await screen.findByRole('heading', { name: 'Host dashboard' })).toBeTruthy();
    expect(screen.getByText('The host dashboard is only for the host.')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Dashboard sections' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Alpha Wolf|alpha_wolf|Pack/);
    expect(calls.some((path) => path.includes('/host/dashboard'))).toBe(false);
  });

  it('shows this round’s submissions, a failed infection, and the open ballot', async () => {
    renderApp(`/game/${GAME}/host`, { seat: host, fetchFn: dashboardFetch() });
    expect(await screen.findByRole('heading', { name: 'Host dashboard' })).toBeTruthy();
    expect(await screen.findByText('Round 2')).toBeTruthy();
    expect(screen.getByText('Voting')).toBeTruthy();
    expect(screen.getByText('Infections 1 of 4')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Night actions' }));
    expect(screen.getByRole('list', { name: 'Night actions' }).textContent).toMatch(/Kill/);
    expect(screen.getByRole('list', { name: 'Night actions' }).textContent).toMatch(/Pack/);

    fireEvent.click(screen.getByRole('button', { name: 'Infection history' }));
    expect(screen.getByText(/The target could not be infected/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Votes' }));
    expect(screen.getByRole('region', { name: 'Open vote' }).textContent).toContain('3');

    fireEvent.click(screen.getByRole('button', { name: 'Event log' }));
    expect(screen.getByText('The phase changed.')).toBeTruthy();

    expect(document.body.textContent).not.toMatch(/alpha_wolf|alpha_kill|WOLF_KILL|TARGET_INELIGIBLE|WOLF_PACK/);
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
