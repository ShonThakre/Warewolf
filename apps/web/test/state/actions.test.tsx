import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { idempotencyKeySchema, myActionsSchema, type SeatCredentials } from '@warewolf/contracts';
import { Provider } from 'react-redux';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../src/app/store';
import { myActionsFixture } from '../../src/game/fixtures/actions';
import { FIXTURE_GAME_ID, ROLE_FIXTURES, fixturePlayerId } from '../../src/game/fixtures/role';
import { actionPrompts, newIdempotencyKey, useMyActions, useSubmitAction } from '../../src/game/state/actions';
import { memorySessionStorage } from '../../src/session/storage';

const BASE = 'http://api.test/api/v1';
const GAME = FIXTURE_GAME_ID;
const wolf = ROLE_FIXTURES.alphaWolf;
const seat: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: wolf.playerId, token: 'ww_token_for_tests_0123456789', isHost: false };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(routes: Record<string, (request: Request) => Response | Promise<Response>>) {
  const requests: Request[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request.clone());
    const path = new URL(request.url).pathname.replace('/api/v1/', '');
    const route = routes[`${request.method} ${path}`];
    return route ? route(request) : json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }) as typeof fetch;
  const store = makeStore({ environment: { baseUrl: BASE, fetchFn }, storage: memorySessionStorage(seat) });
  return { store, requests };
}

afterEach(cleanup);

describe('action fixtures and prompts', () => {
  it('match the GET /me/actions contract for every role fixture', () => {
    for (const role of Object.values(ROLE_FIXTURES)) {
      const fixture = myActionsFixture(role, { chosen: role.abilities[0] ? { [role.abilities[0].abilityId]: { targetPlayerIds: [fixturePlayerId(12)] } } : {} });
      expect(myActionsSchema.parse(fixture)).toEqual(fixture);
    }
  });

  it('join /me and /me/actions by ability, in /me order', () => {
    const role = ROLE_FIXTURES.seeker;
    const prompts = actionPrompts(role, myActionsFixture(role, { availability: { seeker_public_reveal: 'NOT_THIS_PHASE' } }));
    expect(prompts.map((p) => [p.abilityId, p.availability, p.ability.target.kind])).toEqual([
      ['seeker_investigate', 'OPEN', 'PLAYERS'],
      ['seeker_public_reveal', 'NOT_THIS_PHASE', 'OWN_RESULT'],
    ]);
    expect(actionPrompts(null, null)).toEqual([]);
    expect(actionPrompts(ROLE_FIXTURES.villager, myActionsFixture(ROLE_FIXTURES.villager))).toEqual([]);
  });

  it('makes request keys the server accepts, without crypto.randomUUID', () => {
    const key = newIdempotencyKey();
    expect(idempotencyKeySchema.safeParse(key).success).toBe(true);
    expect(newIdempotencyKey()).not.toBe(key);
    expect(newIdempotencyKey((b) => b.fill(255))).toBe(`ww-${'ff'.repeat(16)}`);
  });
});

function Panel() {
  const [version, setVersion] = useState(1);
  const { actions } = useMyActions(version);
  const { submit, error } = useSubmitAction();
  const ability = wolf.abilities.find((a) => a.abilityId === 'alpha_kill')!;
  const prompt = actions?.abilities.find((a) => a.abilityInstanceId === ability.abilityInstanceId);
  return (
    <div>
      <p>
        availability:{prompt?.availability ?? '-'} chosen:{prompt?.action?.targetPlayerIds.join(',') || '-'} error:{error?.code ?? '-'} issue:{error?.issues[0]?.message ?? '-'}
      </p>
      <button type="button" onClick={() => void submit({ abilityInstanceId: ability.abilityInstanceId, targetPlayerIds: [fixturePlayerId(12)] })}>
        pick 12
      </button>
      <button type="button" onClick={() => void submit({ abilityInstanceId: ability.abilityInstanceId, targetPlayerIds: [fixturePlayerId(13)] })}>
        pick 13
      </button>
      <button type="button" onClick={() => setVersion((v) => v + 1)}>
        phase changed
      </button>
    </div>
  );
}

const render$ = (store: ReturnType<typeof makeStore>) =>
  render(
    <Provider store={store}>
      <Panel />
    </Provider>,
  );

describe('useMyActions and useSubmitAction', () => {
  it('submits with a key, reuses it for the same choice, and makes a new one for a new choice', async () => {
    let chosen: string[] | null = null;
    const { store, requests } = setup({
      [`GET games/${GAME}/me/actions`]: () => json(200, myActionsFixture(wolf, chosen ? { chosen: { alpha_kill: { targetPlayerIds: chosen } } } : {})),
      [`POST games/${GAME}/actions`]: async (request) => {
        const body = (await request.json()) as { abilityInstanceId: string; targetPlayerIds: string[] };
        chosen = body.targetPlayerIds;
        return json(200, myActionsFixture(wolf, { chosen: { alpha_kill: { targetPlayerIds: chosen } } }).abilities.find((a) => a.abilityId === 'alpha_kill')!.action);
      },
    });
    render$(store);
    await waitFor(() => expect(screen.getByText(/availability:OPEN chosen:-/)).toBeTruthy());

    await act(async () => screen.getByRole('button', { name: 'pick 12' }).click());
    await waitFor(() => expect(screen.getByText(new RegExp(`chosen:${fixturePlayerId(12)}`))).toBeTruthy());
    await act(async () => screen.getByRole('button', { name: 'pick 12' }).click());
    await act(async () => screen.getByRole('button', { name: 'pick 13' }).click());
    await waitFor(() => expect(screen.getByText(new RegExp(`chosen:${fixturePlayerId(13)}`))).toBeTruthy());

    const posts = requests.filter((r) => r.method === 'POST');
    const keys = posts.map((r) => r.headers.get('Idempotency-Key'));
    expect(keys).toHaveLength(3);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(await posts[0]!.json()).toEqual({ abilityInstanceId: wolf.abilities.find((a) => a.abilityId === 'alpha_kill')!.abilityInstanceId, targetPlayerIds: [fixturePlayerId(12)], payload: {} });
  });

  it('shows a refusal with the message written for the player', async () => {
    const { store } = setup({
      [`GET games/${GAME}/me/actions`]: () => json(200, myActionsFixture(wolf)),
      [`POST games/${GAME}/actions`]: () =>
        json(422, { error: { code: 'ACTION_TARGET_ILLEGAL', message: 'Choose a different target.', issues: [{ path: 'targetPlayerIds', message: 'That player cannot be chosen for this ability.' }] } }),
    });
    render$(store);
    await waitFor(() => expect(screen.getByText(/availability:OPEN/)).toBeTruthy());
    await act(async () => screen.getByRole('button', { name: 'pick 12' }).click());
    await waitFor(() => expect(screen.getByText(/error:ACTION_TARGET_ILLEGAL issue:That player cannot be chosen for this ability\./)).toBeTruthy());
  });

  it('refetches when the phase moves, which locks the choice', async () => {
    let phaseClosed = false;
    const { store, requests } = setup({
      [`GET games/${GAME}/me/actions`]: () =>
        json(
          200,
          myActionsFixture(wolf, phaseClosed
            ? { phase: 'NIGHT_HOST_CONFIRM', availability: { alpha_kill: 'NOT_THIS_PHASE', alpha_infect: 'NOT_THIS_PHASE' }, chosen: { alpha_kill: { targetPlayerIds: [fixturePlayerId(12)], status: 'LOCKED' } } }
            : { chosen: { alpha_kill: { targetPlayerIds: [fixturePlayerId(12)] } } }),
        ),
    });
    render$(store);
    await waitFor(() => expect(screen.getByText(/availability:OPEN/)).toBeTruthy());
    phaseClosed = true;
    await act(async () => screen.getByRole('button', { name: 'phase changed' }).click());
    await waitFor(() => expect(screen.getByText(/availability:NOT_THIS_PHASE/)).toBeTruthy());
    expect(requests.filter((r) => r.method === 'GET')).toHaveLength(2);
  });
});
