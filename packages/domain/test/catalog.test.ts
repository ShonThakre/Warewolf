import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  DEFAULT_CATALOG,
  HANDLER_KEYS,
  catalogProblems,
  createCatalog,
  effectiveStatus,
  getProfile,
  isWolfAligned,
  type RoleDefinition,
} from '../src/index.js';
import { canonicalJson } from '../src/util/canonical.js';
import { sha256Hex } from '../src/util/sha256.js';

const roles = DEFAULT_CATALOG.roles;
const role = (id: string) => {
  const r = DEFAULT_CATALOG.byId.get(id);
  if (!r) throw new Error(`missing ${id}`);
  return r;
};
const allAbilities = roles.flatMap((r) => Object.values(r.profiles).flatMap((p) => p.abilities));

describe('sha256Hex', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
  ])('hashes the NIST vector %j', (input, expected) => {
    expect(sha256Hex(input)).toBe(expected);
  });

  it('matches node:crypto across block boundaries and multi-byte text', async () => {
    const { createHash } = await import('node:crypto');
    const inputs = [55, 56, 63, 64, 65, 119, 120, 1000].map((n) => 'x'.repeat(n));
    inputs.push('Werewolf – Infection Edition 🐺');
    for (const input of inputs) {
      expect(sha256Hex(input)).toBe(createHash('sha256').update(input, 'utf8').digest('hex'));
    }
  });
});

describe('role catalog', () => {
  it('has 37 definitions: the 36 brief roles plus pack_wolf', () => {
    expect(roles).toHaveLength(37);
    expect(roles.map((r) => r.id)).toContain('pack_wolf');
  });

  it('has unique role ids and unique ability ids', () => {
    expect(new Set(roles.map((r) => r.id)).size).toBe(roles.length);
    const owners = new Map<string, string>();
    for (const r of roles) {
      for (const a of Object.values(r.profiles).flatMap((p) => p.abilities)) {
        expect(owners.get(a.id) ?? r.id).toBe(r.id);
        owners.set(a.id, r.id);
      }
    }
  });

  it('keeps unresolved roles and profiles free of abilities', () => {
    const unresolved = roles.filter((r) => r.implementationStatus === 'UNRESOLVED').map((r) => r.id).sort();
    expect(unresolved).toEqual(['bard', 'confuser', 'hermit', 'priest']);
    for (const r of roles) {
      for (const p of Object.values(r.profiles)) {
        if (effectiveStatus(r, p) === 'UNRESOLVED') {
          expect(p.abilities, `${r.id}/${p.id}`).toEqual([]);
          expect(p.decisionIds.length + r.decisionIds.length, `${r.id}/${p.id} names its decision`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps the multi-variant roles as separate profiles', () => {
    expect(Object.keys(role('doctor').profiles).sort()).toEqual(['doctor_blind', 'doctor_infection', 'doctor_limited']);
    expect(Object.keys(role('assassin').profiles).sort()).toEqual(['assassin_execute', 'assassin_mark']);
    expect(Object.keys(role('blacksmith').profiles).sort()).toEqual(['blacksmith_aura', 'blacksmith_item']);
    expect(role('assassin').profiles['assassin_execute']?.status).toBe('UNRESOLVED');
    expect(role('blacksmith').profiles['blacksmith_aura']?.status).toBe('UNRESOLVED');
  });

  it('gives the Infection Doctor unlimited informed saves and the limited Doctor a finite count', () => {
    const infectionSave = getProfile(role('doctor'), 'doctor_infection')?.abilities[0];
    const limitedSave = getProfile(role('doctor'), 'doctor_limited')?.abilities[0];
    expect(infectionSave).toMatchObject({ usesPerGame: null, timing: 'NIGHT_REACTION', config: { mode: 'INFORMED_VETO' }, target: { kind: 'FINAL_WOLF_TARGET' } });
    expect(limitedSave).toMatchObject({ usesPerGame: 2, config: { mode: 'BLIND_TARGET' } });
    expect(role('doctor').defaultProfileId).toBe('doctor_infection');
  });

  it('encodes the confirmed Infection Edition abilities', () => {
    expect(getProfile(role('guard'))?.abilities[0]).toMatchObject({
      capability: 'PROTECT',
      cancels: ['WOLF_KILL'],
      target: { kind: 'PLAYERS', self: true, notSameAsLastRound: true },
    });
    const witch = getProfile(role('witch'))?.abilities ?? [];
    expect(witch.map((a) => [a.id, a.usesPerGame])).toEqual([
      ['witch_save', 1],
      ['witch_poison', 1],
    ]);
    const alpha = getProfile(role('alpha_wolf'))?.abilities ?? [];
    expect(alpha.map((a) => a.capability)).toEqual(['INFECT', 'KILL']);
    expect(alpha.every((a) => !a.lostOnInfection)).toBe(true);
    expect(getProfile(role('seeker'))?.abilities.map((a) => a.capability)).toEqual(['INVESTIGATE', 'ROLE_REVEAL']);
    expect(getProfile(role('normal_villager'))?.abilities).toEqual([]);
  });

  it('never seats an Infected Wolf at start', () => {
    expect(roles.filter((r) => !r.seatable).map((r) => r.id)).toEqual(['infected_wolf']);
  });

  it('reads Wolf / Non-Wolf from the faction, and from the role for the Lone Wolf', () => {
    expect(isWolfAligned(role('alpha_wolf'), 'WOLF_PACK')).toBe(true);
    expect(isWolfAligned(role('lone_wolf'), 'INDEPENDENT')).toBe(true);
    expect(isWolfAligned(role('jester'), 'NEUTRAL')).toBe(false);
    expect(isWolfAligned(role('assassin'), 'WOLF_PACK')).toBe(true);
  });

  it('marks wolves as ineligible infection targets', () => {
    for (const id of ['alpha_wolf', 'infected_wolf', 'pack_wolf', 'lone_wolf']) {
      expect(role(id).infection.whenTarget, id).toBe('INELIGIBLE');
    }
    expect(role('alpha_wolf').infection.whenSource).toBe('SEAL_INFECTION_ON_DEATH');
  });

  it('uses only known capabilities and reserved handler keys', () => {
    for (const a of allAbilities) {
      if (a.capability !== null) expect(CAPABILITIES).toContain(a.capability);
      if (a.handlerKey !== null) expect(HANDLER_KEYS).toContain(a.handlerKey);
      expect(a.capability !== null || a.handlerKey !== null, a.id).toBe(true);
    }
  });

  it('gives every neutral or independent default an individual victory, except unresolved roles', () => {
    for (const r of roles) {
      const p = getProfile(r)!;
      if ((r.defaultFaction === 'NEUTRAL' || r.defaultFaction === 'INDEPENDENT') && effectiveStatus(r, p) !== 'UNRESOLVED') {
        if (p.victory.type !== 'INDIVIDUAL') expect(['shapeshifter', 'poisoner', 'disruptor'], r.id).toContain(r.id);
      }
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(role('seeker'))).toBe(true);
    expect(() => {
      (role('seeker') as { displayName: string }).displayName = 'Changed';
    }).toThrow();
  });

  it('hashes the canonical definitions', () => {
    expect(DEFAULT_CATALOG.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(DEFAULT_CATALOG.hash).toBe(sha256Hex(canonicalJson(roles)));
    const edited = roles.map((r) => (r.id === 'mayor' ? { ...r, description: 'Changed.' } : r));
    expect(createCatalog(edited).hash).not.toBe(DEFAULT_CATALOG.hash);
    expect(createCatalog([...roles].reverse()).hash).not.toBe(DEFAULT_CATALOG.hash);
  });
});

describe('catalog integrity checks', () => {
  const seeker = role('seeker');
  const withAbility = (patch: object): RoleDefinition => {
    const p = seeker.profiles['seeker']!;
    return { ...seeker, id: 'test_role', profiles: { seeker: { ...p, abilities: [{ ...p.abilities[0]!, id: 'test_ability', ...patch }] } } };
  };

  it('accepts the default catalog', () => {
    expect(catalogProblems(roles)).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    expect(catalogProblems([seeker, seeker])).toContain('duplicate role id seeker');
  });

  it('rejects an ability with neither capability nor handler', () => {
    expect(catalogProblems([withAbility({ capability: null, handlerKey: null })]).join()).toContain('needs a capability or a handlerKey');
  });

  it('rejects per-phase uses above per-game uses', () => {
    expect(catalogProblems([withAbility({ usesPerPhase: 2, usesPerGame: 1 })]).join()).toContain('usesPerPhase above usesPerGame');
  });

  it('rejects abilities on an unresolved profile', () => {
    const blacksmith = role('blacksmith');
    const aura = { ...blacksmith.profiles['blacksmith_aura']!, abilities: blacksmith.profiles['blacksmith_item']!.abilities };
    const broken = { ...blacksmith, profiles: { ...blacksmith.profiles, blacksmith_aura: aura } };
    expect(catalogProblems([broken]).join()).toContain('unresolved profiles must have no abilities');
  });

  it('throws when building a catalog from bad definitions', () => {
    expect(() => createCatalog([seeker, seeker])).toThrow(/Invalid role catalog/);
  });
});
