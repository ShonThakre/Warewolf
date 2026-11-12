import type { GameState, SeatCredentials } from '@warewolf/contracts';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { myActionsFixture } from '../../src/game/fixtures/actions';
import { chatMessageFixture, chatViewFixture } from '../../src/game/fixtures/chat';
import { killTargetFixture } from '../../src/game/fixtures/killTarget';
import { cancelledResultsFixture, finishedResultsFixture } from '../../src/game/fixtures/results';
import { FIXTURE_SERVER_NOW, gameStateFixture } from '../../src/game/fixtures/phase';
import { FIXTURE_GAME_ID, ROLE_FIXTURES, fixturePlayerId } from '../../src/game/fixtures/role';
import { json, renderApp } from '../render';

const GAME = FIXTURE_GAME_ID;
const host: SeatCredentials = {
  gameId: GAME,
  roomCode: 'K7QMPR',
  playerId: fixturePlayerId(1),
  token: 'ww_token_for_tests_0123456789',
  isHost: true,
};
const guest: SeatCredentials = {
  ...host,
  playerId: fixturePlayerId(4),
  token: 'ww_guest_token_for_tests_012345',
  isHost: false,
};

function stateFetch(body: GameState | ((request: Request) => GameState), onPost?: (body: unknown) => void): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
    if (request.method === 'POST' && path.endsWith('/host/phase/close')) {
      onPost?.(await request.json());
      return json(200, typeof body === 'function' ? body(request) : body);
    }
    if (path.endsWith('/state')) return json(200, typeof body === 'function' ? body(request) : body);
    return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }) as typeof fetch;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('table', () => {
  it('sends an unseated visit home', async () => {
    const { router } = renderApp(`/game/${GAME}`);
    expect(await screen.findByRole('heading', { name: 'Werewolf' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows the phase, the round, and a host button, and hides that button from a guest', async () => {
    const reveal = (request: Request) => gameStateFixture({ phase: 'ROLE_REVEAL', you: request.headers.get('Authorization')?.includes(guest.token) ? 4 : 1 });
    const { container: hostRoot } = renderApp(`/game/${GAME}`, { seat: host, fetchFn: stateFetch(reveal) });
    const { container: guestRoot } = renderApp(`/game/${GAME}`, { seat: guest, fetchFn: stateFetch(reveal) });

    const hostStatus = await within(hostRoot).findByRole('region', { name: 'Game status' });
    expect(within(hostStatus).getByRole('heading', { name: 'Role reveal' })).toBeTruthy();
    expect(within(hostStatus).getByText('Round 1')).toBeTruthy();
    expect(within(hostStatus).getByText('Waiting for host')).toBeTruthy();
    expect(hostRoot.querySelector('[data-stage="reveal"]')).toBeTruthy();
    expect(within(hostRoot).getByRole('button', { name: 'Begin the night' })).toBeTruthy();

    const guestStatus = await within(guestRoot).findByRole('region', { name: 'Game status' });
    expect(within(guestStatus).getByText('Waiting for host')).toBeTruthy();
    expect(within(guestRoot).queryByRole('button', { name: 'Begin the night' })).toBeNull();
    expect(within(guestRoot).getByRole('region', { name: 'Actions' }).textContent).toContain('Waiting for host');
    expect(guestRoot.textContent).not.toContain('NIGHT_SUBMIT');
    expect(guestRoot.textContent).not.toContain('alpha_wolf');
  });

  it('shows a Classic night as a clock and a Resolve night button', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(FIXTURE_SERVER_NOW));
    const classic = {
      ...gameStateFixture({ phase: 'NIGHT_SUBMIT', secondsLeft: 90 }),
      close: { next: null, resolves: 'NIGHT' as const },
    };
    renderApp(`/game/${GAME}`, { seat: host, fetchFn: stateFetch(classic) });
    const status = await screen.findByRole('region', { name: 'Game status' });
    expect(within(status).getByRole('heading', { name: 'Night' })).toBeTruthy();
    expect(within(status).getByText('1:30')).toBeTruthy();
    expect(within(status).queryByText('Waiting for host')).toBeNull();
    expect(screen.getByRole('button', { name: 'Resolve night' })).toBeTruthy();
    expect(await screen.findByText('Waiting for night to end')).toBeTruthy();
    expect(document.querySelector('[data-stage="night"]')).toBeTruthy();
  });

  it('reads the next phase when a timed night has already reached 0', async () => {
    let reads = 0;
    const expired = {
      ...gameStateFixture({ phase: 'NIGHT_SUBMIT', secondsLeft: -30 }),
      close: { next: null, resolves: 'NIGHT' as const },
    };
    const morning = gameStateFixture({ phase: 'DAY_ANNOUNCE' });
    renderApp(`/game/${GAME}`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        if (!new URL(request.url).pathname.endsWith('/state')) return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
        reads += 1;
        return json(200, reads === 1 ? expired : morning);
      }) as typeof fetch,
    });
    expect(await screen.findByRole('heading', { name: 'Morning' })).toBeTruthy();
    expect(document.querySelector('[data-stage="night-results"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue to day' })).toBeTruthy();
    expect(reads).toBeGreaterThanOrEqual(2);
  });

  it('shows the morning card, survivors, and a locked discussion rail', async () => {
    renderApp(`/game/${GAME}`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'DAY_ANNOUNCE', dead: [3] }));
        if (path.endsWith('/chat')) return json(200, chatViewFixture({ you: { canPost: false, refusal: 'CLOSED' } }));
        if (path.endsWith('/events')) return json(200, { events: [] });
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/me/actions')) return json(200, myActionsFixture(ROLE_FIXTURES.villager, { phase: 'DAY_ANNOUNCE' }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    expect(await screen.findByRole('heading', { name: 'Morning' })).toBeTruthy();
    expect(document.querySelector('[data-stage="night-results"]')).toBeTruthy();
    expect(document.querySelector('[data-wash="day"]')).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Night results' }).textContent).toMatch(/No one was eliminated last night/);
    expect(screen.getByRole('list', { name: 'Survivors' }).children.length).toBeGreaterThan(0);
    expect(await screen.findByText('Discussion will open after you continue to day.')).toBeTruthy();
    expect(screen.queryByLabelText('Message')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue to day' })).toBeTruthy();
  });

  it('names a dead seat and does not invent a role', async () => {
    renderApp(`/game/${GAME}`, { seat: host, fetchFn: stateFetch(gameStateFixture({ phase: 'DAY_DISCUSSION', dead: [3] })) });
    expect(await screen.findByRole('heading', { name: 'Day' })).toBeTruthy();
    expect(screen.getByText('Eliminated')).toBeTruthy();
    expect(screen.getAllByText('Alive').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-stage="day"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Villager');
  });

  it('shows day discussion cards, live chat, and Continue to voting', async () => {
    renderApp(`/game/${GAME}`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'DAY_DISCUSSION' }));
        if (path.endsWith('/chat')) return json(200, chatViewFixture({ count: 2, you: { canPost: true, refusal: null } }));
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/me/actions')) return json(200, myActionsFixture(ROLE_FIXTURES.villager, { phase: 'DAY_DISCUSSION' }));
        if (path.endsWith('/events')) return json(200, { events: [] });
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    expect(await screen.findByRole('heading', { name: 'Day' })).toBeTruthy();
    expect(document.querySelector('[data-stage="day"]')).toBeTruthy();
    expect(screen.getByText('Day / Discussion')).toBeTruthy();
    expect(screen.getByText('Discuss and share your thoughts')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue to voting' })).toBeTruthy();
    expect(screen.getByLabelText('Message')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Seated players' }).textContent).toMatch(/#1 /);
  });

  it('says the game moved on when the close was stale', async () => {
    let reads = 0;
    renderApp(`/game/${GAME}`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (request.method === 'POST' && path.endsWith('/host/phase/close')) {
          return json(409, { error: { code: 'PHASE_CONFLICT', message: 'The game has moved on.' } });
        }
        if (path.endsWith('/state')) {
          reads += 1;
          return json(200, gameStateFixture({ phase: reads === 1 ? 'VOTING' : 'REVOTE' }));
        }
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'End the day' }));
    const confirm = await screen.findByRole('dialog', { name: 'End the day?' });
    expect(confirm.textContent).toContain('This cannot be undone.');
    fireEvent.click(within(confirm).getByRole('button', { name: 'End the day' }));
    expect(await screen.findByText('The game moved on before that went through. This screen now shows the current phase.')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Refresh' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Revote' })).toBeTruthy();
  });

  it('casts a ballot and replaces it until the phase closes', async () => {
    const posts: { targetPlayerId: string | null }[] = [];
    renderApp(`/game/${GAME}`, {
      seat: guest,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (request.method === 'POST' && path.endsWith('/votes')) {
          const body = (await request.json()) as { targetPlayerId: string | null };
          posts.push(body);
          return json(200, { ballot: 1, targetPlayerId: body.targetPlayerId, supersedes: null });
        }
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'VOTING', you: 4 }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });

    const actions = await screen.findByRole('region', { name: 'Actions' });
    const confirm = within(actions).getByRole('button', { name: 'Submit vote' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(within(actions).queryByText('Waiting for host')).toBeNull();
    expect(within(actions).queryByRole('button', { name: 'End the day' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Rafi/ }));
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(posts).toEqual([{ targetPlayerId: fixturePlayerId(2) }]));
    expect(within(actions).getByText('Vote sent. Your vote is Rafi. You can change it until voting closes.')).toBeTruthy();
    expect(within(actions).getByText('Selected nominee')).toBeTruthy();
    expect(within(actions).getByText('Your vote is private.')).toBeTruthy();
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(confirm.textContent).toBe('Vote sent');

    fireEvent.click(within(actions).getByRole('button', { name: 'Abstain' }));
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    expect(confirm.textContent).toBe('Change vote');
    expect(within(actions).getByText('Abstain selected: your ballot counts for nobody. Not sent yet.')).toBeTruthy();
    fireEvent.click(confirm);
    await waitFor(() => expect(posts[1]).toEqual({ targetPlayerId: null }));
    expect(within(actions).getByText('Vote sent. You abstained. You can change it until voting closes.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('alpha_wolf');
  });

  it('hides abstain and locks a sent vote when the room forbids both', async () => {
    const posts: { targetPlayerId: string | null }[] = [];
    renderApp(`/game/${GAME}`, {
      seat: guest,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (request.method === 'POST' && path.endsWith('/votes')) {
          const body = (await request.json()) as { targetPlayerId: string | null };
          posts.push(body);
          return json(200, { ballot: 1, targetPlayerId: body.targetPlayerId, supersedes: null });
        }
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'VOTING', you: 4, voting: { abstain: false, changeUntilClose: false } }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });

    const actions = await screen.findByRole('region', { name: 'Actions' });
    expect(within(actions).getByText('Choose a player to eliminate.')).toBeTruthy();
    expect(within(actions).queryByRole('button', { name: 'Abstain' })).toBeNull();
    expect(within(actions).queryByText(/abstain/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Rafi/ }));
    fireEvent.click(within(actions).getByRole('button', { name: 'Submit vote' }));
    await waitFor(() => expect(posts).toEqual([{ targetPlayerId: fixturePlayerId(2) }]));
    expect(within(actions).getByText('Vote sent. Your vote is Rafi. This ballot is locked.')).toBeTruthy();
    expect((within(actions).getByRole('button', { name: 'Vote sent' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Asha/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a refusal and keeps an eliminated player from voting', async () => {
    renderApp(`/game/${GAME}`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (request.method === 'POST' && path.endsWith('/votes')) {
          return json(409, { error: { code: 'VOTE_INELIGIBLE', message: 'That vote is not allowed.' } });
        }
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'REVOTE', you: 1, dead: [1] }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });

    expect(await screen.findByRole('heading', { name: 'Revote' })).toBeTruthy();
    expect(screen.getByText('You cannot vote.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit revote' })).toBeNull();
    expect(screen.getByRole('button', { name: 'End the day' })).toBeTruthy();
    expect((screen.getByRole('button', { name: /Asha/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the server refusal when a vote is not allowed', async () => {
    renderApp(`/game/${GAME}`, {
      seat: guest,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (request.method === 'POST' && path.endsWith('/votes')) {
          return json(409, { error: { code: 'VOTE_INELIGIBLE', message: 'That vote is not allowed.' } });
        }
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'REVOTE', you: 4 }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });

    expect(await screen.findByText('Choose one of the tied players, or abstain.')).toBeTruthy();
    expect(screen.getByText('Day • Revote')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Rafi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit revote' }));
    expect(await screen.findByText('That vote is not allowed.')).toBeTruthy();
    expect(screen.queryByText(/Submitted/)).toBeNull();
  });

  it('sends a cancelled game to the results screen without roles', async () => {
    const recap = cancelledResultsFixture();
    const { router } = renderApp(`/game/${GAME}`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/results')) return json(200, recap);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'CANCELLED' }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    expect((await screen.findAllByText(/The host cancelled the game/)).length).toBeGreaterThan(0);
    expect(router.state.location.pathname).toBe(`/game/${GAME}/results`);
    expect(document.body.textContent).not.toMatch(/alpha_wolf|Villager/);
    expect(screen.queryByRole('button', { name: 'Begin the night' })).toBeNull();
  });

  it('lets the host replace the kill target and keeps that choice out of the rail', async () => {
    const posts: unknown[] = [];
    let decision: { kind: 'TARGET'; playerId: string } | { kind: 'NO_KILL' } | null = null;
    renderApp(`/game/${GAME}`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (request.method === 'POST' && path.endsWith('/host/kill-target')) {
          const body = (await request.json()) as { targetPlayerId?: string; noKill?: true };
          posts.push(body);
          decision = body.noKill ? { kind: 'NO_KILL' } : { kind: 'TARGET', playerId: body.targetPlayerId! };
          return json(200, killTargetFixture({ decision, editable: true }));
        }
        if (path.endsWith('/host/kill-target')) return json(200, killTargetFixture({ decision, editable: true }));
        if (path.endsWith('/chat')) return json(200, chatViewFixture({ you: { canPost: false, refusal: 'CLOSED' } }));
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'NIGHT_HOST_CONFIRM' }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });

    const actions = await screen.findByRole('region', { name: 'Actions' });
    const confirm = await within(actions).findByRole('button', { name: 'Confirm target' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(within(actions).getByText('Choose the player the pack named, or no kill.')).toBeTruthy();
    const picker = screen.getByRole('region', { name: 'Kill target' });
    expect(within(picker).getByText('Named by Asha')).toBeTruthy();
    expect(picker.textContent).not.toContain('alpha_wolf');
    expect(document.querySelector('.ww-game-rail')?.textContent).not.toContain('Named by');

    fireEvent.click(within(picker).getByRole('button', { name: 'Target Diego' }));
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(posts).toEqual([{ targetPlayerId: fixturePlayerId(12) }]));
    expect(within(actions).getByText('Submitted. The attack is on Diego. You can change it until this window closes.')).toBeTruthy();

    fireEvent.click(within(actions).getByRole('button', { name: 'No kill' }));
    fireEvent.click(confirm);
    await waitFor(() => expect(posts[1]).toEqual({ noKill: true }));
    expect(within(actions).getByText('Submitted. There is no attack. You can change it until this window closes.')).toBeTruthy();
  });

  it('shows a refused kill and hides the picker from a guest', async () => {
    const killReads: string[] = [];
    const { container: guestRoot } = renderApp(`/game/${GAME}`, {
      seat: guest,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/host/kill-target')) killReads.push(path);
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'NIGHT_HOST_CONFIRM', you: 4 }));
        if (path.endsWith('/chat')) return json(200, chatViewFixture({ you: { canPost: false, refusal: 'CLOSED' } }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    expect(await within(guestRoot).findByRole('heading', { name: 'Host confirm' })).toBeTruthy();
    expect(within(guestRoot).queryByRole('region', { name: 'Kill target' })).toBeNull();
    expect(within(guestRoot).queryByRole('button', { name: 'Confirm target' })).toBeNull();
    expect(guestRoot.textContent).not.toContain('Named by');
    expect(killReads).toEqual([]);

    renderApp(`/game/${GAME}`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (request.method === 'POST' && path.endsWith('/host/kill-target')) {
          return json(422, { error: { code: 'KILL_TARGET_NOT_SUBMITTED', message: 'No wolf named that player.', issues: [{ path: 'targetPlayerId', message: 'Nobody submitted that player.' }] } });
        }
        if (path.endsWith('/host/kill-target')) return json(200, killTargetFixture());
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'NIGHT_HOST_CONFIRM' }));
        if (path.endsWith('/chat')) return json(200, chatViewFixture({ you: { canPost: false, refusal: 'CLOSED' } }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Target Diego' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm target' }));
    expect(await screen.findByText('Nobody submitted that player.')).toBeTruthy();
    expect(screen.queryByText(/Submitted\. The attack/)).toBeNull();
  });

  it('tells the informed Doctor the attack and does not put it in the rail', async () => {
    const doctor = ROLE_FIXTURES.doctor;
    renderApp(`/game/${GAME}`, {
      seat: { gameId: GAME, roomCode: 'K7QMPR', playerId: doctor.playerId, token: 'ww_doctor_token_for_tests_012345', isHost: false },
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/me/actions')) return json(200, myActionsFixture(doctor, { phase: 'NIGHT_REACTION', finalWolfTarget: null }));
        if (path.endsWith('/me')) return json(200, doctor);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'NIGHT_REACTION', you: doctor.seatNumber }));
        if (path.endsWith('/chat')) return json(200, chatViewFixture({ you: { canPost: false, refusal: 'CLOSED' } }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    expect(await screen.findByText('There is no attack.')).toBeTruthy();
    expect(document.querySelector('.ww-game-rail')?.textContent).not.toContain('There is no attack.');
    expect(document.querySelector('.ww-game-rail')?.textContent).not.toContain('Named by');
    expect(screen.queryByRole('region', { name: 'Kill target' })).toBeNull();
    expect(document.body.textContent).not.toContain('doctor_save');
  });
});

describe('discussion', () => {
  it('sends during the day and stays closed at night', async () => {
    const posts: { body: string }[] = [];
    renderApp(`/game/${GAME}`, {
      seat: guest,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (request.method === 'POST' && path.endsWith('/chat/messages')) {
          const body = (await request.json()) as { body: string };
          posts.push(body);
          return json(200, chatMessageFixture(6, { body: body.body, playerId: guest.playerId }));
        }
        if (path.endsWith('/chat')) return json(200, chatViewFixture());
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'DAY_DISCUSSION', you: 4 }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });

    const rail = await screen.findByRole('region', { name: 'Discussion' });
    expect(await within(rail).findByText('Morning, everyone. Quiet night for me.')).toBeTruthy();
    const field = within(rail).getByRole('textbox', { name: 'Message' });
    const send = within(rail).getByRole('button', { name: 'Send' });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    expect(rail.textContent).not.toMatch(/alpha_wolf|Villager|Wolf/);
    fireEvent.change(field, { target: { value: 'Hello table' } });
    expect((send as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(send);
    await waitFor(() => expect(posts).toEqual([{ body: 'Hello table' }]));
    expect(within(rail).getByText('Hello table')).toBeTruthy();
    expect((field as HTMLInputElement).value).toBe('');

    cleanup();
    renderApp(`/game/${GAME}`, {
      seat: guest,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/chat')) return json(200, chatViewFixture({ you: { canPost: false, refusal: 'CLOSED' }, count: 1 }));
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'NIGHT_SUBMIT', you: 4 }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    const night = await screen.findByRole('region', { name: 'Discussion' });
    expect(await within(night).findByText('Discussion is closed at night.')).toBeTruthy();
    expect(within(night).queryByRole('textbox', { name: 'Message' })).toBeNull();
    expect(within(night).queryByRole('button', { name: 'Send' })).toBeNull();
    expect(within(night).queryByRole('button', { name: /Mute/ })).toBeNull();
  });

  it('shows a refusal, and a dead seat can still read', async () => {
    renderApp(`/game/${GAME}`, {
      seat: guest,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (request.method === 'POST' && path.endsWith('/chat/messages')) {
          return json(429, { error: { code: 'RATE_LIMITED', message: 'Wait a moment before sending another message.' } });
        }
        if (path.endsWith('/chat')) return json(200, chatViewFixture({ mutedPlayerIds: [fixturePlayerId(2)] }));
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'VOTING', you: 4 }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    const rail = await screen.findByRole('region', { name: 'Discussion' });
    expect(await within(rail).findByText('Muted')).toBeTruthy();
    fireEvent.change(within(rail).getByRole('textbox', { name: 'Message' }), { target: { value: 'a'.repeat(281) } });
    expect(within(rail).getByText('1 character over the limit')).toBeTruthy();
    expect((within(rail).getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(rail).getByRole('textbox', { name: 'Message' }), { target: { value: 'One more' } });
    fireEvent.click(within(rail).getByRole('button', { name: 'Send' }));
    expect(await within(rail).findByText('Wait a moment before sending another message.')).toBeTruthy();

    cleanup();
    renderApp(`/game/${GAME}`, {
      seat: guest,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/chat')) return json(200, chatViewFixture({ you: { canPost: false, refusal: 'DEAD' } }));
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'DAY_DISCUSSION', you: 4, dead: [4] }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    const dead = await screen.findByRole('region', { name: 'Discussion' });
    expect(await within(dead).findByText('The dead read only.')).toBeTruthy();
    expect(within(dead).getByText('Morning, everyone. Quiet night for me.')).toBeTruthy();
    expect((within(dead).getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('gives the host delete and mute, and leaves them off the results recap', async () => {
    const calls: string[] = [];
    renderApp(`/game/${GAME}`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (request.method === 'DELETE' && path.includes('/chat/messages/')) {
          calls.push(`delete ${path.split('/').pop()}`);
          return json(200, null);
        }
        if (request.method === 'PUT' && path.includes('/chat/mutes/')) {
          calls.push(`mute ${path.split('/').pop()}`);
          return json(200, null);
        }
        if (path.endsWith('/chat')) return json(200, chatViewFixture({ count: 1 }));
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'DAY_DISCUSSION' }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    const rail = await screen.findByRole('region', { name: 'Discussion' });
    fireEvent.click(await within(rail).findByRole('button', { name: 'Mute Rafi' }));
    await waitFor(() => expect(calls).toContain(`mute ${fixturePlayerId(2)}`));
    fireEvent.click(within(rail).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls).toContain(`delete ${chatMessageFixture(1).messageId}`));
    expect(within(rail).queryByRole('button', { name: 'Mute Asha' })).toBeNull();

    cleanup();
    renderApp(`/game/${GAME}/results`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/results')) return json(200, finishedResultsFixture());
        if (path.endsWith('/state')) return json(200, gameStateFixture({ phase: 'FINISHED' }));
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    expect(await screen.findByRole('heading', { name: 'Wolf wins' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });
});

describe('leaving role reveal', () => {
  it('moves both seats to the night when the host closes, and the guest has no close button', async () => {
    let phase: 'ROLE_REVEAL' | 'NIGHT_SUBMIT' = 'ROLE_REVEAL';
    const posts: unknown[] = [];
    const fetchFn = stateFetch(
      (request) => gameStateFixture({ phase, you: request.headers.get('Authorization')?.includes(guest.token) ? 4 : 1 }),
      (body) => {
        posts.push(body);
        phase = 'NIGHT_SUBMIT';
      },
    );
    const hostView = renderApp(`/game/${GAME}/reveal`, { seat: host, fetchFn });
    const guestView = renderApp(`/game/${GAME}/reveal`, { seat: guest, fetchFn });

    expect(await within(hostView.container).findByRole('button', { name: 'Begin the night' })).toBeTruthy();
    expect(await within(guestView.container).findByText('Read your role, then go to the table. The host starts the game when everyone is ready.')).toBeTruthy();
    expect(within(guestView.container).queryByRole('button', { name: 'Begin the night' })).toBeNull();
    expect(within(hostView.container).getByRole('heading', { name: 'Villager' })).toBeTruthy();

    fireEvent.click(within(hostView.container).getByRole('button', { name: 'Begin the night' }));
    await waitFor(() => expect(hostView.router.state.location.pathname).toBe(`/game/${GAME}`));
    expect(await within(hostView.container).findByRole('heading', { name: 'Night' })).toBeTruthy();
    expect(posts).toEqual([{ stateVersion: 30 }]);

    await waitFor(() => expect(guestView.router.state.location.pathname).toBe(`/game/${GAME}`), { timeout: 5000 });
    expect(within(guestView.container).queryByRole('button', { name: 'Close night actions' })).toBeNull();
    expect(within(hostView.container).getByRole('heading', { name: 'Night' })).toBeTruthy();
    expect(posts).toHaveLength(1);
  });

  it('shows a closed tally in the morning and hides counts while voting', async () => {
    const morning = gameStateFixture({ phase: 'DAY_ANNOUNCE', roundNumber: 2 });
    const named = morning.players[6]!;
    const other = morning.players[8]!;
    const closed = {
      roundNumber: 1,
      ballot: 1,
      counts: [
        { targetPlayerId: named.playerId, total: 6 },
        { targetPlayerId: other.playerId, total: 3 },
      ],
      abstentions: 2,
      votedOutPlayerId: named.playerId,
      tiedPlayerIds: [],
    };
    const tallyFetch = (phase: 'DAY_ANNOUNCE' | 'VOTING'): typeof fetch =>
      (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/tallies')) return json(200, { tallies: [closed] });
        if (path.endsWith('/state')) return json(200, phase === 'DAY_ANNOUNCE' ? morning : gameStateFixture({ phase: 'VOTING', roundNumber: 2 }));
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch;

    renderApp(`/game/${GAME}`, { seat: host, fetchFn: tallyFetch('DAY_ANNOUNCE') });
    expect(await screen.findByRole('region', { name: 'Vote' })).toBeTruthy();
    expect(screen.getByText(`${named.displayName} was named.`)).toBeTruthy();
    expect(screen.getByText('2 abstentions')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(document.body.textContent).not.toContain(named.playerId);

    cleanup();
    renderApp(`/game/${GAME}`, { seat: host, fetchFn: tallyFetch('VOTING') });
    expect(await screen.findByRole('heading', { name: 'Voting' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Vote' })).toBeNull();
    expect(screen.queryByText('2 abstentions')).toBeNull();
  });

  it('shows the seat’s own night result and not a host copy', async () => {
    const morning = gameStateFixture({ phase: 'DAY_ANNOUNCE', roundNumber: 2 });
    const target = morning.players[1]!;
    const someone = morning.players[4]!;
    renderApp(`/game/${GAME}`, {
      seat: host,
      fetchFn: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        if (path.endsWith('/events')) {
          return json(200, {
            events: [
              {
                seq: 1,
                type: 'INVESTIGATION_RESULT',
                audience: 'PLAYER',
                payload: { kind: 'ALIGNMENT_WOLF_OR_NOT', targetPlayerIds: [target.playerId], result: { value: 'WOLF' } },
              },
              {
                seq: 2,
                type: 'INVESTIGATION_RESULT',
                audience: 'HOST',
                payload: { actorPlayerId: someone.playerId, kind: 'ROLE_ID', targetPlayerIds: [target.playerId], result: { value: 'alpha_wolf' } },
              },
              {
                seq: 3,
                type: 'INFECTION_OCCURRED',
                audience: 'HOST',
                payload: { sourcePlayerId: someone.playerId, targetPlayerId: target.playerId, roleId: 'infected_wolf' },
              },
            ],
          });
        }
        if (path.endsWith('/state')) return json(200, morning);
        if (path.endsWith('/me')) return json(200, ROLE_FIXTURES.villager);
        return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }) as typeof fetch,
    });
    expect(await screen.findByRole('list', { name: 'Your report' })).toBeTruthy();
    expect(screen.getByText(`${target.displayName} is a Wolf.`)).toBeTruthy();
    expect(document.body.textContent).not.toContain('Alpha Wolf');
    expect(document.body.textContent).not.toContain('alpha_wolf');
    expect(document.body.textContent).not.toContain('Infected Wolf');
  });
});
