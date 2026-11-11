import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, type GameConfiguration, type NightEffect } from '../src/index.js';
import {
  EXPANDED_SEATS,
  INFECTION_SEATS,
  act,
  classicConfig,
  deaths,
  infectionConfig,
  night,
  statusOf,
  table,
  target,
  update,
  used,
  withAbility,
  type Seat,
  type Table,
} from './support/night.js';

/**
 * WW-801: the steps the expanded roles need (night-resolution.md, section 2):
 * blocks (2), traps (6), the Bodyguard (8), Immortal (11), Cursed (14),
 * copies and inheritance (15), the Avenger (16), every information kind,
 * delayed poison, and the Blacksmith item. Majority aggregation, so one
 * wolf's submission is the pack's target.
 */

const expandedConfig: GameConfiguration = { ...classicConfig, teams: { ...classicConfig.teams, wolfCap: 4 } };
const toggled = (toggles: Partial<GameConfiguration['night']['toggles']>, base: GameConfiguration = expandedConfig): GameConfiguration => ({
  ...base,
  night: { ...base.night, toggles: { ...base.night.toggles, ...toggles } },
});

const T = table(EXPANDED_SEATS);
const run = (actions: Parameters<typeof night>[1], extra: Parameters<typeof night>[2] = {}, t: Table = T) => night(t, actions, { config: expandedConfig, ...extra });
const def = (roleId: string, abilityId: string, profileId?: string) => {
  const role = DEFAULT_CATALOG.byId.get(roleId)!;
  return role.profiles[profileId ?? role.defaultProfileId]!.abilities.find((a) => a.id === abilityId)!;
};
const effect = (e: Partial<NightEffect> & Pick<NightEffect, 'id' | 'kind' | 'targetPlayerId'>): NightEffect => ({
  sourcePlayerId: 'source',
  sourceAbilityInstanceId: 'source:ability',
  createdRound: 1,
  dueRound: null,
  duePhase: null,
  attackTypes: [],
  ...e,
});

describe('step 2: blocks (OD-30)', () => {
  it('cancels every special action of the blocked player; only the Disruptor spends', () => {
    const check = act('detective', 'detective_investigate', ['wolf1']);
    const block = act('disruptor', 'disruptor_block', ['detective']);
    const r = run([check, block]);
    expect(r.blocks).toEqual([{ actionId: block.id, actorId: 'disruptor', targetId: 'detective', cancelledActionIds: [check.id], informTarget: false }]);
    expect(statusOf(r, check.id)).toEqual({ actionId: check.id, status: 'REJECTED', reason: 'BLOCKED' });
    expect(r.investigations).toEqual([]);
    expect(update(r, 'detective:detective_investigate')).toBeUndefined();
    expect(update(r, 'disruptor:disruptor_block')).toMatchObject({ chargesRemaining: 0, status: 'EXHAUSTED' });
  });

  it('removes a blocked wolf from the pack count', () => {
    const kills = [act('wolf1', 'pack_kill', ['v1']), act('wolf2', 'pack_kill', ['v2'])];
    expect(deaths(run(kills))).toEqual([]);
    expect(deaths(run([...kills, act('disruptor', 'disruptor_block', ['wolf2'])]))).toEqual(['v1']);
  });

  it('cancels a blocked Alpha\'s infection, which fails as BLOCKED and spends nothing', () => {
    const t = table([...INFECTION_SEATS.slice(0, 19), { id: 'disruptor', roleId: 'disruptor', faction: 'VILLAGE' }]);
    const infect = act('alpha', 'alpha_infect', ['v1']);
    const r = night(t, [infect, act('disruptor', 'disruptor_block', ['alpha'])]);
    expect(r.infection).toEqual({ actionId: infect.id, actorId: 'alpha', targetId: 'v1', outcome: 'FAILED', reason: 'BLOCKED' });
    expect(r.conversions).toEqual([]);
    expect(statusOf(r, infect.id)?.reason).toBe('BLOCKED');
    expect(update(r, 'alpha:alpha_infect')).toBeUndefined();
  });

  it('tells the blocked player only when the configuration says so', () => {
    const actions = [act('disruptor', 'disruptor_block', ['v1'])];
    expect(run(actions).blocks[0]?.informTarget).toBe(false);
    expect(run(actions, { config: toggled({ informBlockedPlayer: true }) }).blocks[0]?.informTarget).toBe(true);
  });

  it('lands two Disruptors who block each other, whichever sorts first', () => {
    const t = table([...EXPANDED_SEATS, { id: 'disruptor2', roleId: 'disruptor', faction: 'NEUTRAL' }]);
    const r = run([act('disruptor', 'disruptor_block', ['disruptor2']), act('disruptor2', 'disruptor_block', ['disruptor'])], {}, t);
    expect(r.blocks.map((b) => b.targetId)).toEqual(['disruptor2', 'disruptor']);
    expect(r.actions.map((a) => a.status)).toEqual(['RESOLVED', 'RESOLVED']);
  });
});

describe('step 6: traps (OD-15)', () => {
  it('cancels the pack kill, reports the attackers, and spends a charge', () => {
    const trap = act('trapper', 'trapper_trap', ['v1']);
    const r = run([trap, act('wolf1', 'pack_kill', ['v1']), act('wolf2', 'pack_kill', ['v1'])]);
    expect(deaths(r)).toEqual([]);
    expect(r.investigations).toEqual([
      { actionId: trap.id, actorId: 'trapper', abilityInstanceId: 'trapper:trapper_trap', abilityId: 'trapper_trap', targetPlayerIds: ['v1'], kind: 'ATTACKER_IDS', value: ['wolf1', 'wolf2'] },
    ]);
    expect(r.saves).toEqual([{ playerId: 'v1', attackType: 'WOLF_KILL', savedBy: ['trapper:trapper_trap'] }]);
    expect(update(r, 'trapper:trapper_trap')).toMatchObject({ chargesRemaining: 1, usesConsumed: 1 });
  });

  it('triggers on any wolf who named the trapped player, even without a final target', () => {
    const r = run([act('trapper', 'trapper_trap', ['v2']), act('wolf1', 'pack_kill', ['v1']), act('wolf2', 'pack_kill', ['v2'])]);
    expect(r.finalWolfTarget).toBeNull();
    expect(r.investigations[0]).toMatchObject({ kind: 'ATTACKER_IDS', value: ['wolf2'] });
  });

  it('spends nothing when it does not trigger, and ignores the Lone Wolf', () => {
    const quiet = run([act('trapper', 'trapper_trap', ['v3']), act('wolf1', 'pack_kill', ['v1'])]);
    expect(deaths(quiet)).toEqual(['v1']);
    expect(quiet.investigations).toEqual([]);
    expect(update(quiet, 'trapper:trapper_trap')).toBeUndefined();

    const lone = run([act('trapper', 'trapper_trap', ['v1']), act('lone', 'lone_kill', ['v1'])]);
    expect(deaths(lone)).toEqual(['v1']);
    expect(update(lone, 'trapper:trapper_trap')).toBeUndefined();
  });

  it('does not stop infection', () => {
    const t = table([...INFECTION_SEATS.slice(0, 19), { id: 'trapper', roleId: 'trapper' }]);
    const r = night(t, [act('trapper', 'trapper_trap', ['v1']), act('alpha', 'alpha_kill', ['v1']), act('alpha', 'alpha_infect', ['v1'])], { hostDecision: target('v1') });
    expect(deaths(r)).toEqual([]);
    expect(r.conversions.map((c) => c.playerId)).toEqual(['v1']);
  });
});

describe('step 8: Bodyguard (OD-14)', () => {
  it('takes the wolf kill aimed at the protectee', () => {
    const r = run([act('bodyguard', 'bodyguard_protect', ['v1']), act('wolf1', 'pack_kill', ['v1'])]);
    expect(r.deaths).toEqual([{ playerId: 'bodyguard', causes: ['WOLF_KILL'], attackers: [{ type: 'WOLF_KILL', via: 'REDIRECT', actorIds: ['wolf1'] }], roleIdAtDeath: 'bodyguard' }]);
    expect(r.redirects).toEqual([{ fromPlayerId: 'v1', toPlayerId: 'bodyguard', attackType: 'WOLF_KILL', abilityInstanceId: 'bodyguard:bodyguard_protect' }]);
    expect(r.saves).toEqual([{ playerId: 'v1', attackType: 'WOLF_KILL', savedBy: ['bodyguard:bodyguard_protect'] }]);
  });

  it('survives when the Bodyguard is protected too', () => {
    const r = run([act('bodyguard', 'bodyguard_protect', ['v1']), act('guard', 'guard_protect', ['bodyguard']), act('wolf1', 'pack_kill', ['v1'])]);
    expect(deaths(r)).toEqual([]);
    expect(r.saves).toEqual([
      { playerId: 'v1', attackType: 'WOLF_KILL', savedBy: ['bodyguard:bodyguard_protect'] },
      { playerId: 'bodyguard', attackType: 'WOLF_KILL', savedBy: ['guard:guard_protect'] },
    ]);
  });

  it('does not take a hit a heal already answers, and still spends the night', () => {
    const r = run([act('bodyguard', 'bodyguard_protect', ['v1']), act('doctor', 'doctor_save', ['v1']), act('wolf1', 'pack_kill', ['v1'])]);
    expect(deaths(r)).toEqual([]);
    expect(r.redirects).toEqual([]);
    expect(r.saves).toEqual([{ playerId: 'v1', attackType: 'WOLF_KILL', savedBy: ['doctor:doctor_save'] }]);
    expect(update(r, 'bodyguard:bodyguard_protect')).toEqual(used('v1'));
  });

  it('redirects poison only when configured', () => {
    const actions = [act('bodyguard', 'bodyguard_protect', ['v1']), act('witch', 'witch_poison', ['v1'])];
    expect(deaths(run(actions))).toEqual(['v1']);
    expect(deaths(run(actions, { config: toggled({ bodyguardRedirectsPoison: true }) }))).toEqual(['bodyguard']);
  });

  it('lets an Immortal Bodyguard live through the redirect', () => {
    const t = table([...EXPANDED_SEATS.filter((s) => s.id !== 'bodyguard'), { id: 'bodyguard', roleId: 'bodyguard' }]);
    const immortalBodyguard = { ...t, abilities: [...t.abilities, { ...T.abilities.find((a) => a.id === 'immortal:immortal_survive')!, id: 'bodyguard:immortal_survive', playerId: 'bodyguard' }] };
    const r = run([act('bodyguard', 'bodyguard_protect', ['v1']), act('wolf1', 'pack_kill', ['v1'])], {}, immortalBodyguard);
    expect(deaths(r)).toEqual([]);
    expect(update(r, 'bodyguard:immortal_survive')).toMatchObject({ chargesRemaining: 0 });
  });
});

describe('step 11: Immortal (OD-12)', () => {
  it('clears every lethal of the night with one charge', () => {
    const r = run([act('wolf1', 'pack_kill', ['immortal']), act('witch', 'witch_poison', ['immortal'])]);
    expect(deaths(r)).toEqual([]);
    expect(r.saves).toEqual([
      { playerId: 'immortal', attackType: 'WOLF_KILL', savedBy: ['immortal:immortal_survive'] },
      { playerId: 'immortal', attackType: 'POISON', savedBy: ['immortal:immortal_survive'] },
    ]);
    expect(update(r, 'immortal:immortal_survive')).toEqual({ chargesRemaining: 0, usesConsumed: 1, lastUsedRound: 1, lastTargetPlayerId: null, status: 'EXHAUSTED' });
  });

  it('keeps the charge when protection already saved them', () => {
    const r = run([act('wolf1', 'pack_kill', ['immortal']), act('guard', 'guard_protect', ['immortal'])]);
    expect(deaths(r)).toEqual([]);
    expect(update(r, 'immortal:immortal_survive')).toBeUndefined();
  });

  it('dies once the charge is gone', () => {
    const spent = withAbility(T, 'immortal:immortal_survive', { chargesRemaining: 0, status: 'EXHAUSTED' });
    expect(deaths(run([act('wolf1', 'pack_kill', ['immortal'])], {}, spent))).toEqual(['immortal']);
  });
});

describe('step 14: Cursed (OD-06)', () => {
  it('converts after a wolf attack that a protection stopped', () => {
    const r = run([act('wolf1', 'pack_kill', ['cursed']), act('guard', 'guard_protect', ['cursed'])]);
    expect(deaths(r)).toEqual([]);
    expect(r.conversions).toEqual([
      {
        playerId: 'cursed',
        fromRoleId: 'cursed_villager',
        fromFaction: 'VILLAGE',
        toRoleId: 'infected_wolf',
        toProfileId: 'infected_wolf',
        toFaction: 'WOLF_PACK',
        wolfAligned: true,
        individualVictory: null,
        cause: 'CURSED',
      },
    ]);
    expect(r.grants).toMatchObject([{ playerId: 'cursed', abilityId: 'infected_kill', availableFromRound: 2, source: 'NATIVE' }]);
    expect(update(r, 'cursed:cursed_conversion')).toEqual({ chargesRemaining: 0, usesConsumed: 1, lastUsedRound: 1, lastTargetPlayerId: null, status: 'REVOKED', revokedReason: 'CURSED' });
    // Alpha infection's success count is not touched.
    expect(r.infectionState.successes).toBe(0);
  });

  it('converts when a Bodyguard took the hit, and not when the attack killed', () => {
    expect(run([act('wolf1', 'pack_kill', ['cursed']), act('bodyguard', 'bodyguard_protect', ['cursed'])]).conversions.map((c) => c.playerId)).toEqual(['cursed']);
    const killed = run([act('wolf1', 'pack_kill', ['cursed'])]);
    expect(deaths(killed)).toEqual(['cursed']);
    expect(killed.conversions).toEqual([]);
  });

  it('stays a villager when the pack is full, and spends nothing', () => {
    const r = run([act('wolf1', 'pack_kill', ['cursed']), act('guard', 'guard_protect', ['cursed'])], { config: classicConfig });
    expect(r.conversions).toEqual([]);
    expect(r.cursedFailures).toEqual([{ playerId: 'cursed', reason: 'CAP_SIZE' }]);
    expect(update(r, 'cursed:cursed_conversion')).toBeUndefined();
  });

  it('checks the cap after the Alpha\'s conversion (game-rules.md, "Multiple conversions")', () => {
    const t = table([...INFECTION_SEATS.slice(0, 19), { id: 'cursed', roleId: 'cursed_villager' }], { wolves: ['v11', 'v12', 'v13'] });
    const r = night(t, [act('alpha', 'alpha_kill', ['cursed']), act('guard', 'guard_protect', ['cursed']), act('alpha', 'alpha_infect', ['v1'])], {
      hostDecision: target('cursed'),
      infection: { successes: 3, sealed: false },
    });
    expect(r.conversions.map((c) => [c.playerId, c.cause])).toEqual([['v1', 'INFECTION']]);
    expect(r.cursedFailures).toEqual([{ playerId: 'cursed', reason: 'CAP_SIZE' }]);
  });
});

describe('step 15: Shapeshifter (OD-31, OD-58)', () => {
  it('copies the target\'s active abilities for the next night, with fresh charges', () => {
    const t = withAbility(T, 'detective:detective_investigate', { chargesRemaining: 1, usesConsumed: 1 });
    const copy = act('shifter', 'shapeshifter_copy', ['detective']);
    const r = run([copy], {}, t);
    expect(r.copies).toEqual([{ actionId: copy.id, actorId: 'shifter', targetId: 'detective', abilityIds: ['detective_investigate'] }]);
    expect(r.grants).toEqual([
      {
        playerId: 'shifter',
        abilityId: 'detective_investigate',
        definition: def('detective', 'detective_investigate'),
        chargesRemaining: 2,
        availableFromRound: 2,
        expiresRound: 2,
        source: 'COPY',
        sourcePlayerId: 'detective',
      },
    ]);
    expect(update(r, 'shifter:shapeshifter_copy')).toEqual(used('detective'));
  });

  it('never copies infection, another copier, or the informed veto unless allowed', () => {
    const seats: Seat[] = [...INFECTION_SEATS.slice(0, 18), { id: 'shifter', roleId: 'shapeshifter' }, { id: 'shifter2', roleId: 'shapeshifter' }];
    const t = table(seats);
    const copied = (targetId: string, config: GameConfiguration = infectionConfig) => night(t, [act('shifter', 'shapeshifter_copy', [targetId])], { config }).copies[0]?.abilityIds;
    expect(copied('alpha')).toEqual(['alpha_kill']);
    expect(copied('shifter2')).toEqual([]);
    expect(copied('doctor')).toEqual([]);
    expect(copied('doctor', toggled({ copyInformedDoctor: true }, infectionConfig))).toEqual(['doctor_save']);
  });

  it('copies nothing from a player whose abilities are copies (no chains)', () => {
    const t = { ...T, abilities: [...T.abilities, { ...T.abilities.find((a) => a.id === 'detective:detective_investigate')!, id: 'v1:copy', playerId: 'v1', source: 'COPY' as const }] };
    expect(run([act('shifter', 'shapeshifter_copy', ['v1'])], {}, t).copies[0]?.abilityIds).toEqual([]);
  });

  it('loses its copies when infected', () => {
    const t = table([...INFECTION_SEATS.slice(0, 19), { id: 'shifter', roleId: 'shapeshifter', faction: 'VILLAGE' }]);
    const kill = def('alpha_wolf', 'alpha_kill');
    const withCopy = { ...t, abilities: [...t.abilities, { ...t.abilities.find((a) => a.id === 'alpha:alpha_kill')!, id: 'shifter:copy', playerId: 'shifter', source: 'COPY' as const, config: kill }] };
    const r = night(withCopy, [act('alpha', 'alpha_infect', ['shifter'])]);
    expect(r.conversions.map((c) => c.playerId)).toEqual(['shifter']);
    expect(update(r, 'shifter:copy')).toEqual({ status: 'REVOKED', revokedReason: 'INFECTION' });
    expect(update(r, 'shifter:shapeshifter_copy')).toEqual({ status: 'REVOKED', revokedReason: 'INFECTION' });
  });
});

describe('step 15: Healer Assistant (OD-32)', () => {
  it('is idle while the Doctor lives', () => {
    const r = run([act('doctor', 'doctor_save', ['v1'])]);
    expect(r.inheritances).toEqual([]);
    expect(update(r, 'assistant:assistant_inherit')).toBeUndefined();
  });

  it('takes over a Doctor killed tonight, with the charges left after tonight', () => {
    const r = run([act('doctor', 'doctor_save', ['v1']), act('wolf1', 'pack_kill', ['doctor'])]);
    expect(deaths(r)).toEqual(['doctor']);
    expect(r.inheritances).toEqual([{ playerId: 'assistant', fromPlayerId: 'doctor', abilityIds: ['doctor_save'] }]);
    expect(r.grants).toEqual([
      {
        playerId: 'assistant',
        abilityId: 'doctor_save',
        definition: def('doctor', 'doctor_save', 'doctor_limited'),
        chargesRemaining: 1,
        availableFromRound: 2,
        expiresRound: null,
        source: 'INHERITED',
        sourcePlayerId: 'doctor',
      },
    ]);
    expect(update(r, 'assistant:assistant_inherit')).toMatchObject({ chargesRemaining: 0, status: 'EXHAUSTED' });
  });

  it('takes over an infected Doctor\'s unlimited veto', () => {
    const t = table([...INFECTION_SEATS.slice(0, 19), { id: 'assistant', roleId: 'healer_assistant' }]);
    const r = night(t, [act('alpha', 'alpha_infect', ['doctor'])]);
    expect(r.grants.filter((g) => g.source === 'INHERITED')).toMatchObject([{ playerId: 'assistant', abilityId: 'doctor_save', chargesRemaining: null, sourcePlayerId: 'doctor' }]);
  });
});

describe('step 16: Avenger (OD-13)', () => {
  it('queues revenge on a single named killer for the next night', () => {
    const r = run([act('lone', 'lone_kill', ['avenger'])]);
    expect(r.revenges).toEqual([{ avengerId: 'avenger', targetId: 'lone' }]);
    expect(r.newEffects).toEqual([
      { kind: 'REVENGE', sourcePlayerId: 'avenger', sourceAbilityInstanceId: 'avenger:avenger_revenge', targetPlayerId: 'lone', createdRound: 1, dueRound: 2, duePhase: 'NIGHT', attackTypes: ['REVENGE'] },
    ]);
    expect(update(r, 'avenger:avenger_revenge')).toMatchObject({ chargesRemaining: 0, status: 'EXHAUSTED' });
  });

  it('spends the revenge on an anonymous pack kill, or on two killers', () => {
    expect(run([act('wolf1', 'pack_kill', ['avenger'])]).revenges).toEqual([{ avengerId: 'avenger', targetId: null }]);
    const two = run([act('lone', 'lone_kill', ['avenger']), act('witch', 'witch_poison', ['avenger'])]);
    expect(two.revenges).toEqual([{ avengerId: 'avenger', targetId: null }]);
    expect(two.newEffects).toEqual([]);
  });

  it('lands the next night; protection that does not list REVENGE does not stop it, Immortal does', () => {
    const dead = table(EXPANDED_SEATS, { dead: ['avenger'] });
    const revenge = (targetPlayerId: string) => effect({ id: 'e1', kind: 'REVENGE', targetPlayerId, sourcePlayerId: 'avenger', dueRound: 2, duePhase: 'NIGHT', attackTypes: ['REVENGE'] });
    const r = run([act('guard', 'guard_protect', ['lone'])], { round: 2, effects: [revenge('lone')] }, dead);
    expect(r.deaths).toEqual([{ playerId: 'lone', causes: ['REVENGE'], attackers: [{ type: 'REVENGE', via: 'EFFECT', actorIds: ['avenger'] }], roleIdAtDeath: 'lone_wolf' }]);
    expect(r.closedEffects).toEqual([{ effectId: 'e1', status: 'SPENT' }]);
    expect(deaths(run([], { round: 2, effects: [revenge('immortal')] }, dead))).toEqual([]);
  });

  it('expires when its target is already dead', () => {
    const t = table(EXPANDED_SEATS, { dead: ['avenger', 'lone'] });
    const r = run([], { round: 2, effects: [effect({ id: 'e1', kind: 'REVENGE', targetPlayerId: 'lone', dueRound: 2, duePhase: 'NIGHT', attackTypes: ['REVENGE'] })] }, t);
    expect(r.deaths).toEqual([]);
    expect(r.closedEffects).toEqual([{ effectId: 'e1', status: 'EXPIRED' }]);
  });
});

describe('delayed poison (OD-28)', () => {
  it('schedules the Poisoner\'s poison for the end of the next day', () => {
    const r = run([act('poisoner', 'poisoner_poison', ['v1'])]);
    expect(deaths(r)).toEqual([]);
    expect(r.newEffects).toEqual([
      { kind: 'POISON', sourcePlayerId: 'poisoner', sourceAbilityInstanceId: 'poisoner:poisoner_poison', targetPlayerId: 'v1', createdRound: 1, dueRound: 1, duePhase: 'DAY', attackTypes: ['POISON'] },
    ]);
    expect(update(r, 'poisoner:poisoner_poison')).toMatchObject({ chargesRemaining: 0, status: 'EXHAUSTED' });
  });

  it('lands at the next dawn when configured, past a Guard', () => {
    const dawn = table(EXPANDED_SEATS.map((s) => (s.id === 'poisoner' ? { ...s, overrides: { poisoner_poison: { config: { delay: 'NEXT_DAWN' } } } } : s)));
    expect(run([act('poisoner', 'poisoner_poison', ['v1'])], {}, dawn).newEffects[0]).toMatchObject({ dueRound: 2, duePhase: 'NIGHT' });
    const due = effect({ id: 'p1', kind: 'POISON', targetPlayerId: 'v1', sourcePlayerId: 'poisoner', dueRound: 2, duePhase: 'NIGHT', attackTypes: ['POISON'] });
    const r = run([act('guard', 'guard_protect', ['v1'])], { round: 2, effects: [due] });
    expect(r.deaths).toMatchObject([{ playerId: 'v1', causes: ['POISON'], attackers: [{ via: 'EFFECT', actorIds: ['poisoner'] }] }]);
    expect(r.closedEffects).toEqual([{ effectId: 'p1', status: 'SPENT' }]);
  });

  it('is cured on the night it is given only by an ability that cancels POISON', () => {
    const r = run([act('poisoner', 'poisoner_poison', ['v1']), act('guard', 'guard_protect', ['v1'])], { config: toggled({ protectionBlocksPoison: true }) });
    expect(r.newEffects).toEqual([]);
    expect(r.saves).toEqual([{ playerId: 'v1', attackType: 'POISON', savedBy: ['guard:guard_protect'] }]);
  });

  it('leaves a poison due in the day to the day resolution', () => {
    const due = effect({ id: 'p1', kind: 'POISON', targetPlayerId: 'v1', dueRound: 1, duePhase: 'DAY', attackTypes: ['POISON'] });
    const r = run([], { effects: [due] });
    expect(r.deaths).toEqual([]);
    expect(r.closedEffects).toEqual([]);
  });
});

describe('Blacksmith item (OD-16)', () => {
  const shield = (targetPlayerId: string) =>
    effect({ id: 's1', kind: 'SHIELD', targetPlayerId, sourcePlayerId: 'smith', sourceAbilityInstanceId: 'smith:blacksmith_shield', attackTypes: ['WOLF_KILL'] });

  it('stays on its holder when it blocks nothing on the night it is given', () => {
    const r = run([act('smith', 'blacksmith_shield', ['v1'])]);
    expect(r.newEffects).toEqual([
      { kind: 'SHIELD', sourcePlayerId: 'smith', sourceAbilityInstanceId: 'smith:blacksmith_shield', targetPlayerId: 'v1', createdRound: 1, dueRound: null, duePhase: null, attackTypes: ['WOLF_KILL'] },
    ]);
    expect(update(r, 'smith:blacksmith_shield')).toMatchObject({ chargesRemaining: 0, status: 'EXHAUSTED' });
  });

  it('is spent when it blocks, on that night or a later one', () => {
    const tonight = run([act('smith', 'blacksmith_shield', ['v1']), act('wolf1', 'pack_kill', ['v1'])]);
    expect(deaths(tonight)).toEqual([]);
    expect(tonight.newEffects).toEqual([]);

    const later = run([act('wolf1', 'pack_kill', ['v1'])], { round: 3, effects: [shield('v1')] });
    expect(deaths(later)).toEqual([]);
    expect(later.saves).toEqual([{ playerId: 'v1', attackType: 'WOLF_KILL', savedBy: ['smith:blacksmith_shield'] }]);
    expect(later.closedEffects).toEqual([{ effectId: 's1', status: 'SPENT' }]);
  });

  it('is gone when its holder dies, and does not stop poison', () => {
    const poisoned = run([act('witch', 'witch_poison', ['v1'])], { round: 3, effects: [shield('v1')] });
    expect(deaths(poisoned)).toEqual(['v1']);
    expect(poisoned.closedEffects).toEqual([{ effectId: 's1', status: 'EXPIRED' }]);
    expect(run([], { round: 3, effects: [shield('v1')] }, table(EXPANDED_SEATS, { dead: ['v1'] })).closedEffects).toEqual([{ effectId: 's1', status: 'EXPIRED' }]);
  });
});

describe('information (OD-19, OD-21 to OD-27)', () => {
  const answer = (playerId: string, abilityId: string, targets: string[], extra: Parameters<typeof night>[2] = {}, t: Table = T, payload = {}) =>
    run([act(playerId, abilityId, targets, 'NIGHT_SUBMIT', payload)], extra, t).investigations[0];

  it('Detective: Wolf or Non-Wolf', () => {
    expect(answer('detective', 'detective_investigate', ['wolf1'])).toMatchObject({ kind: 'ALIGNMENT_WOLF_OR_NOT', value: 'WOLF' });
    expect(answer('detective', 'detective_investigate', ['lone'])).toMatchObject({ value: 'WOLF' });
  });

  it('Oracle: the role category, by current faction', () => {
    const category = (t: string) => answer('oracle', 'oracle_investigate', [t])?.value;
    expect([category('wolf1'), category('doctor'), category('v1'), category('jester'), category('lone')]).toEqual(['WOLF', 'VILLAGE_POWER', 'VILLAGE_BASIC', 'NEUTRAL', 'INDEPENDENT']);
  });

  it('Seer: the current role id', () => {
    expect(answer('seer', 'seer_investigate', ['cursed'])).toMatchObject({ kind: 'ROLE_ID', value: 'cursed_villager' });
  });

  it('Psychic: same or different current faction', () => {
    expect(answer('psychic', 'psychic_compare', ['wolf1', 'wolf2'])).toMatchObject({ kind: 'SAME_OR_DIFFERENT_FACTION', targetPlayerIds: ['wolf1', 'wolf2'], value: 'SAME' });
    expect(answer('psychic', 'psychic_compare', ['wolf1', 'v1'])?.value).toBe('DIFFERENT');
    expect(answer('psychic', 'psychic_compare', ['jester', 'disruptor'])?.value).toBe('SAME');
  });

  it('Medium: the role a dead player died with', () => {
    expect(answer('medium', 'medium_investigate', ['seer'], {}, table(EXPANDED_SEATS, { dead: ['seer'] }))).toMatchObject({ kind: 'ROLE_AT_DEATH', value: 'seer' });
  });

  it('Prophet: yes or no on the living pack size', () => {
    const question = { question: 'WOLF_PACK_SIZE_AT_LEAST' };
    expect(answer('prophet', 'prophet_ask', [], {}, T, question)).toMatchObject({ kind: 'YES_NO', question: 'WOLF_PACK_SIZE_AT_LEAST', threshold: 3, value: false });
    const two = table(EXPANDED_SEATS.map((s) => (s.id === 'prophet' ? { ...s, overrides: { prophet_ask: { config: { packSizeAtLeast: 2 } } } } : s)));
    expect(answer('prophet', 'prophet_ask', [], {}, two, question)).toMatchObject({ threshold: 2, value: true });
  });

  it('Spy: the number of wolf-kill submissions that survived the blocks', () => {
    const spy = act('spy', 'spy_count');
    const r = run([act('wolf1', 'pack_kill', ['v1']), act('wolf2', 'pack_kill', ['v2']), act('lone', 'lone_kill', ['v3']), act('disruptor', 'disruptor_block', ['wolf2']), spy]);
    expect(r.investigations.find((i) => i.actionId === spy.id)).toMatchObject({ kind: 'WOLF_KILL_SUBMISSION_COUNT', value: 2 });
  });

  it('Tracker: the players a target visited, with types only when configured', () => {
    const actions = () => [act('wolf1', 'pack_kill', ['v1']), act('tracker', 'tracker_track', ['wolf1'])];
    expect(run(actions()).investigations[0]).toMatchObject({ kind: 'VISITED_PLAYER_IDS', value: ['v1'], visits: null });
    expect(run(actions(), { config: toggled({ trackerIncludesActionType: true }) }).investigations[0]).toMatchObject({ visits: [{ playerId: 'v1', capability: 'KILL' }] });
    const blocked = run([...actions(), act('disruptor', 'disruptor_block', ['wolf1'])]);
    expect(blocked.investigations.find((i) => i.kind === 'VISITED_PLAYER_IDS')).toMatchObject({ value: [] });
  });

  it('reads the start of the night: a Cursed player converted tonight still reads Non-Wolf', () => {
    const r = run([act('wolf1', 'pack_kill', ['cursed']), act('guard', 'guard_protect', ['cursed']), act('detective', 'detective_investigate', ['cursed'])]);
    expect(r.conversions.map((c) => c.playerId)).toEqual(['cursed']);
    expect(r.investigations[0]?.value).toBe('NOT_WOLF');
  });
});

describe('Assassin mark and determinism', () => {
  it('writes the night-1 mark and spends it (OD-09)', () => {
    const r = run([act('assassin', 'assassin_mark', ['v2'])]);
    expect(r.marks).toEqual([{ playerId: 'assassin', targetId: 'v2' }]);
    expect(update(r, 'assassin:assassin_mark')).toMatchObject({ chargesRemaining: 0, status: 'EXHAUSTED' });
  });

  it('gives the same result for the same expanded night in any order', () => {
    const actions = [
      act('wolf1', 'pack_kill', ['cursed']),
      act('lone', 'lone_kill', ['avenger']),
      act('bodyguard', 'bodyguard_protect', ['cursed']),
      act('trapper', 'trapper_trap', ['v2']),
      act('disruptor', 'disruptor_block', ['seer']),
      act('seer', 'seer_investigate', ['wolf1']),
      act('poisoner', 'poisoner_poison', ['v3']),
      act('shifter', 'shapeshifter_copy', ['tracker']),
      act('tracker', 'tracker_track', ['lone']),
      act('smith', 'blacksmith_shield', ['bodyguard']),
    ];
    const forward = run(actions);
    expect(run([...actions].reverse())).toEqual(forward);
    expect(forward.conversions.map((c) => c.playerId)).toEqual(['cursed']);
    expect(deaths(forward)).toEqual(['avenger']);
    expect(forward.revenges).toEqual([{ avengerId: 'avenger', targetId: 'lone' }]);
  });
});
