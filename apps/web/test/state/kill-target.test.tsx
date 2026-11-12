import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { killTargetViewSchema, myActionsSchema, type SeatCredentials } from '@warewolf/contracts';
import type { GamePhase } from '@warewolf/domain';
import { Provider } from 'react-redux';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../src/app/store';
import { myActionsFixture } from '../../src/game/fixtures/actions';
import { killTargetFixture } from '../../src/game/fixtures/killTarget';
import { FIXTURE_GAME_ID, ROLE_FIXTURES, fixturePlayerId } from '../../src/game/fixtures/role';
import { actionPrompts } from '../../src/game/state/actions';
import { useKillTarget, useSetKillTarget } from '../../src/game/state/killTarget';
import { memorySessionStorage } from '../../src/session/storage';

const BASE = 'http://api.test/api/v1';
const GAME = FIXTURE_GAME_ID;
const hostSeat: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: fixturePlayerId(1), token: 'ww_token_for_tests_0123456789', isHost: true };
const guestSeat: SeatCredentials = { ...hostSeat, playerId: fixturePlayerId(8), isHost: false };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(routes: Record<string, (request: Request) => Response | Promise<Response>>, seat: SeatCredentials = hostSeat) {
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

describe('kill target fixtures', () => {
  it('match the host view contract, including a replaced choice', () => {
    expect(killTargetViewSchema.parse(killTargetFixture())).toEqual(killTargetFixture());
    const chosen = killTargetFixture({ decision: { kind: 'TARGET', playerId: fixturePlayerId(14) } });
    expect(chosen.decision).toEqual({ kind: 'TARGET', playerId: fixturePlayerId(14) });
    expect(killTargetFixture({ decision: { kind: 'NO_KILL' }, phase: 'NIGHT_REACTION', editable: false }).editable).toBe(false);
  });

  it('keeps the informed Doctor target on the save prompt and off every other ability', () => {
    const doctor = ROLE_FIXTURES.doctor;
    const told = myActionsFixture(doctor, { phase: 'NIGHT_REACTION', finalWolfTarget: fixturePlayerId(12) });
    expect(myActionsSchema.parse(told)).toEqual(told);
    const prompts = actionPrompts(doctor, told);
    expect(prompts.find((prompt) => prompt.abilityId === 'doctor_save')).toMatchObject({ finalWolfTarget: fixturePlayerId(12) });
    expect(prompts.filter((prompt) => prompt.abilityId !== 'doctor_save').every((prompt) => !('finalWolfTarget' in prompt))).toBe(true);
    const quiet = actionPrompts(doctor, myActionsFixture(doctor, { phase: 'NIGHT_REACTION', finalWolfTarget: null }));
    expect(quiet.find((prompt) => prompt.abilityId === 'doctor_save')?.finalWolfTarget).toBeNull();
    expect(actionPrompts(doctor, myActionsFixture(doctor)).find((prompt) => prompt.abilityId === 'doctor_save')).not.toHaveProperty('finalWolfTarget');
  });
});

function HostPanel({ initialPhase = 'NIGHT_HOST_CONFIRM' as GamePhase }) {
  const [version, setVersion] = useState(1);
  const [phase, setPhase] = useState<GamePhase>(initialPhase);
  const { view } = useKillTarget(phase, version);
  const { choose, error } = useSetKillTarget();
  const decision = view?.decision?.kind === 'TARGET' ? view.decision.playerId : (view?.decision?.kind ?? '-');
  return (
    <div>
      <p>
        view:{view ? 'yes' : '-'} decision:{decision} editable:{view ? String(view.editable) : '-'} error:{error?.code ?? '-'} issue:{error?.issues[0]?.message ?? '-'}
      </p>
      <button type="button" onClick={() => void choose({ targetPlayerId: fixturePlayerId(14) })}>
        pick 14
      </button>
      <button type="button" onClick={() => void choose({ noKill: true })}>
        no kill
      </button>
      <button
        type="button"
        onClick={() => {
          setPhase('NIGHT_REACTION');
          setVersion((value) => value + 1);
        }}
      >
        phase changed
      </button>
    </div>
  );
}

const render$ = (store: ReturnType<typeof makeStore>, phase?: GamePhase) =>
  render(
    <Provider store={store}>
      <HostPanel initialPhase={phase} />
    </Provider>,
  );

describe('useKillTarget and useSetKillTarget', () => {
  it('does not ask the server when the seat is not the host', async () => {
    const { store, requests } = setup({}, guestSeat);
    render$(store);
    await waitFor(() => expect(screen.getByText(/view:-/)).toBeTruthy());
    expect(requests).toHaveLength(0);
  });

  it('does not ask the server outside host confirm and the reaction window', async () => {
    const { store, requests } = setup({});
    render$(store, 'NIGHT_SUBMIT');
    await waitFor(() => expect(screen.getByText(/view:-/)).toBeTruthy());
    expect(requests).toHaveLength(0);
  });

  it('loads the named players and replaces the choice until the phase closes', async () => {
    let decision: KillDecisionState = null;
    const { store, requests } = setup({
      [`GET games/${GAME}/host/kill-target`]: () => json(200, killTargetFixture({ decision, phase: decision && !editable ? 'NIGHT_REACTION' : 'NIGHT_HOST_CONFIRM', editable })),
      [`POST games/${GAME}/host/kill-target`]: async (request) => {
        const body = (await request.json()) as { targetPlayerId?: string; noKill?: boolean };
        decision = body.noKill ? { kind: 'NO_KILL' } : { kind: 'TARGET', playerId: body.targetPlayerId! };
        return json(200, killTargetFixture({ decision }));
      },
    });
    let editable = true;
    render$(store);
    await waitFor(() => expect(screen.getByText(/view:yes decision:- editable:true/)).toBeTruthy());

    await act(async () => screen.getByRole('button', { name: 'pick 14' }).click());
    await waitFor(() => expect(screen.getByText(new RegExp(`decision:${fixturePlayerId(14)}`))).toBeTruthy());
    await act(async () => screen.getByRole('button', { name: 'no kill' }).click());
    await waitFor(() => expect(screen.getByText(/decision:NO_KILL/)).toBeTruthy());

    editable = false;
    await act(async () => screen.getByRole('button', { name: 'phase changed' }).click());
    await waitFor(() => expect(screen.getByText(/editable:false/)).toBeTruthy());

    const posts = requests.filter((request) => request.method === 'POST');
    expect(await posts[0]!.json()).toEqual({ targetPlayerId: fixturePlayerId(14) });
    expect(await posts[1]!.json()).toEqual({ noKill: true });
    expect(requests.filter((request) => request.method === 'GET').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the refusal when no wolf named that player', async () => {
    const { store } = setup({
      [`GET games/${GAME}/host/kill-target`]: () => json(200, killTargetFixture()),
      [`POST games/${GAME}/host/kill-target`]: () =>
        json(422, {
          error: {
            code: 'KILL_TARGET_NOT_SUBMITTED',
            message: 'That target was not submitted.',
            issues: [{ path: 'targetPlayerId', message: 'No wolf chose that player tonight.' }],
          },
        }),
    });
    render$(store);
    await waitFor(() => expect(screen.getByText(/view:yes/)).toBeTruthy());
    await act(async () => screen.getByRole('button', { name: 'pick 14' }).click());
    await waitFor(() => expect(screen.getByText(/error:KILL_TARGET_NOT_SUBMITTED issue:No wolf chose that player tonight\./)).toBeTruthy());
    expect(screen.getByText(/decision:-/)).toBeTruthy();
  });
});

type KillDecisionState = { kind: 'TARGET'; playerId: string } | { kind: 'NO_KILL' } | null;
