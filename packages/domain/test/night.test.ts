import { describe, expect, it } from 'vitest';
import { CLASSIC_SEATS, INFECTION_SEATS, act, classicConfig, deaths, infectionConfig, night, statusOf, table, target, update, type Seat } from './support/night.js';

/**
 * The testing plan's unit matrix for Infection Edition (WW-701). The expanded
 * steps are in night-expanded.test.ts, and the section 8 golden fixtures in
 * night-golden.test.ts.
 */

describe('pack kill aggregation (step 4)', () => {
  it('host select attacks only the confirmed player, who must be among the submissions (OD-01)', () => {
    const t = table(INFECTION_SEATS, { wolves: ['v14'] });
    const kills = [act('alpha', 'alpha_kill', ['v1']), act('v14', 'infected_kill', ['v2'])];
    expect(night(t, kills, { hostDecision: target('v2') })).toMatchObject({ finalWolfTarget: 'v2', deaths: [{ playerId: 'v2', causes: ['WOLF_KILL'] }] });
    expect(night(t, kills, { hostDecision: target('v3') }).finalWolfTarget).toBeNull();
    expect(night(t, kills, { hostDecision: { kind: 'NO_KILL' } }).deaths).toEqual([]);
    expect(night(t, kills, { hostDecision: null }).deaths).toEqual([]);
  });

  it('majority takes the unique leader, and a tie kills nobody', () => {
    const t = table(CLASSIC_SEATS);
    const agree = night(t, [act('wolf1', 'pack_kill', ['v1']), act('wolf2', 'pack_kill', ['v1'])], { config: classicConfig });
    expect(deaths(agree)).toEqual(['v1']);
    const split = night(t, [act('wolf1', 'pack_kill', ['v1']), act('wolf2', 'pack_kill', ['v2'])], { config: classicConfig });
    expect(split.finalWolfTarget).toBeNull();
    expect(deaths(split)).toEqual([]);
  });

  it('friendly fire off removes pack members from the legal set', () => {
    const t = table(CLASSIC_SEATS);
    const r = night(t, [act('wolf1', 'pack_kill', ['wolf2']), act('wolf2', 'pack_kill', ['v1'])], { config: classicConfig });
    expect(r.finalWolfTarget).toBe('v1');
  });

  it('friendly fire on lets an anonymous wolf kill another wolf (C-08)', () => {
    const t = table(INFECTION_SEATS, { wolves: ['v14'] });
    expect(deaths(night(t, [act('alpha', 'alpha_kill', ['v14'])], { hostDecision: target('v14') }))).toEqual(['v14']);
  });
});

describe('capabilities', () => {
  it('Seeker learns the start-of-night alignment', () => {
    const t = table(INFECTION_SEATS, { wolves: ['v14'] });
    const r = night(t, [act('seeker1', 'seeker_investigate', ['alpha']), act('seeker2', 'seeker_investigate', ['v14'])]);
    expect(r.investigations.map((i) => [i.actorId, i.targetPlayerIds[0], i.value])).toEqual([
      ['seeker1', 'alpha', 'WOLF'],
      ['seeker2', 'v14', 'WOLF'],
    ]);
    const plain = night(t, [act('seeker1', 'seeker_investigate', ['v1'])]);
    expect(plain.investigations[0]?.value).toBe('NOT_WOLF');
  });

  it('Seeker checking tonight\'s infection target still reads Non-Wolf (OD-38)', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_infect', ['v1']), act('seeker1', 'seeker_investigate', ['v1'])]);
    expect(r.infection?.outcome).toBe('SUCCESS');
    expect(r.investigations[0]?.value).toBe('NOT_WOLF');
  });

  it('Guard protection cancels the wolf kill and not poison', () => {
    const t = table(INFECTION_SEATS);
    const guarded = night(t, [act('alpha', 'alpha_kill', ['v1']), act('guard', 'guard_protect', ['v1'])], { hostDecision: target('v1') });
    expect(deaths(guarded)).toEqual([]);
    expect(guarded.saves).toEqual([{ playerId: 'v1', attackType: 'WOLF_KILL', savedBy: ['guard:guard_protect'] }]);

    const poisoned = night(t, [act('witch', 'witch_poison', ['v2']), act('guard', 'guard_protect', ['v2'])]);
    expect(poisoned.deaths).toEqual([{ playerId: 'v2', causes: ['POISON'], attackers: [{ type: 'POISON', via: 'ABILITY', actorIds: ['witch'] }], roleIdAtDeath: 'normal_villager' }]);
  });

  it('a configuration toggle lets protection stop poison', () => {
    const t = table(INFECTION_SEATS);
    const config = { ...infectionConfig, night: { ...infectionConfig.night, toggles: { ...infectionConfig.night.toggles, protectionBlocksPoison: true } } };
    expect(deaths(night(t, [act('witch', 'witch_poison', ['v2']), act('guard', 'guard_protect', ['v2'])], { config }))).toEqual([]);
  });

  it('the informed Doctor saves the confirmed target without naming anyone (OD-02)', () => {
    const t = table(INFECTION_SEATS);
    const kill = act('alpha', 'alpha_kill', ['seeker1']);
    const save = act('doctor', 'doctor_save', [], 'NIGHT_REACTION');
    const r = night(t, [kill, save], { hostDecision: target('seeker1') });
    expect(deaths(r)).toEqual([]);
    expect(r.saves[0]).toMatchObject({ playerId: 'seeker1', savedBy: ['doctor:doctor_save'] });
  });

  it('a Doctor decline is no action, and the kill lands', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_kill', ['seeker1'])], { hostDecision: target('seeker1') });
    expect(deaths(r)).toEqual(['seeker1']);
    expect(update(r, 'doctor:doctor_save')).toBeUndefined();
  });

  it('the blind Classic Doctor saves only the player they picked', () => {
    const t = table(CLASSIC_SEATS);
    const kills = [act('wolf1', 'pack_kill', ['v1']), act('wolf2', 'pack_kill', ['v1'])];
    expect(deaths(night(t, [...kills, act('doctor', 'doctor_save', ['v1'])], { config: classicConfig }))).toEqual([]);
    expect(deaths(night(t, [...kills, act('doctor', 'doctor_save', ['v2'])], { config: classicConfig }))).toEqual(['v1']);
  });

  it('Witch save and poison on one player: the kill is saved and the poison kills (section 8)', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_kill', ['v1']), act('witch', 'witch_save', ['v1']), act('witch', 'witch_poison', ['v1'])], {
      hostDecision: target('v1'),
    });
    expect(r.deaths).toMatchObject([{ playerId: 'v1', causes: ['POISON'], roleIdAtDeath: 'normal_villager' }]);
    expect(r.saves.map((s) => s.attackType)).toEqual(['WOLF_KILL']);
  });

  it('a Villager has nothing to submit and nothing to resolve', () => {
    const t = table(INFECTION_SEATS);
    expect(t.abilities.filter((a) => a.playerId === 'v1')).toEqual([]);
    expect(night(t, []).actions).toEqual([]);
  });
});

describe('infection (step 13)', () => {
  it('converts a surviving Village target and grants the kill from the next night (C-05, C-06)', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_infect', ['seeker2'])], { round: 2 });
    expect(r.infection).toMatchObject({ actorId: 'alpha', targetId: 'seeker2', outcome: 'SUCCESS', reason: null });
    expect(r.conversions).toEqual([
      { playerId: 'seeker2', fromRoleId: 'seeker', fromFaction: 'VILLAGE', toRoleId: 'infected_wolf', toProfileId: 'infected_wolf', toFaction: 'WOLF_PACK', wolfAligned: true, individualVictory: null, cause: 'INFECTION' },
    ]);
    expect(r.grants).toMatchObject([{ playerId: 'seeker2', abilityId: 'infected_kill', availableFromRound: 3, chargesRemaining: null }]);
    expect(r.deaths).toEqual([]);
    expect(r.infectionState).toEqual({ successes: 1, sealed: false });
  });

  it('revokes the lost role\'s abilities, after tonight\'s action from that role resolved', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_infect', ['seeker1']), act('seeker1', 'seeker_investigate', ['v3'])]);
    expect(r.investigations).toHaveLength(1);
    expect(update(r, 'seeker1:seeker_investigate')).toMatchObject({ status: 'REVOKED', revokedReason: 'INFECTION', usesConsumed: 1, lastUsedRound: 1 });
    expect(update(r, 'seeker1:seeker_public_reveal')).toEqual({ status: 'REVOKED', revokedReason: 'INFECTION' });
  });

  it('loses the Witch\'s unused potions on infection (C-14)', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_infect', ['witch'])]);
    expect(update(r, 'witch:witch_save')).toMatchObject({ status: 'REVOKED' });
    expect(update(r, 'witch:witch_poison')).toMatchObject({ status: 'REVOKED' });
  });

  it('Guard protection does not stop infection, and the protected player lives and converts (C-12)', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_kill', ['v1']), act('alpha', 'alpha_infect', ['v1']), act('guard', 'guard_protect', ['v1'])], {
      hostDecision: target('v1'),
    });
    expect(deaths(r)).toEqual([]);
    expect(r.infection?.outcome).toBe('SUCCESS');
  });

  it('a target who dies tonight dies as their original role and does not count (OD-03, OD-04)', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_kill', ['v1']), act('alpha', 'alpha_infect', ['v1'])], { hostDecision: target('v1') });
    expect(r.deaths).toEqual([{ playerId: 'v1', causes: ['WOLF_KILL'], attackers: [{ type: 'WOLF_KILL', via: 'PACK', actorIds: ['alpha'] }], roleIdAtDeath: 'normal_villager' }]);
    expect(r.infection).toMatchObject({ outcome: 'FAILED', reason: 'TARGET_DEAD' });
    expect(r.infectionState.successes).toBe(0);
    // The Alpha's nightly attempt is still spent.
    expect(update(r, 'alpha:alpha_infect')).toMatchObject({ usesConsumed: 1, lastUsedRound: 1 });
  });

  it('stops at 4 successes (C-04)', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_infect', ['v1'])], { infection: { successes: 4, sealed: false } });
    expect(r.infection).toMatchObject({ outcome: 'FAILED', reason: 'CAP_SUCCESS' });
  });

  it('stops when the living pack is already at 5 (C-04)', () => {
    const t = table(INFECTION_SEATS, { wolves: ['v11', 'v12', 'v13', 'v14'] });
    const r = night(t, [act('alpha', 'alpha_infect', ['v1'])], { infection: { successes: 3, sealed: false } });
    expect(r.infection).toMatchObject({ outcome: 'FAILED', reason: 'CAP_SIZE' });
    // A dead wolf does not count toward the cap.
    const lost = table(INFECTION_SEATS, { wolves: ['v11', 'v12', 'v13', 'v14'], dead: ['v14'] });
    expect(night(lost, [act('alpha', 'alpha_infect', ['v1'])], { infection: { successes: 3, sealed: false } }).infection?.outcome).toBe('SUCCESS');
  });

  it('a wolf cannot be infected, without the submission telling the Alpha', () => {
    const t = table(INFECTION_SEATS, { wolves: ['v14'] });
    const r = night(t, [act('alpha', 'alpha_infect', ['v14'])]);
    expect(r.infection).toMatchObject({ outcome: 'FAILED', reason: 'TARGET_INELIGIBLE' });
    expect(statusOf(r, r.infection!.actionId)?.status).toBe('RESOLVED');
  });

  it('the Alpha killed tonight cannot infect, and seals infection (C-09, section 8)', () => {
    const t = table(INFECTION_SEATS, { wolves: ['v14'] });
    const r = night(t, [act('v14', 'infected_kill', ['alpha']), act('alpha', 'alpha_infect', ['v1'])], { hostDecision: target('alpha') });
    expect(deaths(r)).toEqual(['alpha']);
    expect(r.infection).toMatchObject({ outcome: 'FAILED', reason: 'ALPHA_DEAD' });
    expect(r.infectionState).toEqual({ successes: 0, sealed: true });
    expect(r.conversions).toEqual([]);
  });

  it('stays sealed on later nights', () => {
    const t = table(INFECTION_SEATS);
    expect(night(t, [act('alpha', 'alpha_infect', ['v1'])], { infection: { successes: 1, sealed: true } }).infection?.reason).toBe('SEALED');
  });

  it('does nothing in a configuration with infection off', () => {
    const t = table(INFECTION_SEATS);
    const config = { ...infectionConfig, infection: { ...infectionConfig.infection, enabled: false } };
    expect(night(t, [act('alpha', 'alpha_infect', ['v1'])], { config }).infection?.reason).toBe('DISABLED');
  });
});

describe('same-night examples (night-resolution.md, section 8)', () => {
  it('Doctor veto with infection elsewhere: the Seeker lives, and the other target converts', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_kill', ['seeker1']), act('alpha', 'alpha_infect', ['v5']), act('doctor', 'doctor_save', [], 'NIGHT_REACTION')], {
      hostDecision: target('seeker1'),
    });
    expect(deaths(r)).toEqual([]);
    expect(r.conversions.map((c) => c.playerId)).toEqual(['v5']);
  });

  it('Doctor veto on the infected Seeker: the Seeker lives and converts', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_kill', ['seeker1']), act('alpha', 'alpha_infect', ['seeker1']), act('doctor', 'doctor_save', [], 'NIGHT_REACTION')], {
      hostDecision: target('seeker1'),
    });
    expect(deaths(r)).toEqual([]);
    expect(r.conversions.map((c) => c.playerId)).toEqual(['seeker1']);
  });

  it('the Doctor saves themselves, is infected, and loses the ability after this night', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_kill', ['doctor']), act('alpha', 'alpha_infect', ['doctor']), act('doctor', 'doctor_save', [], 'NIGHT_REACTION')], {
      hostDecision: target('doctor'),
    });
    expect(deaths(r)).toEqual([]);
    expect(r.conversions.map((c) => c.playerId)).toEqual(['doctor']);
    expect(update(r, 'doctor:doctor_save')).toMatchObject({ status: 'REVOKED', usesConsumed: 1 });
  });
});

describe('charges (step 18, section 7)', () => {
  it('spends a Witch potion, which then reads exhausted', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('witch', 'witch_poison', ['v2'])]);
    expect(update(r, 'witch:witch_poison')).toMatchObject({ chargesRemaining: 0, status: 'EXHAUSTED', usesConsumed: 1 });
  });

  it('records the Guard\'s target for the consecutive-night rule', () => {
    const t = table(INFECTION_SEATS);
    expect(update(night(t, [act('guard', 'guard_protect', ['v4'])]), 'guard:guard_protect')).toMatchObject({ lastUsedRound: 1, lastTargetPlayerId: 'v4' });
  });

  it('spends redundant protections too (OD-48)', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_kill', ['v1']), act('guard', 'guard_protect', ['v1']), act('witch', 'witch_save', ['v1'])], { hostDecision: target('v1') });
    expect([...(r.saves[0]?.savedBy ?? [])].sort()).toEqual(['guard:guard_protect', 'witch:witch_save']);
    expect(update(r, 'witch:witch_save')).toMatchObject({ chargesRemaining: 0 });
    expect(update(r, 'guard:guard_protect')).toMatchObject({ usesConsumed: 1 });
  });

  it('spends the attempt of an action whose target died before close, and rejects it', () => {
    const t = table(INFECTION_SEATS, { dead: ['v9'] });
    const action = act('seeker1', 'seeker_investigate', ['v9']);
    const r = night(t, [action]);
    expect(statusOf(r, action.id)).toEqual({ actionId: action.id, status: 'REJECTED', reason: 'TARGET_ILLEGAL' });
    expect(r.investigations).toEqual([]);
    expect(update(r, 'seeker1:seeker_investigate')).toMatchObject({ usesConsumed: 1 });
  });

  it('rejects an action from a revoked ability and spends nothing', () => {
    const t = table(INFECTION_SEATS);
    const revoked = { ...t, abilities: t.abilities.map((a) => (a.id === 'seeker1:seeker_investigate' ? { ...a, status: 'REVOKED' as const } : a)) };
    const action = act('seeker1', 'seeker_investigate', ['v1']);
    const r = night(revoked, [action]);
    expect(statusOf(r, action.id)?.reason).toBe('ABILITY_UNAVAILABLE');
    expect(r.abilityUpdates).toEqual([]);
  });
});

describe('public facts and determinism', () => {
  it('names the dead and their role, and never the infection (OD-44)', () => {
    const t = table(INFECTION_SEATS);
    const r = night(t, [act('alpha', 'alpha_kill', ['seeker1']), act('alpha', 'alpha_infect', ['v5'])], { hostDecision: target('seeker1') });
    expect(r.publicFacts).toEqual({ deaths: [{ playerId: 'seeker1', revealedRoleId: 'seeker' }], infectionAnnounced: false, hints: [], silenced: [], returned: [] });
    expect(JSON.stringify(r.publicFacts)).not.toContain('v5');
  });

  it('hides the role when the configuration hides night deaths', () => {
    const t = table(INFECTION_SEATS);
    const config = { ...infectionConfig, voting: { ...infectionConfig.voting, revealOnNightDeath: 'HIDDEN' as const } };
    expect(night(t, [act('alpha', 'alpha_kill', ['v1'])], { config, hostDecision: target('v1') }).publicFacts.deaths).toEqual([{ playerId: 'v1', revealedRoleId: null }]);
  });

  it('gives the same result for the same input in any order', () => {
    const t = table(INFECTION_SEATS);
    const actions = [act('alpha', 'alpha_kill', ['v1']), act('alpha', 'alpha_infect', ['v2']), act('guard', 'guard_protect', ['v1']), act('seeker1', 'seeker_investigate', ['alpha'])];
    const forward = night(t, actions, { hostDecision: target('v1') });
    const backward = night(t, [...actions].reverse(), { hostDecision: target('v1') });
    expect(backward).toEqual(forward);
  });

  it('rejects a setting this build cannot resolve, spending nothing', () => {
    const seats: Seat[] = [...INFECTION_SEATS.slice(0, 19), { id: 'seer', roleId: 'seer' }];
    const t = table(seats);
    const lying = { ...t, abilities: t.abilities.map((a) => (a.id === 'seer:seer_investigate' ? { ...a, config: { ...a.config, config: { accuracyPercent: 80 } } } : a)) };
    const action = act('seer', 'seer_investigate', ['v1']);
    const r = night(lying, [action]);
    expect(statusOf(r, action.id)).toMatchObject({ status: 'REJECTED', reason: 'NOT_IMPLEMENTED' });
    expect(r.abilityUpdates).toEqual([]);
  });
});
