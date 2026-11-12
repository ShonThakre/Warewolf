import { describe, expect, it } from 'vitest';
import { chaosSuccessCount, drawChaos, getPack, rememberChaosKind, type NightAbility, type NightEffect } from '../src/index.js';
import { act, deaths, night, statusOf, table, type Seat, update, withAbility } from './support/night.js';

const config = getPack('ultimate-20')!.config;

const core: Seat[] = [
  { id: 'alpha', roleId: 'alpha_wolf', profileId: 'alpha_ultimate' },
  { id: 'shadow', roleId: 'shadow_wolf' },
  { id: 'vampire', roleId: 'vampire' },
  { id: 'wizard', roleId: 'time_wizard' },
  { id: 'oracle', roleId: 'oracle', profileId: 'oracle_alignment' },
  { id: 'guardian', roleId: 'guardian' },
  { id: 'alchemist', roleId: 'alchemist' },
  { id: 'fox', roleId: 'fox' },
  { id: 'mimic', roleId: 'mimic' },
  { id: 'ghost', roleId: 'ghost' },
  { id: 'demon', roleId: 'chaos_demon' },
  { id: 'necro', roleId: 'necromancer' },
  { id: 'agent', roleId: 'double_agent' },
  { id: 'v1', roleId: 'normal_villager' },
];

const mark = (target: string, source = 'vampire', dueRound = 2): NightEffect => ({
  id: `mark-${target}`,
  kind: 'VAMPIRE_MARK',
  sourcePlayerId: source,
  sourceAbilityInstanceId: `${source}:vampire_mark`,
  targetPlayerId: target,
  createdRound: 1,
  dueRound,
  duePhase: 'NIGHT',
  attackTypes: [],
});

describe('drawChaos', () => {
  it('draws without replacement and resets after all six', () => {
    const kinds = ['ABILITY_DISABLED', 'PROTECTIONS_OFF', 'NO_KILLS', 'NO_VOTE', 'SWAP_VOTES', 'DOUBLE_VOTE'];
    let cursor = 0;
    const drawn = [];
    const used: string[] = [];
    for (let i = 0; i < 6; i++) {
      const draw = drawChaos(used as never, ['a', 'b', 'c'], (max) => cursor++ % max);
      used.push(draw.kind);
      drawn.push(draw.kind);
    }
    expect(new Set(drawn)).toEqual(new Set(kinds));
    const again = drawChaos(used as never, ['a', 'b'], () => 0);
    expect(kinds).toContain(again.kind);
    expect(rememberChaosKind(used as never, again.kind)).toEqual([again.kind]);
  });

  it('names nobody for a table-wide event, one player for a double vote, and two for a swap', () => {
    const nobody = drawChaos([], ['a', 'b', 'c'], () => CHAOS_INDEX.NO_VOTE);
    const swap = drawChaos([], ['a', 'b', 'c'], (max) => (max === 6 ? CHAOS_INDEX.SWAP_VOTES : 0));
    const doubled = drawChaos([], ['a', 'b', 'c'], (max) => (max === 6 ? CHAOS_INDEX.DOUBLE_VOTE : 0));
    const disabled = drawChaos([], ['a', 'b', 'c'], (max) => (max === 6 ? CHAOS_INDEX.ABILITY_DISABLED : 0));
    expect(nobody).toMatchObject({ kind: 'NO_VOTE', playerIds: [] });
    expect(swap.playerIds).toEqual(['a', 'b']);
    expect(doubled.playerIds).toEqual(['a']);
    expect(disabled.playerIds).toEqual(['a']);
    expect(chaosSuccessCount(true)).toBe(1);
    expect(chaosSuccessCount(false)).toBe(0);
    expect(chaosSuccessCount(null)).toBe(0);
  });
});

const CHAOS_INDEX = { ABILITY_DISABLED: 0, PROTECTIONS_OFF: 1, NO_KILLS: 2, NO_VOTE: 3, SWAP_VOTES: 4, DOUBLE_VOTE: 5 };

describe('Ultimate 20 night', () => {
  it('keeps the Alpha’s later exclusive choice', () => {
    const t = table(core);
    const kill = act('alpha', 'alpha_u20_kill', ['v1']);
    const infect = act('alpha', 'alpha_u20_infect', ['agent']);
    const result = night(t, [kill, infect], { config });
    expect(statusOf(result, kill.id)?.reason).toBe('SUPERSEDED');
    expect(result.infection?.outcome).toBe('SUCCESS');
    expect(deaths(result)).toEqual([]);
    expect(result.conversions[0]).toMatchObject({ playerId: 'agent', toRoleId: 'infected_wolf', toFaction: 'WOLF_PACK' });
  });

  it('lets the Shadow Wolf cancel a protection', () => {
    const t = table(core);
    const kill = act('alpha', 'alpha_u20_kill', ['v1']);
    const block = act('shadow', 'shadow_block', ['guardian']);
    const guard = act('guardian', 'guardian_protect', ['v1']);
    const result = night(t, [kill, block, guard], { config });
    expect(statusOf(result, guard.id)?.reason).toBe('BLOCKED');
    expect(deaths(result)).toEqual(['v1']);
  });

  it('answers Oracle alignment and Fox faction from the start of the night', () => {
    const t = table(core);
    const wolf = act('oracle', 'oracle_alignment', ['alpha']);
    const team = act('fox', 'fox_investigate', ['oracle']);
    const result = night(t, [wolf, team], { config });
    expect(result.investigations).toEqual(expect.arrayContaining([
      expect.objectContaining({ abilityId: 'oracle_alignment', value: 'WOLF' }),
      expect.objectContaining({ abilityId: 'fox_investigate', kind: 'FACTION', value: 'VILLAGE' }),
    ]));
  });

  it('lets the Guardian stop a wolf kill, including the repeat rule, but not poison', () => {
    const t = table(core);
    const saved = night(t, [act('alpha', 'alpha_u20_kill', ['v1']), act('guardian', 'guardian_protect', ['v1'])], { config });
    expect(deaths(saved)).toEqual([]);
    expect(saved.saves).toEqual([expect.objectContaining({ playerId: 'v1', attackType: 'WOLF_KILL' })]);

    const repeating = withAbility(t, 'guardian:guardian_protect', { lastUsedRound: 1, lastTargetPlayerId: 'v1' });
    const again = act('guardian', 'guardian_protect', ['v1']);
    const repeated = night(repeating, [act('alpha', 'alpha_u20_kill', ['v1']), again], { config, round: 2 });
    expect(statusOf(repeated, again.id)?.reason).toBe('TARGET_ILLEGAL');
    expect(deaths(repeated)).toEqual(['v1']);

    const poisoned = night(t, [act('alchemist', 'alchemist_poison', ['v1']), act('guardian', 'guardian_protect', ['v1'])], { config });
    expect(deaths(poisoned)).toEqual(['v1']);
  });

  it('lets the Alchemist use three potions in one night', () => {
    const t = table(core);
    const heal = act('alchemist', 'alchemist_heal', ['v1']);
    const poison = act('alchemist', 'alchemist_poison', ['shadow']);
    const silence = act('alchemist', 'alchemist_silence', ['fox']);
    const healed = night(t, [act('alpha', 'alpha_u20_kill', ['v1']), heal], { config });
    expect(deaths(healed)).toEqual([]);

    const cured = night(t, [poison, act('alchemist', 'alchemist_heal', ['shadow'])], { config });
    expect(deaths(cured)).toEqual([]);

    const all = night(t, [heal, poison, silence], { config });
    expect(all.actions.filter((action) => action.status === 'RESOLVED').length).toBe(3);
    expect(all.publicFacts.silenced).toEqual(['fox']);
    expect(deaths(all)).toEqual(['shadow']);
  });

  it('promotes a mark at dawn after the next night, and cancels it when someone dies or the target is a wolf', () => {
    const t = table(core);
    const placed = night(t, [act('vampire', 'vampire_mark', ['alchemist'])], { config });
    expect(placed.conversions).toEqual([]);
    expect(placed.newEffects).toEqual([expect.objectContaining({ kind: 'VAMPIRE_MARK', targetPlayerId: 'alchemist', dueRound: 2 })]);
    expect(placed.publicFacts.deaths).toEqual([]);

    const due = night(t, [], { config, round: 2, effects: [mark('alchemist')] });
    expect(due.conversions[0]).toMatchObject({ playerId: 'alchemist', toRoleId: 'vampire_servant', fromRoleId: 'alchemist', cause: 'VAMPIRE' });
    expect(due.grants.map((grant) => grant.abilityId).sort()).toEqual(['servant_kill', 'servant_mark']);
    expect(due.grants.every((grant) => grant.availableFromRound === 3)).toBe(true);
    expect(due.abilityUpdates.filter((row) => row.abilityInstanceId.startsWith('alchemist:')).every((row) => row.patch.status === 'REVOKED')).toBe(true);
    expect(due.grants.some((grant) => grant.abilityId === 'infected_kill')).toBe(false);

    const sameNight = night(t, [act('vampire', 'vampire_mark', ['alchemist']), act('alpha', 'alpha_u20_kill', ['alchemist'])], { config });
    expect(sameNight.newEffects.some((effect) => effect.kind === 'VAMPIRE_MARK')).toBe(false);
    expect(deaths(sameNight)).toEqual(['alchemist']);

    const killed = night(t, [act('alpha', 'alpha_u20_kill', ['alchemist'])], { config, round: 2, effects: [mark('alchemist')] });
    expect(killed.conversions).toEqual([]);
    expect(killed.closedEffects).toEqual([{ effectId: 'mark-alchemist', status: 'EXPIRED' }]);

    const deadVampire = night(table(core, { dead: ['vampire'] }), [], { config, round: 2, effects: [mark('alchemist')] });
    expect(deadVampire.conversions).toEqual([]);
    expect(deadVampire.closedEffects).toEqual([{ effectId: 'mark-alchemist', status: 'EXPIRED' }]);

    const wolf = night(t, [], { config, round: 2, effects: [mark('alpha')] });
    expect(wolf.closedEffects).toEqual([{ effectId: 'mark-alpha', status: 'EXPIRED' }]);
  });

  it('lets the Vampire team choose kill or mark, and not both', () => {
    const t = table([...core, { id: 'servant', roleId: 'vampire_servant' }]);
    const marked = night(t, [act('vampire', 'vampire_mark', ['v1']), act('servant', 'servant_kill', ['fox'])], { config });
    expect(deaths(marked)).toEqual([]);
    expect(marked.newEffects).toEqual([expect.objectContaining({ kind: 'VAMPIRE_MARK', targetPlayerId: 'v1' })]);
    expect(statusOf(marked, marked.actions.find((action) => action.reason === 'SUPERSEDED')!.actionId)?.reason).toBe('SUPERSEDED');

    const killed = night(t, [act('servant', 'servant_kill', ['fox'])], { config });
    expect(deaths(killed)).toEqual(['fox']);
    expect(killed.newEffects.some((effect) => effect.kind === 'VAMPIRE_MARK')).toBe(false);

    const both = act('vampire', 'vampire_mark', ['v1']);
    const later = act('vampire', 'vampire_kill', ['fox']);
    const exclusive = night(t, [both, later], { config });
    expect(statusOf(exclusive, both.id)?.reason).toBe('SUPERSEDED');
    expect(deaths(exclusive)).toEqual(['fox']);

    const servants = table([...core, { id: 'a-servant', roleId: 'vampire_servant' }, { id: 'b-servant', roleId: 'vampire_servant' }]);
    const disagreed = night(servants, [act('b-servant', 'servant_kill', ['fox']), act('a-servant', 'servant_mark', ['v1'])], { config });
    expect(deaths(disagreed)).toEqual([]);
    expect(disagreed.newEffects).toEqual([expect.objectContaining({ kind: 'VAMPIRE_MARK', sourcePlayerId: 'a-servant' })]);

    const healed = night(t, [act('vampire', 'vampire_kill', ['v1']), act('alchemist', 'alchemist_heal', ['v1'])], { config });
    expect(deaths(healed)).toEqual([]);
    const guarded = night(t, [act('vampire', 'vampire_kill', ['v1']), act('guardian', 'guardian_protect', ['v1'])], { config });
    expect(deaths(guarded)).toEqual(['v1']);
  });

  it('rewinds a kill, restores an action the Shadow Wolf blocked, and loses to a block it did not rewind', () => {
    const t = table(core);
    const kill = act('alpha', 'alpha_u20_kill', ['v1']);
    const rewind = act('wizard', 'time_rewind', ['alpha']);
    const rewound = night(t, [kill, rewind], { config });
    expect(deaths(rewound)).toEqual([]);
    expect(statusOf(rewound, kill.id)?.reason).toBe('REWOUND');

    const block = act('shadow', 'shadow_block', ['guardian']);
    const guard = act('guardian', 'guardian_protect', ['v1']);
    const undo = act('wizard', 'time_rewind', ['shadow']);
    const restored = night(t, [act('alpha', 'alpha_u20_kill', ['v1']), block, guard, undo], { config });
    expect(statusOf(restored, block.id)?.reason).toBe('REWOUND');
    expect(deaths(restored)).toEqual([]);

    const blockedRewind = act('wizard', 'time_rewind', ['v1']);
    const blocked = night(t, [act('shadow', 'shadow_block', ['wizard']), blockedRewind, act('alpha', 'alpha_u20_kill', ['v1'])], { config });
    expect(statusOf(blocked, blockedRewind.id)?.reason).toBe('BLOCKED');
    expect(deaths(blocked)).toEqual(['v1']);
  });

  it('returns a dead player without making them alive, and publishes a Ghost hint', () => {
    const t = table(core, { dead: ['v1', 'ghost'] });
    const revived = night(t, [act('necro', 'necro_revive', ['v1'])], { config });
    expect(revived.revivals).toEqual([expect.objectContaining({ targetId: 'v1' })]);
    expect(revived.publicFacts.returned).toEqual(['v1']);
    expect(revived.newEffects).toEqual([expect.objectContaining({ kind: 'RETURNED', dueRound: 2 })]);
    expect(deaths(revived)).toEqual([]);

    const hinted = night(t, [act('ghost', 'ghost_hint', [], 'NIGHT_SUBMIT', { hint: 'the healer lied' })], { config });
    expect(hinted.publicFacts.hints).toEqual([{ text: 'the healer lied' }]);
    expect(hinted.hints[0]?.actorId).toBe('ghost');
  });

  it('copies a dead Alchemist and revokes the other potions when one is used', () => {
    const t = table(core, { dead: ['alchemist'] });
    const copied = night(t, [act('mimic', 'mimic_copy', ['alchemist'])], { config });
    expect([...(copied.copies[0]?.abilityIds ?? [])].sort()).toEqual(['alchemist_heal', 'alchemist_poison', 'alchemist_silence']);
    expect(copied.grants.every((grant) => grant.chargesRemaining === 1)).toBe(true);

    const granted: NightAbility[] = copied.grants.map((grant) => ({
      id: `mimic:${grant.abilityId}`,
      playerId: 'mimic',
      status: 'ACTIVE',
      chargesRemaining: 1,
      usesConsumed: 0,
      lastUsedRound: null,
      lastTargetPlayerId: null,
      availableFromRound: 1,
      expiresRound: null,
      config: grant.definition,
    }));
    const next = { ...t, abilities: [...t.abilities, ...granted] };
    const used = night(next, [act('mimic', 'alchemist_poison', ['v1'])], { config, round: 2 });
    expect(deaths(used)).toEqual(['v1']);
    expect(update(used, 'mimic:alchemist_heal')).toMatchObject({ status: 'REVOKED', revokedReason: 'MIMIC_USED' });
    expect(update(used, 'mimic:alchemist_silence')).toMatchObject({ status: 'REVOKED', revokedReason: 'MIMIC_USED' });
  });

  it('applies each Chaos event, and drops one that was blocked or rewound', () => {
    const t = table(core);
    const disabled = night(t, [act('alpha', 'alpha_u20_kill', ['v1']), act('demon', 'chaos_event')], { config, chaos: { kind: 'ABILITY_DISABLED', playerIds: ['alpha'] } });
    expect(deaths(disabled)).toEqual([]);
    expect(disabled.chaosEvent).toMatchObject({ kind: 'ABILITY_DISABLED', success: true });

    const open = night(t, [act('alpha', 'alpha_u20_kill', ['v1']), act('guardian', 'guardian_protect', ['v1']), act('demon', 'chaos_event')], { config, chaos: { kind: 'PROTECTIONS_OFF', playerIds: [] } });
    expect(deaths(open)).toEqual(['v1']);
    expect(open.chaosEvent?.success).toBe(true);

    const stopped = night(t, [act('alpha', 'alpha_u20_kill', ['v1']), act('demon', 'chaos_event')], { config, chaos: { kind: 'NO_KILLS', playerIds: [] } });
    expect(deaths(stopped)).toEqual([]);
    expect(stopped.chaosEvent?.success).toBe(true);

    const quiet = night(t, [act('demon', 'chaos_event')], { config, chaos: { kind: 'NO_KILLS', playerIds: [] } });
    expect(quiet.chaosEvent?.success).toBe(false);
    const missed = night(t, [act('demon', 'chaos_event')], { config, chaos: { kind: 'ABILITY_DISABLED', playerIds: ['v1'] } });
    expect(missed.chaosEvent?.success).toBe(false);
    const unusedShield = night(t, [act('guardian', 'guardian_protect', ['v1']), act('demon', 'chaos_event')], { config, chaos: { kind: 'PROTECTIONS_OFF', playerIds: [] } });
    expect(unusedShield.chaosEvent?.success).toBe(false);

    for (const kind of ['NO_VOTE', 'SWAP_VOTES', 'DOUBLE_VOTE'] as const) {
      const day = night(t, [act('demon', 'chaos_event')], { config, chaos: { kind, playerIds: kind === 'SWAP_VOTES' ? ['v1', 'fox'] : ['v1'] } });
      expect(day.chaosEvent).toMatchObject({ kind, success: null });
      expect(day.newEffects).toEqual([expect.objectContaining({ kind: 'CHAOS_DAY', chaosKind: kind })]);
    }

    const blocked = night(t, [act('shadow', 'shadow_block', ['demon']), act('demon', 'chaos_event')], { config, chaos: { kind: 'NO_KILLS', playerIds: [] } });
    expect(blocked.chaosEvent).toBeNull();
    expect(blocked.actions.find((action) => action.actionId !== blocked.actions[0]?.actionId || true)).toBeTruthy();
    expect(blocked.actions.some((action) => action.reason === 'BLOCKED')).toBe(true);

    const rewound = night(t, [act('wizard', 'time_rewind', ['demon']), act('demon', 'chaos_event')], { config, chaos: { kind: 'NO_KILLS', playerIds: [] } });
    expect(rewound.chaosEvent).toBeNull();
    expect(rewound.actions.some((action) => action.reason === 'REWOUND')).toBe(true);
  });

  it('is unchanged when the same actions arrive in another order', () => {
    const t = table(core);
    const actions = [act('alpha', 'alpha_u20_kill', ['v1']), act('guardian', 'guardian_protect', ['v1']), act('oracle', 'oracle_alignment', ['shadow']), act('fox', 'fox_investigate', ['alpha'])];
    expect(night(t, [...actions].reverse(), { config })).toEqual(night(t, actions, { config }));
  });
});
