import type { SeatCredentials } from '@warewolf/contracts';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { gameStateFixture } from '../../src/game/fixtures/phase';
import { hostDashboardFixture } from '../../src/game/fixtures/hostDashboard';
import { killTargetFixture } from '../../src/game/fixtures/killTarget';
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
    expect(await screen.findByText('Round number')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Voting')).toBeTruthy();
    expect(screen.getByText('1 of 4')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Night actions' }));
    const actions = screen.getByRole('region', { name: 'Submitted night actions' });
    expect(actions.textContent).toMatch(/Wolf kill/);
    expect(actions.textContent).toMatch(/Submitted|Resolved/);

    fireEvent.click(screen.getByRole('button', { name: 'Infection history' }));
    expect(screen.getByText(/The target could not be infected/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Votes' }));
    expect(screen.getByRole('region', { name: 'Open vote' }).textContent).toContain('3');

    fireEvent.click(screen.getByRole('button', { name: 'Event log' }));
    expect(screen.getByText('The phase changed.')).toBeTruthy();

    expect(document.body.textContent).not.toMatch(/alpha_wolf|alpha_kill|WOLF_KILL|TARGET_INELIGIBLE|WOLF_PACK/);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('offers Cancel game with a roles-hidden confirm, and Make host on living seats', async () => {
    renderApp(`/game/${GAME}/host`, { seat: host, fetchFn: dashboardFetch() });
    expect(await screen.findByRole('button', { name: 'Cancel game' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel game' }));
    const cancel = screen.getByRole('dialog', { name: 'Cancel this game?' });
    expect(cancel.textContent).toMatch(/Roles stay hidden/);
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cancel this game?' })).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Players and roles' }));
    expect(screen.getAllByRole('button', { name: /Make .+ the host/ }).length).toBeGreaterThan(0);
  });

  it('opens Night actions with the kill picker and Resolve night during host confirm', async () => {
    renderApp(`/game/${GAME}/host`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/host/dashboard')) return json(200, { ...hostDashboardFixture(), overview: { ...hostDashboardFixture().overview, phase: 'NIGHT_HOST_CONFIRM', roundNumber: 1 } });
        if (path.endsWith('/host/kill-target')) return json(200, killTargetFixture({ phase: 'NIGHT_HOST_CONFIRM', editable: true }));
        if (path.endsWith('/state')) {
          return json(200, { ...gameStateFixture({ phase: 'NIGHT_HOST_CONFIRM', roundNumber: 1 }), close: { next: null, resolves: 'NIGHT' } });
        }
        if (path.endsWith('/events')) return json(200, { events: [] });
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    expect(await screen.findByRole('heading', { level: 2, name: 'Night actions' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Submitted night actions' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Kill target' }).textContent).toMatch(/Choose a kill target/);
    expect(screen.getByRole('button', { name: 'No kill' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to game' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resolve night' })).toBeTruthy();
    expect(screen.getByText(/Consequence:/)).toBeTruthy();
  });
});
