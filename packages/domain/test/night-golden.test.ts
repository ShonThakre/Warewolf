import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, type Conversion, type NightAction, type NightResult, type UsePatch } from '../src/index.js';
import { CLASSIC_SEATS, EXPANDED_SEATS, INFECTION_SEATS, act, classicConfig, night, table, target, used } from './support/night.js';

/**
 * WW-801 golden fixtures: every same-night example in night-resolution.md,
 * section 8, compared against the whole `NightResult`. A change anywhere in
 * the result, including a new field, has to be reflected here on purpose.
 */

const INFECTED_KILL = DEFAULT_CATALOG.byId.get('infected_wolf')!.profiles['infected_wolf']!.abilities[0]!;

/** A night where nothing happened. Each fixture spreads what did. */
function quiet(overrides: Partial<NightResult>): NightResult {
  return {
    round: 1,
    finalWolfTarget: null,
    deaths: [],
    saves: [],
    redirects: [],
    blocks: [],
    investigations: [],
    infection: null,
    conversions: [],
    cursedFailures: [],
    copies: [],
    inheritances: [],
    revenges: [],
    marks: [],
    rewinds: [],
    chaosEvent: null,
    silences: [],
    revivals: [],
    hints: [],
    grants: [],
    abilityUpdates: [],
    newEffects: [],
    closedEffects: [],
    actions: [],
    infectionState: { successes: 0, sealed: false },
    publicFacts: { deaths: [], infectionAnnounced: false, hints: [], silenced: [], returned: [] },
    ...overrides,
  };
}

const resolved = (...actions: NightAction[]) => actions.map((a) => ({ actionId: a.id, status: 'RESOLVED' as const, reason: null }));
const patch = (abilityInstanceId: string, p: Partial<UsePatch> & { status?: string; revokedReason?: string }) => ({ abilityInstanceId, patch: p });
const revoked = { status: 'REVOKED' as const, revokedReason: 'INFECTION' };
const potion = (lastTargetPlayerId: string) => used(lastTargetPlayerId, { chargesRemaining: 0, status: 'EXHAUSTED' });

function infected(playerId: string, fromRoleId: string): { conversion: Conversion; grant: NightResult['grants'][number] } {
  return {
    conversion: {
      playerId,
      fromRoleId,
      fromFaction: 'VILLAGE',
      toRoleId: 'infected_wolf',
      toProfileId: 'infected_wolf',
      toFaction: 'WOLF_PACK',
      wolfAligned: true,
      individualVictory: null,
      cause: 'INFECTION',
    },
    grant: { playerId, abilityId: 'infected_kill', definition: INFECTED_KILL, chargesRemaining: null, availableFromRound: 2, expiresRound: null, source: 'NATIVE', sourcePlayerId: null },
  };
}

describe('golden: night-resolution.md, section 8', () => {
  it('Guard and infection on the same villager', () => {
    const t = table(INFECTION_SEATS);
    const kill = act('alpha', 'alpha_kill', ['v1']);
    const infect = act('alpha', 'alpha_infect', ['v1']);
    const guard = act('guard', 'guard_protect', ['v1']);
    const check = act('seeker1', 'seeker_investigate', ['v1']);
    const v1 = infected('v1', 'normal_villager');

    expect(night(t, [kill, infect, guard, check], { hostDecision: target('v1') })).toEqual(
      quiet({
        finalWolfTarget: 'v1',
        saves: [{ playerId: 'v1', attackType: 'WOLF_KILL', savedBy: ['guard:guard_protect'] }],
        investigations: [
          { actionId: check.id, actorId: 'seeker1', abilityInstanceId: 'seeker1:seeker_investigate', abilityId: 'seeker_investigate', targetPlayerIds: ['v1'], kind: 'ALIGNMENT_WOLF_OR_NOT', value: 'NOT_WOLF' },
        ],
        infection: { actionId: infect.id, actorId: 'alpha', targetId: 'v1', outcome: 'SUCCESS', reason: null },
        conversions: [v1.conversion],
        grants: [v1.grant],
        abilityUpdates: [
          patch('alpha:alpha_infect', used('v1')),
          patch('alpha:alpha_kill', used('v1')),
          patch('guard:guard_protect', used('v1')),
          patch('seeker1:seeker_investigate', used('v1')),
        ],
        actions: resolved(kill, infect, guard, check),
        infectionState: { successes: 1, sealed: false },
      }),
    );
  });

  it('Doctor veto: the Seeker lives, and the infection elsewhere converts', () => {
    const t = table(INFECTION_SEATS);
    const kill = act('alpha', 'alpha_kill', ['seeker1']);
    const infect = act('alpha', 'alpha_infect', ['v5']);
    const save = act('doctor', 'doctor_save', [], 'NIGHT_REACTION');
    const v5 = infected('v5', 'normal_villager');

    expect(night(t, [kill, infect, save], { hostDecision: target('seeker1') })).toEqual(
      quiet({
        finalWolfTarget: 'seeker1',
        saves: [{ playerId: 'seeker1', attackType: 'WOLF_KILL', savedBy: ['doctor:doctor_save'] }],
        infection: { actionId: infect.id, actorId: 'alpha', targetId: 'v5', outcome: 'SUCCESS', reason: null },
        conversions: [v5.conversion],
        grants: [v5.grant],
        abilityUpdates: [patch('alpha:alpha_infect', used('v5')), patch('alpha:alpha_kill', used('seeker1')), patch('doctor:doctor_save', used(null))],
        actions: resolved(kill, infect, save),
        infectionState: { successes: 1, sealed: false },
      }),
    );
  });

  it('Doctor veto on the infected Seeker: the Seeker lives and converts', () => {
    const t = table(INFECTION_SEATS);
    const kill = act('alpha', 'alpha_kill', ['seeker1']);
    const infect = act('alpha', 'alpha_infect', ['seeker1']);
    const save = act('doctor', 'doctor_save', [], 'NIGHT_REACTION');
    const seeker = infected('seeker1', 'seeker');

    expect(night(t, [kill, infect, save], { hostDecision: target('seeker1') })).toEqual(
      quiet({
        finalWolfTarget: 'seeker1',
        saves: [{ playerId: 'seeker1', attackType: 'WOLF_KILL', savedBy: ['doctor:doctor_save'] }],
        infection: { actionId: infect.id, actorId: 'alpha', targetId: 'seeker1', outcome: 'SUCCESS', reason: null },
        conversions: [seeker.conversion],
        grants: [seeker.grant],
        abilityUpdates: [
          patch('alpha:alpha_infect', used('seeker1')),
          patch('alpha:alpha_kill', used('seeker1')),
          patch('doctor:doctor_save', used(null)),
          patch('seeker1:seeker_investigate', revoked),
          patch('seeker1:seeker_public_reveal', revoked),
        ],
        actions: resolved(kill, infect, save),
        infectionState: { successes: 1, sealed: false },
      }),
    );
  });

  it('Doctor is the final target: saves themselves, converts, and loses the save after this night', () => {
    const t = table(INFECTION_SEATS);
    const kill = act('alpha', 'alpha_kill', ['doctor']);
    const infect = act('alpha', 'alpha_infect', ['doctor']);
    const save = act('doctor', 'doctor_save', [], 'NIGHT_REACTION');
    const doctor = infected('doctor', 'doctor');

    expect(night(t, [kill, infect, save], { hostDecision: target('doctor') })).toEqual(
      quiet({
        finalWolfTarget: 'doctor',
        saves: [{ playerId: 'doctor', attackType: 'WOLF_KILL', savedBy: ['doctor:doctor_save'] }],
        infection: { actionId: infect.id, actorId: 'alpha', targetId: 'doctor', outcome: 'SUCCESS', reason: null },
        conversions: [doctor.conversion],
        grants: [doctor.grant],
        abilityUpdates: [patch('alpha:alpha_infect', used('doctor')), patch('alpha:alpha_kill', used('doctor')), patch('doctor:doctor_save', { ...used(null), ...revoked })],
        actions: resolved(kill, infect, save),
        infectionState: { successes: 1, sealed: false },
      }),
    );
  });

  it('Witch save and poison on one player: the kill is cancelled, the poison still kills', () => {
    const t = table(INFECTION_SEATS);
    const kill = act('alpha', 'alpha_kill', ['v1']);
    const save = act('witch', 'witch_save', ['v1']);
    const poison = act('witch', 'witch_poison', ['v1']);

    expect(night(t, [kill, save, poison], { hostDecision: target('v1') })).toEqual(
      quiet({
        finalWolfTarget: 'v1',
        deaths: [{ playerId: 'v1', causes: ['POISON'], attackers: [{ type: 'POISON', via: 'ABILITY', actorIds: ['witch'] }], roleIdAtDeath: 'normal_villager' }],
        saves: [{ playerId: 'v1', attackType: 'WOLF_KILL', savedBy: ['witch:witch_save'] }],
        abilityUpdates: [patch('alpha:alpha_kill', used('v1')), patch('witch:witch_poison', potion('v1')), patch('witch:witch_save', potion('v1'))],
        actions: resolved(kill, save, poison),
        publicFacts: { deaths: [{ playerId: 'v1', revealedRoleId: 'normal_villager' }], infectionAnnounced: false, hints: [], silenced: [], returned: [] },
      }),
    );
  });

  it('Bodyguard and Guard on one target: the Guard already cancelled the kill, and both spend their night', () => {
    const t = table(EXPANDED_SEATS);
    const kill = act('wolf1', 'pack_kill', ['v1']);
    const bodyguard = act('bodyguard', 'bodyguard_protect', ['v1']);
    const guard = act('guard', 'guard_protect', ['v1']);

    expect(night(t, [kill, bodyguard, guard], { config: classicConfig })).toEqual(
      quiet({
        finalWolfTarget: 'v1',
        saves: [{ playerId: 'v1', attackType: 'WOLF_KILL', savedBy: ['guard:guard_protect'] }],
        abilityUpdates: [patch('bodyguard:bodyguard_protect', used('v1')), patch('guard:guard_protect', used('v1')), patch('wolf1:pack_kill', used('v1'))],
        actions: resolved(kill, bodyguard, guard),
      }),
    );
  });

  it('Alpha is the final target and the Doctor declines: the Alpha dies, nothing converts, infection seals', () => {
    const t = table(INFECTION_SEATS, { wolves: ['v14'] });
    const kill = act('v14', 'infected_kill', ['alpha']);
    const infect = act('alpha', 'alpha_infect', ['v1']);

    expect(night(t, [kill, infect], { hostDecision: target('alpha') })).toEqual(
      quiet({
        finalWolfTarget: 'alpha',
        deaths: [{ playerId: 'alpha', causes: ['WOLF_KILL'], attackers: [{ type: 'WOLF_KILL', via: 'PACK', actorIds: ['v14'] }], roleIdAtDeath: 'alpha_wolf' }],
        infection: { actionId: infect.id, actorId: 'alpha', targetId: 'v1', outcome: 'FAILED', reason: 'ALPHA_DEAD' },
        abilityUpdates: [patch('alpha:alpha_infect', used('v1')), patch('v14:infected_kill', used('alpha'))],
        actions: resolved(kill, infect),
        infectionState: { successes: 0, sealed: true },
        publicFacts: { deaths: [{ playerId: 'alpha', revealedRoleId: 'alpha_wolf' }], infectionAnnounced: false, hints: [], silenced: [], returned: [] },
      }),
    );
  });

  it('Two wolves submit different targets: host select attacks only the confirmed one', () => {
    const t = table(INFECTION_SEATS, { wolves: ['v14'] });
    const a = act('alpha', 'alpha_kill', ['v1']);
    const b = act('v14', 'infected_kill', ['v2']);

    expect(night(t, [a, b], { hostDecision: target('v2') })).toEqual(
      quiet({
        finalWolfTarget: 'v2',
        deaths: [{ playerId: 'v2', causes: ['WOLF_KILL'], attackers: [{ type: 'WOLF_KILL', via: 'PACK', actorIds: ['v14'] }], roleIdAtDeath: 'normal_villager' }],
        abilityUpdates: [patch('alpha:alpha_kill', used('v1')), patch('v14:infected_kill', used('v2'))],
        actions: resolved(a, b),
        publicFacts: { deaths: [{ playerId: 'v2', revealedRoleId: 'normal_villager' }], infectionAnnounced: false, hints: [], silenced: [], returned: [] },
      }),
    );
  });

  it('Two wolves submit different targets: a 1-1 majority tie attacks nobody', () => {
    const t = table(CLASSIC_SEATS);
    const a = act('wolf1', 'pack_kill', ['v1']);
    const b = act('wolf2', 'pack_kill', ['v2']);

    expect(night(t, [a, b], { config: classicConfig })).toEqual(
      quiet({
        abilityUpdates: [patch('wolf1:pack_kill', used('v1')), patch('wolf2:pack_kill', used('v2'))],
        actions: resolved(a, b),
      }),
    );
  });
});
