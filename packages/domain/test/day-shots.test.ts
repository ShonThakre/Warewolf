import { describe, expect, it } from 'vitest';
import { getPack, nightShields, phaseRules, planClose, positionAfter, resolveShots, type GameConfiguration, type LifeStatus } from '../src/index.js';

/** WW-1003b, OD-29: the Sniper's day shot. */

const life = (entries: Record<string, LifeStatus>) => new Map(Object.entries(entries));

describe('nightShields', () => {
  it('covers targets of protections that cancel SNIPER, and the final wolf target for a save', () => {
    const shielded = nightShields(
      [
        { cancels: ['WOLF_KILL', 'SNIPER'], targetPlayerIds: ['guarded'], onFinalWolfTarget: false },
        { cancels: ['WOLF_KILL'], targetPlayerIds: ['witch-saved'], onFinalWolfTarget: false },
        { cancels: ['WOLF_KILL', 'SNIPER'], targetPlayerIds: [], onFinalWolfTarget: true },
      ],
      'attacked',
    );
    expect([...shielded].sort()).toEqual(['attacked', 'guarded']);
    expect(nightShields([{ cancels: ['SNIPER'], targetPlayerIds: [], onFinalWolfTarget: true }], null).size).toBe(0);
  });
});

describe('resolveShots', () => {
  it('hits, is stopped by a shield, and does not kill twice', () => {
    const shots = [
      { actionId: 'a1', actorId: 's1', targetId: 'v1' },
      { actionId: 'a2', actorId: 's2', targetId: 'v1' },
      { actionId: 'a3', actorId: 's1', targetId: 'v2' },
      { actionId: 'a4', actorId: 's1', targetId: 'dead' },
    ];
    const outcomes = resolveShots(shots, life({ v1: 'ALIVE', v2: 'ALIVE', dead: 'DEAD', s1: 'ALIVE', s2: 'ALIVE' }), new Set(['v2']));
    expect(outcomes.map((o) => o.outcome)).toEqual(['HIT', 'TARGET_DEAD', 'SHIELDED', 'TARGET_DEAD']);
  });
});

describe('phase machine with a Sniper seated', () => {
  const base = getPack('classic-10')!.config;
  const withSniper: GameConfiguration = {
    ...base,
    roles: base.roles.map((entry) => (entry.roleId === 'normal_villager' ? { ...entry, count: entry.count - 1 } : entry)).concat([{ roleId: 'sniper', count: 1 }] as never),
  };

  it('resolves day discussion before voting only when a day kill is seated', () => {
    expect(phaseRules(base).dayShots).toBe(false);
    expect(planClose('DAY_DISCUSSION', phaseRules(base))).toEqual({ kind: 'ADVANCE', to: 'VOTING' });
    expect(phaseRules(withSniper).dayShots).toBe(true);
    expect(planClose('DAY_DISCUSSION', phaseRules(withSniper))).toEqual({ kind: 'RESOLVE_DAY', ballot: 'DISCUSSION' });
  });

  it('opens voting after the shots, or ends the game when a shot decides it', () => {
    const at = { status: 'ACTIVE' as const, phase: 'DAY_DISCUSSION' as const, roundNumber: 2 };
    expect(positionAfter(at, { kind: 'RESOLVE_DAY', ballot: 'DISCUSSION', gameOver: false, tied: false })).toEqual({ status: 'ACTIVE', phase: 'VOTING', roundNumber: 2 });
    expect(positionAfter(at, { kind: 'RESOLVE_DAY', ballot: 'DISCUSSION', gameOver: true, tied: false })).toMatchObject({ status: 'FINISHED' });
  });
});
