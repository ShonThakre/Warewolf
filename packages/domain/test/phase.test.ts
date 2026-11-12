import { describe, expect, it } from 'vitest';
import {
  CLOSABLE_PHASES,
  GAME_PHASES,
  PHASE_TRANSITIONS,
  ROLE_PACKS,
  canTransition,
  getPack,
  isClosable,
  nightWindows,
  phaseDeadline,
  phaseRules,
  planClose,
  positionAfter,
  type CloseResult,
  type CloseStep,
  type ClosablePhase,
  type GameConfiguration,
  type GamePhase,
  type PhasePosition,
  type PhaseRules,
} from '../src/index.js';

const pack = (id: string): GameConfiguration => {
  const p = getPack(id);
  if (!p) throw new Error(`missing pack ${id}`);
  return p.config;
};

const infection = pack('infection-core');
const classic = pack('classic-10');

const rules = (overrides: Partial<PhaseRules> & { hostConfirm?: boolean; reaction?: boolean } = {}): PhaseRules => ({
  windows: { hostConfirm: overrides.hostConfirm ?? false, reaction: overrides.reaction ?? false },
  votingEnabled: overrides.votingEnabled ?? true,
  dayShots: overrides.dayShots ?? false,
  pacing: overrides.pacing ?? 'HOST',
  timers: overrides.timers ?? null,
});

const at = (phase: GamePhase, roundNumber = 1): PhasePosition => ({ status: 'ACTIVE', phase, roundNumber });

/** Closes with no resolution effects: nobody wins, nothing ties. */
function quietClose(position: PhasePosition, r: PhaseRules): PhasePosition {
  if (!isClosable(position.phase)) throw new Error(`${position.phase} cannot close`);
  const step = planClose(position.phase, r);
  const result: CloseResult =
    step.kind === 'ADVANCE' ? step : step.kind === 'RESOLVE_NIGHT' ? { ...step, gameOver: false } : { ...step, gameOver: false, tied: false };
  return positionAfter(position, result);
}

/** Phases from role reveal to the next round's night, closing each with no effects. */
function firstRound(r: PhaseRules): GamePhase[] {
  const seen: GamePhase[] = [];
  let position = at('ROLE_REVEAL');
  while (position.roundNumber === 1) {
    seen.push(position.phase);
    position = quietClose(position, r);
  }
  return [...seen, position.phase];
}

describe('night windows', () => {
  it('opens host confirm and the Doctor reaction for Infection Edition', () => {
    expect(nightWindows(infection)).toEqual({ hostConfirm: true, reaction: true });
  });

  it('skips both for Classic: majority kill and a blind Doctor', () => {
    expect(classic.wolves.killAggregation).toBe('MAJORITY');
    expect(nightWindows(classic)).toEqual({ hostConfirm: false, reaction: false });
  });

  it('opens the reaction only when a seated role has a NIGHT_REACTION ability', () => {
    const noDoctor: GameConfiguration = { ...infection, roles: infection.roles.filter((e) => e.roleId !== 'doctor') };
    expect(nightWindows(noDoctor)).toEqual({ hostConfirm: true, reaction: false });

    const blindDoctor: GameConfiguration = {
      ...infection,
      roles: infection.roles.map((e) => (e.roleId === 'doctor' ? { ...e, abilityProfile: 'doctor_blind' } : e)),
    };
    expect(nightWindows(blindDoctor).reaction).toBe(false);

    const zeroDoctors: GameConfiguration = {
      ...infection,
      roles: infection.roles.map((e) => (e.roleId === 'doctor' ? { ...e, count: 0 } : e)),
    };
    expect(nightWindows(zeroDoctors).reaction).toBe(false);
  });

  it('opens the reaction without host confirm when only the Doctor is informed', () => {
    const majority: GameConfiguration = { ...infection, wolves: { ...infection.wolves, killAggregation: 'MAJORITY' } };
    expect(nightWindows(majority)).toEqual({ hostConfirm: false, reaction: true });
  });

  it('depends only on the configuration, so every shipped pack has a fixed answer', () => {
    for (const p of ROLE_PACKS) {
      expect(nightWindows(p.config)).toEqual(nightWindows(structuredClone(p.config)));
    }
  });
});

describe('planClose', () => {
  it('Infection Edition: submissions, host confirm, Doctor reaction, then resolve', () => {
    const r = phaseRules(infection);
    expect(planClose('NIGHT_SUBMIT', r)).toEqual({ kind: 'ADVANCE', to: 'NIGHT_HOST_CONFIRM' });
    expect(planClose('NIGHT_HOST_CONFIRM', r)).toEqual({ kind: 'ADVANCE', to: 'NIGHT_REACTION' });
    expect(planClose('NIGHT_REACTION', r)).toEqual({ kind: 'RESOLVE_NIGHT' });
  });

  it('Classic: night submission resolves directly', () => {
    expect(planClose('NIGHT_SUBMIT', phaseRules(classic))).toEqual({ kind: 'RESOLVE_NIGHT' });
  });

  it('host confirm resolves when there is no reaction window', () => {
    expect(planClose('NIGHT_HOST_CONFIRM', rules({ hostConfirm: true }))).toEqual({ kind: 'RESOLVE_NIGHT' });
  });

  it('a reaction window without host confirm follows submission', () => {
    expect(planClose('NIGHT_SUBMIT', rules({ reaction: true }))).toEqual({ kind: 'ADVANCE', to: 'NIGHT_REACTION' });
  });

  it('runs the day from announcement to the ballots', () => {
    const r = rules();
    expect(planClose('ROLE_REVEAL', r)).toEqual({ kind: 'ADVANCE', to: 'NIGHT_SUBMIT' });
    expect(planClose('DAY_ANNOUNCE', r)).toEqual({ kind: 'ADVANCE', to: 'DAY_DISCUSSION' });
    expect(planClose('DAY_DISCUSSION', r)).toEqual({ kind: 'ADVANCE', to: 'VOTING' });
    expect(planClose('VOTING', r)).toEqual({ kind: 'RESOLVE_DAY', ballot: 'FIRST' });
    expect(planClose('REVOTE', r)).toEqual({ kind: 'RESOLVE_DAY', ballot: 'REVOTE' });
  });

  it('resolves the day at the end of discussion when voting is off', () => {
    expect(planClose('DAY_DISCUSSION', rules({ votingEnabled: false }))).toEqual({ kind: 'RESOLVE_DAY', ballot: 'NONE' });
  });

  it('has no close for lobby, finished, or cancelled', () => {
    expect(GAME_PHASES.filter((p) => !isClosable(p))).toEqual(['LOBBY', 'FINISHED', 'CANCELLED']);
  });
});

describe('positionAfter', () => {
  it('a night that does not end the game opens the day in the same round', () => {
    expect(positionAfter(at('NIGHT_REACTION', 3), { kind: 'RESOLVE_NIGHT', gameOver: false })).toEqual(at('DAY_ANNOUNCE', 3));
  });

  it('a night that ends the game skips the day (OD-68)', () => {
    expect(positionAfter(at('NIGHT_SUBMIT', 2), { kind: 'RESOLVE_NIGHT', gameOver: true })).toEqual({
      status: 'FINISHED',
      phase: 'FINISHED',
      roundNumber: 2,
    });
  });

  it('a decided ballot starts the next round at night', () => {
    expect(positionAfter(at('VOTING', 2), { kind: 'RESOLVE_DAY', ballot: 'FIRST', gameOver: false, tied: false })).toEqual(at('NIGHT_SUBMIT', 3));
  });

  it('a first tie opens one revote in the same round (OD-40)', () => {
    expect(positionAfter(at('VOTING', 2), { kind: 'RESOLVE_DAY', ballot: 'FIRST', gameOver: false, tied: true })).toEqual(at('REVOTE', 2));
  });

  it('a second tie eliminates nobody and returns to night (OD-40)', () => {
    expect(positionAfter(at('REVOTE', 2), { kind: 'RESOLVE_DAY', ballot: 'REVOTE', gameOver: false, tied: true })).toEqual(at('NIGHT_SUBMIT', 3));
  });

  it('a day that ends the game finishes it, even on a tie', () => {
    expect(positionAfter(at('VOTING', 4), { kind: 'RESOLVE_DAY', ballot: 'FIRST', gameOver: true, tied: true }).phase).toBe('FINISHED');
  });

  it('a day without voting starts the next night', () => {
    expect(positionAfter(at('DAY_DISCUSSION', 1), { kind: 'RESOLVE_DAY', ballot: 'NONE', gameOver: false, tied: false })).toEqual(at('NIGHT_SUBMIT', 2));
  });
});

describe('a full round', () => {
  it('Infection Edition opens both night windows', () => {
    expect(firstRound(phaseRules(infection))).toEqual([
      'ROLE_REVEAL',
      'NIGHT_SUBMIT',
      'NIGHT_HOST_CONFIRM',
      'NIGHT_REACTION',
      'DAY_ANNOUNCE',
      'DAY_DISCUSSION',
      'VOTING',
      'NIGHT_SUBMIT',
    ]);
  });

  it('Classic skips host confirm and the reaction window', () => {
    expect(firstRound(phaseRules(classic))).toEqual(['ROLE_REVEAL', 'NIGHT_SUBMIT', 'DAY_ANNOUNCE', 'DAY_DISCUSSION', 'VOTING', 'NIGHT_SUBMIT']);
  });
});

describe('transition table', () => {
  const windowSets = [
    rules(),
    rules({ hostConfirm: true }),
    rules({ reaction: true }),
    rules({ hostConfirm: true, reaction: true }),
    rules({ votingEnabled: false }),
  ];

  function results(step: CloseStep): CloseResult[] {
    if (step.kind === 'ADVANCE') return [step];
    if (step.kind === 'RESOLVE_NIGHT') return [true, false].map((gameOver) => ({ ...step, gameOver }));
    return [true, false].flatMap((gameOver) => [true, false].map((tied) => ({ ...step, gameOver, tied })));
  }

  it('every close the machine can make is a listed transition', () => {
    for (const r of windowSets) {
      for (const phase of CLOSABLE_PHASES) {
        for (const result of results(planClose(phase, r))) {
          const next = positionAfter(at(phase, 2), result);
          expect(canTransition(phase, next.phase), `${phase} -> ${next.phase}`).toBe(true);
        }
      }
    }
  });

  it('lets every active phase be cancelled, and nothing leave an end state', () => {
    for (const phase of CLOSABLE_PHASES) expect(canTransition(phase, 'CANCELLED')).toBe(true);
    expect(canTransition('LOBBY', 'CANCELLED')).toBe(true);
    expect(PHASE_TRANSITIONS.FINISHED).toEqual([]);
    expect(PHASE_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('rejects skipping a window or going backwards', () => {
    expect(canTransition('LOBBY', 'NIGHT_SUBMIT')).toBe(false);
    expect(canTransition('ROLE_REVEAL', 'DAY_ANNOUNCE')).toBe(false);
    expect(canTransition('NIGHT_REACTION', 'NIGHT_HOST_CONFIRM')).toBe(false);
    expect(canTransition('DAY_ANNOUNCE', 'VOTING')).toBe(false);
    expect(canTransition('REVOTE', 'REVOTE')).toBe(false);
    expect(canTransition('FINISHED', 'NIGHT_SUBMIT')).toBe(false);
  });

  it('only resolving phases can finish the game', () => {
    const finishing = (Object.keys(PHASE_TRANSITIONS) as GamePhase[]).filter((p) => canTransition(p, 'FINISHED'));
    expect(finishing.sort()).toEqual(['DAY_DISCUSSION', 'NIGHT_HOST_CONFIRM', 'NIGHT_REACTION', 'NIGHT_SUBMIT', 'REVOTE', 'VOTING'].sort());
  });
});

describe('phaseDeadline', () => {
  const now = new Date('2026-11-11T20:00:00.000Z');
  const timed = phaseRules({ ...classic, pacing: 'TIMED', timers: { nightSeconds: 90, daySeconds: 180, voteSeconds: 60 } });

  it('uses the three configured timers in timed games', () => {
    expect(phaseDeadline('NIGHT_SUBMIT', timed, now)?.toISOString()).toBe('2026-11-11T20:01:30.000Z');
    expect(phaseDeadline('DAY_DISCUSSION', timed, now)?.toISOString()).toBe('2026-11-11T20:03:00.000Z');
    expect(phaseDeadline('VOTING', timed, now)?.toISOString()).toBe('2026-11-11T20:01:00.000Z');
    expect(phaseDeadline('REVOTE', timed, now)?.toISOString()).toBe('2026-11-11T20:01:00.000Z');
  });

  it('leaves the phases that need a person open until the host closes them', () => {
    const waiting: ClosablePhase[] = ['ROLE_REVEAL', 'NIGHT_HOST_CONFIRM', 'NIGHT_REACTION', 'DAY_ANNOUNCE'];
    for (const phase of waiting) expect(phaseDeadline(phase, timed, now)).toBeNull();
  });

  it('never sets a deadline in a host-paced game', () => {
    const hostPaced = phaseRules(infection);
    expect(hostPaced.pacing).toBe('HOST');
    for (const phase of GAME_PHASES) expect(phaseDeadline(phase, hostPaced, now)).toBeNull();
  });

  it('needs timers to time anything', () => {
    expect(phaseDeadline('NIGHT_SUBMIT', { ...timed, timers: null }, now)).toBeNull();
  });
});
