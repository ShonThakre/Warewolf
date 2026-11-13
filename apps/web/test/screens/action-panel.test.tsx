import type { MyActions, MyRole, SubmitActionResponse } from '@warewolf/contracts';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { myActionsFixture } from '../../src/game/fixtures/actions';
import { gameStateFixture } from '../../src/game/fixtures/phase';
import { FIXTURE_GAME_ID, ROLE_FIXTURES, fixtureId, fixturePlayerId, ownRoleFixture } from '../../src/game/fixtures/role';
import { json, renderApp } from '../render';

const GAME = FIXTURE_GAME_ID;

function seatFor(role: MyRole) {
  return {
    gameId: GAME,
    roomCode: 'K7QMPR',
    playerId: role.playerId,
    token: `ww_token_${role.seatNumber}_0123456789abcd`,
    isHost: role.seatNumber === 1,
  };
}

function stored(role: MyRole, abilityId: string, targetPlayerIds: readonly string[]): SubmitActionResponse {
  const ability = role.abilities.find((item) => item.abilityId === abilityId);
  if (!ability) throw new Error(abilityId);
  return {
    actionId: fixtureId(9000),
    status: 'PENDING',
    abilityInstanceId: ability.abilityInstanceId,
    roundNumber: 1,
    phase: ability.timing === 'NIGHT_REACTION' ? 'NIGHT_REACTION' : ability.timing === 'DAY' ? 'DAY_DISCUSSION' : 'NIGHT_SUBMIT',
    targetPlayerIds: [...targetPlayerIds],
    payload: {},
  };
}

function nightFetch(role: MyRole, actions: MyActions, onPost?: (body: { abilityInstanceId: string; targetPlayerIds: string[]; payload: Record<string, string> }) => Response | Promise<Response>) {
  const state = gameStateFixture({
    phase: actions.phase,
    you: role.seatNumber,
    dead: [3],
  });
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/me/actions')) return json(200, actions);
    if (path.endsWith('/me')) return json(200, role);
    if (request.method === 'POST' && path.endsWith('/actions')) {
      const body = (await request.json()) as { abilityInstanceId: string; targetPlayerIds: string[]; payload: Record<string, string> };
      if (onPost) return onPost(body);
      const abilityId = role.abilities.find((item) => item.abilityInstanceId === body.abilityInstanceId)?.abilityId ?? role.abilities[0]!.abilityId;
      return json(200, stored(role, abilityId, body.targetPlayerIds));
    }
    if (path.endsWith('/state')) return json(200, state);
    return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }) as typeof fetch;
}

function seatButton(name: string) {
  const button = screen.getByRole('button', { name: new RegExp(name) });
  if (!(button instanceof HTMLButtonElement)) throw new Error(`${name} is not a button`);
  return button;
}

afterEach(cleanup);

describe('night action panel', () => {
  it('renders a Seeker from the fixture, and keeps a dead seat and the Seeker out of the choice', async () => {
    const role = ROLE_FIXTURES.seeker;
    const posts: { abilityInstanceId: string; targetPlayerIds: string[] }[] = [];
    renderApp(`/game/${GAME}`, {
      seat: seatFor(role),
      fetchFn: nightFetch(role, myActionsFixture(role, { availability: { seeker_public_reveal: 'NOT_THIS_PHASE' } }), async (body) => {
        posts.push(body);
        return json(200, stored(role, 'seeker_investigate', body.targetPlayerIds));
      }),
    });

    expect(await screen.findByText('Seeker')).toBeTruthy();
    expect(screen.getByText(/Not during this phase/)).toBeTruthy();
    expect(document.querySelector('.ww-game-rail')?.textContent).not.toContain('Seeker');
    expect(document.body.textContent).not.toContain('seeker_investigate');
    const actions = screen.getByRole('region', { name: 'Actions' });
    expect(within(actions).getByText('Choose a player to investigate')).toBeTruthy();
    expect((within(actions).getByRole('button', { name: 'Submit' }) as HTMLButtonElement).disabled).toBe(true);
    expect(seatButton('Mira').disabled).toBe(true);
    expect(seatButton('Tomas').disabled).toBe(true);
    expect(screen.getByText('Eliminated')).toBeTruthy();

    fireEvent.click(seatButton('Rafi'));
    expect(within(actions).getByText('Selected: Rafi. Not sent yet.')).toBeTruthy();
    expect(within(actions).getByText('Not sent yet')).toBeTruthy();
    expect(seatButton('Rafi').textContent).toContain('Selected');
    expect((within(actions).getByRole('button', { name: 'Submit' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(within(actions).getByRole('button', { name: 'Submit' }));
    expect(await within(actions).findByText('Submitted')).toBeTruthy();
    expect(posts).toEqual([{ abilityInstanceId: role.abilities[0]!.abilityInstanceId, targetPlayerIds: [fixturePlayerId(2)], payload: {} }]);

    expect(within(actions).getByRole('button', { name: 'Choice sent' })).toBeTruthy();

    fireEvent.click(seatButton('Asha'));
    expect(within(actions).getByText('Selected: Asha. Not sent yet.')).toBeTruthy();
    expect((within(actions).getByRole('button', { name: /^(Submit|Update choice)$/ }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Hide role' }));
    expect(screen.queryByText('Seeker')).toBeNull();
    expect(screen.getByText('Your role')).toBeTruthy();
  });

  it('renders a Guard from the same panel and lets the Guard choose themself', async () => {
    const role = ownRoleFixture('guard', { seat: 5 });
    const posts: { targetPlayerIds: string[]; payload: Record<string, string> }[] = [];
    renderApp(`/game/${GAME}`, {
      seat: seatFor(role),
      fetchFn: nightFetch(role, myActionsFixture(role), async (body) => {
        posts.push({ targetPlayerIds: body.targetPlayerIds, payload: body.payload });
        return json(200, stored(role, 'guard_protect', body.targetPlayerIds));
      }),
    });

    const actions = await screen.findByRole('region', { name: 'Actions' });
    expect(await within(actions).findByText('Choose a player to protect')).toBeTruthy();
    expect(screen.getByText('Guard')).toBeTruthy();
    expect(screen.getByText('Not the same player as last night.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close night actions' })).toBeNull();
    expect(seatButton('Ines').disabled).toBe(false);

    fireEvent.click(seatButton('Ines'));
    fireEvent.click(within(actions).getByRole('button', { name: /^(Submit|Update choice)$/ }));
    await waitFor(() => expect(posts).toEqual([{ targetPlayerIds: [fixturePlayerId(5)], payload: {} }]));
    expect(within(actions).getByText('Submitted')).toBeTruthy();
    expect((within(actions).getByRole('button', { name: 'Choice sent' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('gives the Witch two controls because the projection has two abilities', async () => {
    const role = ownRoleFixture('witch', { seat: 6 });
    renderApp(`/game/${GAME}`, { seat: seatFor(role), fetchFn: nightFetch(role, myActionsFixture(role)) });

    expect(await screen.findByRole('button', { name: 'Save this player' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose a player to poison' })).toBeTruthy();
    expect(seatButton('Kofi').disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Choose a player to poison' }));
    expect(seatButton('Kofi').disabled).toBe(true);
    expect(seatButton('Asha').disabled).toBe(false);
  });

  it('keeps the Witch potion in use pressed and marks a potion already sent', async () => {
    const role = ownRoleFixture('witch', { seat: 6 });
    const kofi = fixturePlayerId(2);
    renderApp(`/game/${GAME}`, { seat: seatFor(role), fetchFn: nightFetch(role, myActionsFixture(role, { chosen: { witch_save: { targetPlayerIds: [kofi] } } })) });

    const save = await screen.findByRole('button', { name: /^Save this player/ });
    await waitFor(() => expect(save.textContent).toBe('Save this player, sent'));
    const poison = screen.getByRole('button', { name: 'Choose a player to poison' });
    expect(save.getAttribute('aria-pressed')).toBe('true');
    expect(save.getAttribute('data-sent')).toBe('true');
    expect(poison.getAttribute('aria-pressed')).toBe('false');
    expect(poison.hasAttribute('data-sent')).toBe(false);

    fireEvent.click(poison);
    expect(poison.getAttribute('aria-pressed')).toBe('true');
    expect(save.getAttribute('aria-pressed')).toBe('false');
    expect(save.getAttribute('data-sent')).toBe('true');
  });

  it('hides a passive row and submits an announced save with no player', async () => {
    const role = ROLE_FIXTURES.doctor;
    const posts: { targetPlayerIds: string[]; payload: Record<string, string> }[] = [];
    const actions = myActionsFixture(role, { phase: 'NIGHT_REACTION' });
    renderApp(`/game/${GAME}`, {
      seat: seatFor(role),
      fetchFn: nightFetch(
        role,
        { ...actions, abilities: actions.abilities.map((ability) => ({ ...ability, availability: ability.availability })) },
        async (body) => {
          posts.push({ targetPlayerIds: body.targetPlayerIds, payload: body.payload });
          return json(200, stored(role, 'doctor_save', []));
        },
      ),
    });

    const row = await screen.findByRole('region', { name: 'Actions' });
    expect(await within(row).findByText('Save the announced target')).toBeTruthy();
    expect(screen.queryByText('Choose a player to protect')).toBeNull();
    expect(seatButton('Asha').disabled).toBe(true);
    fireEvent.click(within(row).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(posts).toEqual([{ targetPlayerIds: [], payload: {} }]));
  });

  it('shows the sentence the server wrote for an illegal target', async () => {
    const role = ROLE_FIXTURES.seeker;
    renderApp(`/game/${GAME}`, {
      seat: seatFor(role),
      fetchFn: nightFetch(role, myActionsFixture(role, { availability: { seeker_public_reveal: 'PASSIVE' } }), () =>
        json(422, {
          error: {
            code: 'ACTION_TARGET_ILLEGAL',
            message: 'Choose a different target.',
            issues: [{ path: 'targetPlayerIds', message: 'That player cannot be chosen for this ability.' }],
          },
        }),
      ),
    });

    await screen.findByText('Seeker');
    expect(screen.queryByText('Publish a stored result')).toBeNull();
    fireEvent.click(seatButton('Rafi'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect((await screen.findByRole('alert')).textContent).toBe('That player cannot be chosen for this ability.');
  });

  it('keeps a locked choice from changing', async () => {
    const role = ROLE_FIXTURES.seeker;
    renderApp(`/game/${GAME}`, {
      seat: seatFor(role),
      fetchFn: nightFetch(
        role,
        myActionsFixture(role, {
          phase: 'NIGHT_HOST_CONFIRM',
          availability: { seeker_investigate: 'NOT_THIS_PHASE', seeker_see_role: 'NOT_THIS_PHASE', seeker_public_reveal: 'NOT_THIS_PHASE' },
          chosen: { seeker_investigate: { targetPlayerIds: [fixturePlayerId(2)], status: 'LOCKED' } },
        }),
      ),
    });

    const actions = await screen.findByRole('region', { name: 'Actions' });
    expect(await within(actions).findByText('Submitted')).toBeTruthy();
    expect(within(actions).queryByRole('button', { name: 'Submit' })).toBeNull();
    expect(seatButton('Rafi').disabled).toBe(true);
    expect(seatButton('Rafi').getAttribute('aria-pressed')).toBe('true');
    expect(seatButton('Asha').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('day action panel', () => {
  it('lets the Sniper pick a seat during day discussion', async () => {
    const role = ownRoleFixture('sniper', { seat: 4 });
    const posts: { targetPlayerIds: string[] }[] = [];
    renderApp(`/game/${GAME}`, {
      seat: seatFor(role),
      fetchFn: nightFetch(role, myActionsFixture(role, { phase: 'DAY_DISCUSSION' }), async (body) => {
        posts.push({ targetPlayerIds: body.targetPlayerIds });
        return json(200, stored(role, 'sniper_shot', body.targetPlayerIds));
      }),
    });

    const actions = await screen.findByRole('region', { name: 'Actions' });
    expect(await within(actions).findByText('Choose a kill target')).toBeTruthy();
    expect(screen.getByRole('list', { name: /Choose a player/ })).toBeTruthy();
    expect(seatButton('Rafi').disabled).toBe(false);
    fireEvent.click(seatButton('Rafi'));
    fireEvent.click(within(actions).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(posts).toEqual([{ targetPlayerIds: [fixturePlayerId(2)] }]));
    expect(within(actions).getByText('Submitted')).toBeTruthy();
  });

  it('lets the Mind Controller choose a voter and a new target', async () => {
    const role = ownRoleFixture('mind_controller', { seat: 4 });
    const posts: { targetPlayerIds: string[] }[] = [];
    renderApp(`/game/${GAME}`, {
      seat: seatFor(role),
      fetchFn: nightFetch(role, myActionsFixture(role, { phase: 'DAY_DISCUSSION' }), async (body) => {
        posts.push({ targetPlayerIds: body.targetPlayerIds });
        return json(200, stored(role, 'mind_control', body.targetPlayerIds));
      }),
    });

    const actions = await screen.findByRole('region', { name: 'Actions' });
    expect(await within(actions).findByText('Choose the voter, then their new target')).toBeTruthy();
    expect(screen.getByRole('list', { name: /Choose two players/ })).toBeTruthy();
    fireEvent.click(seatButton('Rafi'));
    fireEvent.click(seatButton('Asha'));
    fireEvent.click(within(actions).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(posts).toEqual([{ targetPlayerIds: [fixturePlayerId(2), fixturePlayerId(1)] }]));
  });
});
