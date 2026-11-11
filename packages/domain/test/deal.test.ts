import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATALOG,
  ROLE_PACKS,
  dealRoles,
  fisherYates,
  getPack,
  validateConfiguration,
  type DealtRole,
  type GameConfiguration,
  type RandomInt,
} from '../src/index.js';

/** Small seeded PRNG (mulberry32) so statistical checks are reproducible. */
function seeded(seed: number): RandomInt {
  let a = seed >>> 0;
  return (max) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(unit * max);
  };
}

const players = (n: number) => Array.from({ length: n }, (_, i) => `player-${String(i + 1).padStart(2, '0')}`);

const countBy = <T>(items: readonly T[], key: (item: T) => string) => {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
};

const infectionCore = getPack('infection-core')!.config;
const classic = getPack('classic-10')!.config;

describe('fisherYates', () => {
  it('follows the injected random source exactly', () => {
    expect(fisherYates(['a', 'b', 'c', 'd'], () => 0)).toEqual(['b', 'c', 'd', 'a']);
    expect(fisherYates(['a', 'b', 'c', 'd'], (max) => max - 1)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not change its input', () => {
    const input = Object.freeze(['a', 'b', 'c']);
    expect(fisherYates(input, () => 0)).toHaveLength(3);
    expect(input).toEqual(['a', 'b', 'c']);
  });

  it('asks for exactly one value per swap, with a shrinking range', () => {
    const asked: number[] = [];
    fisherYates([1, 2, 3, 4, 5], (max) => (asked.push(max), 0));
    expect(asked).toEqual([5, 4, 3, 2]);
  });

  it('handles empty and single-item input without asking for randomness', () => {
    const never: RandomInt = () => {
      throw new Error('should not be called');
    };
    expect(fisherYates([], never)).toEqual([]);
    expect(fisherYates(['only'], never)).toEqual(['only']);
  });

  it.each([
    ['above the range', (max: number) => max],
    ['negative', () => -1],
    ['fractional', () => 0.5],
    ['not a number', () => Number.NaN],
  ])('rejects a random source that returns a value %s', (_label, bad) => {
    expect(() => fisherYates(['a', 'b', 'c'], bad)).toThrow(RangeError);
  });

  it('produces every permutation with equal frequency', () => {
    const random = seeded(42);
    const trials = 60_000;
    const counts = countBy(Array.from({ length: trials }, () => fisherYates(['a', 'b', 'c'], random).join('')), (p) => p);
    expect(Object.keys(counts).sort()).toEqual(['abc', 'acb', 'bac', 'bca', 'cab', 'cba']);
    for (const n of Object.values(counts)) expect(Math.abs(n - trials / 6)).toBeLessThan(trials / 6 * 0.05);
  });
});

describe('dealRoles', () => {
  it('deals the 20-player Infection Edition with the exact pack counts', () => {
    const dealt = dealRoles(infectionCore, players(20), seeded(7));
    expect(dealt).toHaveLength(20);
    expect(countBy(dealt, (d) => d.roleId)).toEqual({
      alpha_wolf: 1,
      seeker: 2,
      guard: 1,
      doctor: 1,
      witch: 1,
      normal_villager: 14,
    });
    expect(countBy(dealt, (d) => d.faction)).toEqual({ WOLF_PACK: 1, VILLAGE: 19 });
    expect(dealt.filter((d) => d.wolfAligned).map((d) => d.roleId)).toEqual(['alpha_wolf']);
  });

  it('keeps the pack counts on every shuffle', () => {
    const random = seeded(99);
    for (let i = 0; i < 200; i++) {
      const counts = countBy(dealRoles(infectionCore, players(20), random), (d) => d.roleId);
      expect(counts['alpha_wolf']).toBe(1);
      expect(counts['normal_villager']).toBe(14);
    }
  });

  it('gives each player exactly one role, in the order the players were passed', () => {
    const ids = players(20);
    const dealt = dealRoles(infectionCore, ids, seeded(3));
    expect(dealt.map((d) => d.playerId)).toEqual(ids);
  });

  it('is fully determined by the injected random source', () => {
    const a = dealRoles(infectionCore, players(20), seeded(5));
    const b = dealRoles(infectionCore, players(20), seeded(5));
    const c = dealRoles(infectionCore, players(20), seeded(6));
    expect(a).toEqual(b);
    expect(a.map((d) => d.roleId)).not.toEqual(c.map((d) => d.roleId));
  });

  it('puts the Alpha Wolf in every seat with equal frequency', () => {
    const random = seeded(2026);
    const trials = 20_000;
    const seats = Array<number>(20).fill(0);
    for (let t = 0; t < trials; t++) {
      const dealt = dealRoles(infectionCore, players(20), random);
      seats[dealt.findIndex((d) => d.roleId === 'alpha_wolf')]! += 1;
    }
    // Expected 1000 per seat; the standard deviation is about 31.
    for (const n of seats) expect(Math.abs(n - trials / 20)).toBeLessThan(150);
  });

  it('grants the dealt profile abilities with charges from the configuration', () => {
    const dealt = dealRoles(infectionCore, players(20), seeded(1));
    const by = (roleId: string) => dealt.find((d) => d.roleId === roleId)!;

    expect(by('doctor').profileId).toBe('doctor_infection');
    expect(by('doctor').abilities.map((a) => [a.abilityId, a.chargesRemaining])).toEqual([['doctor_save', null]]);
    expect(by('witch').abilities.map((a) => [a.abilityId, a.chargesRemaining])).toEqual([
      ['witch_save', 1],
      ['witch_poison', 1],
    ]);
    expect(by('alpha_wolf').abilities.map((a) => a.abilityId)).toEqual(['alpha_infect', 'alpha_kill']);
    expect(by('normal_villager').abilities).toEqual([]);
    // The frozen definition is the catalog ability when nothing is overridden.
    const catalogSave = DEFAULT_CATALOG.byId.get('witch')!.profiles['witch']!.abilities[0];
    expect(by('witch').abilities[0]!.definition).toEqual(catalogSave);
  });

  it('applies ability overrides to the granted instances', () => {
    const config: GameConfiguration = {
      ...classic,
      mode: 'CUSTOM',
      roles: classic.roles.map((e) =>
        e.roleId === 'seeker' ? { ...e, overrides: { seeker_investigate: { usesPerGame: 3, cooldownNights: 1 } } } : e,
      ),
    };
    const seeker = dealRoles(config, players(10), seeded(1)).find((d) => d.roleId === 'seeker')!;
    const investigate = seeker.abilities.find((a) => a.abilityId === 'seeker_investigate')!;
    expect(investigate.chargesRemaining).toBe(3);
    expect(investigate.definition.cooldownNights).toBe(1);
  });

  it('marks the Classic pack as wolf-aligned and team WOLF_PACK', () => {
    const wolves = dealRoles(classic, players(10), seeded(4)).filter((d) => d.roleId === 'pack_wolf');
    expect(wolves).toHaveLength(2);
    for (const w of wolves) expect(w).toMatchObject({ faction: 'WOLF_PACK', wolfAligned: true });
  });

  it.each(ROLE_PACKS.filter((p) => validateConfiguration(p.config).valid).map((p) => [p.id, p.config] as const))(
    'deals every valid pack: %s',
    (_id, config) => {
      const dealt: DealtRole[] = dealRoles(config, players(config.playerCount), seeded(11));
      const deck = config.roles.flatMap((e) => Array<string>(e.count).fill(e.roleId));
      expect(countBy(dealt, (d) => d.roleId)).toEqual(countBy(deck, (id) => id));
    },
  );

  it('refuses to deal when the seats and the roles disagree', () => {
    expect(() => dealRoles(infectionCore, players(19), seeded(1))).toThrow(/20 roles for 19 players/);
    expect(() => dealRoles(infectionCore, players(21), seeded(1))).toThrow(/20 roles for 21 players/);
  });

  it('refuses a repeated player id', () => {
    const ids = players(20);
    ids[19] = ids[0]!;
    expect(() => dealRoles(infectionCore, ids, seeded(1))).toThrow(/appears twice/);
  });

  it('refuses a role the catalog cannot resolve', () => {
    const config = { ...classic, roles: [...classic.roles.slice(1), { roleId: 'dragon', count: 2 }] };
    expect(() => dealRoles(config, players(10), seeded(1))).toThrow(/dragon does not resolve/);
  });
});
