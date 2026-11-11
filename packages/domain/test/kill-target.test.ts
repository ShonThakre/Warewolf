import { describe, expect, it } from 'vitest';
import { finalWolfTarget, hostDecisionProblem, packKillCandidates } from '../src/index.js';
import { CLASSIC_SEATS, EXPANDED_SEATS, INFECTION_SEATS, act, classicConfig, infectionConfig, table, target, type Table } from './support/night.js';

/** WW-803: what the host may confirm, and what the informed Doctor is shown. */

const input = (t: Table, actions: ReturnType<typeof act>[], config = infectionConfig) => ({ config, ...t, actions });

describe('packKillCandidates', () => {
  it('lists each named player once with every wolf who named them, sorted', () => {
    const t = table(INFECTION_SEATS, { wolves: ['v13', 'v14'] });
    const candidates = packKillCandidates(input(t, [act('v14', 'infected_kill', ['v1']), act('alpha', 'alpha_kill', ['v1']), act('v13', 'infected_kill', ['v2'])]));
    expect(candidates).toEqual([
      { playerId: 'v1', submittedBy: ['alpha', 'v14'] },
      { playerId: 'v2', submittedBy: ['v13'] },
    ]);
  });

  it('leaves out other abilities, the reaction window, the dead, and pack members without friendly fire', () => {
    const t = table(CLASSIC_SEATS, { dead: ['v2'] });
    const actions = [
      act('wolf1', 'pack_kill', ['wolf2']),
      act('wolf2', 'pack_kill', ['v2']),
      act('seeker1', 'seeker_investigate', ['v3']),
      act('doctor', 'doctor_save', ['v4']),
    ];
    expect(packKillCandidates(input(t, actions, classicConfig))).toEqual([]);
    expect(packKillCandidates(input(t, [act('wolf1', 'pack_kill', ['v1'], 'NIGHT_REACTION')], classicConfig))).toEqual([]);
  });

  it('keeps friendly fire when the configuration allows it (C-08)', () => {
    const t = table(INFECTION_SEATS, { wolves: ['v14'] });
    expect(packKillCandidates(input(t, [act('alpha', 'alpha_kill', ['v14'])]))).toEqual([{ playerId: 'v14', submittedBy: ['alpha'] }]);
  });

  it('never offers the Lone Wolf\'s separate kill', () => {
    expect(packKillCandidates(input(table(EXPANDED_SEATS), [act('lone', 'lone_kill', ['v1'])], classicConfig))).toEqual([]);
  });
});

describe('hostDecisionProblem', () => {
  const candidates = [{ playerId: 'v1', submittedBy: ['alpha'] }];
  it('accepts a submitted target or no kill, and refuses anyone else', () => {
    expect(hostDecisionProblem(target('v1'), candidates)).toBeNull();
    expect(hostDecisionProblem({ kind: 'NO_KILL' }, [])).toBeNull();
    expect(hostDecisionProblem(target('v2'), candidates)).toBe('NOT_SUBMITTED');
  });
});

describe('finalWolfTarget', () => {
  const night = (t: Table, actions: ReturnType<typeof act>[], extra: object = {}) =>
    finalWolfTarget({ round: 1, config: infectionConfig, ...t, actions, hostDecision: null, infection: { successes: 0, sealed: false }, ...extra });

  it('is the host\'s confirmed target, or nobody on no kill', () => {
    const t = table(INFECTION_SEATS);
    const kill = [act('alpha', 'alpha_kill', ['seeker1'])];
    expect(night(t, kill, { hostDecision: target('seeker1') })).toBe('seeker1');
    expect(night(t, kill, { hostDecision: { kind: 'NO_KILL' } })).toBeNull();
  });

  it('ignores the reaction window\'s own actions', () => {
    const t = table(INFECTION_SEATS);
    expect(night(t, [act('alpha', 'alpha_kill', ['v1']), act('doctor', 'doctor_save', [], 'NIGHT_REACTION')], { hostDecision: target('v1') })).toBe('v1');
  });

  it('applies tonight\'s blocks, as step 4 will', () => {
    const t = table([...INFECTION_SEATS.slice(0, 19), { id: 'disruptor', roleId: 'disruptor', faction: 'VILLAGE' }]);
    const actions = [act('alpha', 'alpha_kill', ['v1']), act('disruptor', 'disruptor_block', ['alpha'])];
    expect(night(t, actions, { hostDecision: target('v1') })).toBeNull();
  });
});
