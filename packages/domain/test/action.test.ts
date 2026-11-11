import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  DEFAULT_CAPABILITY_REGISTRY,
  DEFAULT_CATALOG,
  HANDLER_KEYS,
  actionWindow,
  availability,
  checkSubmission,
  checkTargets,
  consumeUse,
  createCapabilityRegistry,
  exclusiveSiblings,
  handlerFor,
  type AbilityDefinition,
  type AbilityUse,
  type AvailabilityContext,
  type GamePhase,
  type LifeStatus,
  type SubmissionInput,
  type TargetContext,
} from '../src/index.js';

/** An ability definition from the shipped catalog. */
function def(roleId: string, abilityId: string, profileId?: string): AbilityDefinition {
  const role = DEFAULT_CATALOG.byId.get(roleId)!;
  const found = role.profiles[profileId ?? role.defaultProfileId]!.abilities.find((a) => a.id === abilityId);
  if (!found) throw new Error(`missing ${roleId}.${abilityId}`);
  return found;
}

const ACTOR = 'p1';

/** A freshly dealt ability on the actor, as insertDeal writes it. */
function use(config: AbilityDefinition, extra: Partial<AbilityUse> = {}): AbilityUse {
  return {
    playerId: ACTOR,
    status: 'ACTIVE',
    chargesRemaining: config.usesPerGame,
    usesConsumed: 0,
    lastUsedRound: null,
    lastTargetPlayerId: null,
    availableFromRound: config.availableFromRound,
    expiresRound: null,
    config,
    ...extra,
  };
}

const night = (round = 1, extra: Partial<AvailabilityContext> = {}): AvailabilityContext => ({
  status: 'ACTIVE',
  phase: 'NIGHT_SUBMIT',
  round,
  actorLife: 'ALIVE',
  ...extra,
});

const table = (entries: Record<string, LifeStatus>) => new Map(Object.entries(entries));
const PLAYERS = table({ p1: 'ALIVE', p2: 'ALIVE', p3: 'ALIVE', p4: 'DEAD' });

const targetCtx = (extra: Partial<TargetContext> = {}): TargetContext => ({
  actorId: ACTOR,
  round: 2,
  players: PLAYERS,
  lastUsedRound: null,
  lastTargetPlayerId: null,
  ...extra,
});

function submission(config: AbilityDefinition, extra: Partial<SubmissionInput> = {}): SubmissionInput {
  return { ...night(), actorId: ACTOR, ability: use(config), players: PLAYERS, targetPlayerIds: ['p2'], payload: {}, ...extra };
}

describe('capability registry (WW-602)', () => {
  it('has an entry for every capability and handler key', () => {
    for (const key of [...CAPABILITIES, ...HANDLER_KEYS]) expect(DEFAULT_CAPABILITY_REGISTRY.has(key), key).toBe(true);
  });

  it('finds a handler for every ability in the catalog, without a role id', () => {
    for (const role of DEFAULT_CATALOG.roles) {
      for (const profile of Object.values(role.profiles)) {
        for (const ability of profile.abilities) {
          if (role.implementationStatus === 'UNRESOLVED') continue;
          expect(handlerFor(ability), `${role.id}.${ability.id}`).toBeDefined();
        }
      }
    }
  });

  it('every submittable catalog ability is timed for a window, and every passive one is not submitted', () => {
    for (const role of DEFAULT_CATALOG.roles) {
      for (const profile of Object.values(role.profiles)) {
        for (const ability of profile.abilities) {
          const handler = handlerFor(ability);
          if (!handler) continue;
          if (ability.timing === 'PASSIVE') expect(availability(use(ability), night()), ability.id).toBe('PASSIVE');
          else expect(handler.submittable, ability.id).toBe(true);
        }
      }
    }
  });

  it('uses the handler key only for an ability without a capability', () => {
    expect(handlerFor(def('assassin', 'assassin_mark', 'assassin_mark'))?.key).toBe('assassin.onTargetEliminated');
    expect(handlerFor(def('alpha_wolf', 'alpha_infect'))?.key).toBe('INFECT');
    expect(HANDLER_KEYS).toContain('assassin.onTargetEliminated');
  });

  it('adding a capability is one registry entry, with no role id switch', () => {
    const talk: AbilityDefinition = { ...def('medium', 'medium_investigate'), id: 'medium_talk', capability: 'COMMUNICATE_WITH_DEAD', target: { kind: 'NONE' } };
    const input = submission(talk, { targetPlayerIds: [] });
    expect(checkSubmission(input)).toMatchObject({ ok: false, refusal: 'ACTION_NOT_YOUR_ABILITY', reason: 'PASSIVE' });

    const withTalk = createCapabilityRegistry([
      ...[...DEFAULT_CAPABILITY_REGISTRY.values()].filter((h) => h.key !== 'COMMUNICATE_WITH_DEAD'),
      { key: 'COMMUNICATE_WITH_DEAD', submittable: true, nightStep: 'INFORMATION' },
    ]);
    expect(checkSubmission({ ...input, registry: withTalk })).toEqual({ ok: true, window: 'NIGHT_SUBMIT' });
  });

  it('rejects two handlers for one key', () => {
    expect(() => createCapabilityRegistry([{ key: 'KILL', submittable: true, nightStep: 'ATTACK' }, { key: 'KILL', submittable: true, nightStep: 'ATTACK' }])).toThrow(/Duplicate/);
  });
});

describe('action windows', () => {
  it('maps each timing to the phase it is submitted in', () => {
    expect(actionWindow('NIGHT')).toBe('NIGHT_SUBMIT');
    expect(actionWindow('NIGHT_REACTION')).toBe('NIGHT_REACTION');
    expect(actionWindow('DAY')).toBe('DAY_DISCUSSION');
    expect(actionWindow('PASSIVE')).toBeNull();
  });

  it('opens a night ability only during night submission', () => {
    const seeker = use(def('seeker', 'seeker_investigate'));
    const phases: GamePhase[] = ['ROLE_REVEAL', 'NIGHT_SUBMIT', 'NIGHT_HOST_CONFIRM', 'NIGHT_REACTION', 'DAY_DISCUSSION', 'VOTING'];
    expect(phases.map((phase) => availability(seeker, night(1, { phase })))).toEqual([
      'NOT_THIS_PHASE',
      'OPEN',
      'NOT_THIS_PHASE',
      'NOT_THIS_PHASE',
      'NOT_THIS_PHASE',
      'NOT_THIS_PHASE',
    ]);
  });

  it('opens the informed Doctor only in the reaction window', () => {
    const doctor = use(def('doctor', 'doctor_save', 'doctor_infection'));
    expect(availability(doctor, night(1))).toBe('NOT_THIS_PHASE');
    expect(availability(doctor, night(1, { phase: 'NIGHT_REACTION' }))).toBe('OPEN');
  });

  it('opens a day ability during discussion', () => {
    expect(availability(use(def('sniper', 'sniper_shot')), night(1, { phase: 'DAY_DISCUSSION' }))).toBe('OPEN');
  });

  it('closes everything once the game is over', () => {
    expect(availability(use(def('seeker', 'seeker_investigate')), night(1, { status: 'FINISHED' }))).toBe('NOT_THIS_PHASE');
  });
});

describe('availability: charges, cooldowns, rounds (WW-603)', () => {
  it('stops a Witch potion once it is spent', () => {
    const potion = use(def('witch', 'witch_poison'));
    expect(potion.chargesRemaining).toBe(1);
    expect(availability(potion, night())).toBe('OPEN');
    const spent = { ...potion, ...consumeUse(potion, 1, ['p2']) };
    expect(spent).toMatchObject({ chargesRemaining: 0, usesConsumed: 1, status: 'EXHAUSTED' });
    expect(availability(spent, night(2))).toBe('NO_USES');
  });

  it('keeps an unlimited ability unlimited', () => {
    const save = use(def('doctor', 'doctor_save', 'doctor_infection'));
    const after = consumeUse(save, 1, []);
    expect(after).toMatchObject({ chargesRemaining: null, usesConsumed: 1, status: 'ACTIVE', lastUsedRound: 1, lastTargetPlayerId: null });
  });

  it('rests an "every other night" ability for one night', () => {
    const oracle = def('oracle', 'oracle_investigate');
    expect(oracle.cooldownNights).toBe(1);
    const used = use(oracle, { lastUsedRound: 1 });
    expect(availability(used, night(2))).toBe('COOLDOWN');
    expect(availability(used, night(3))).toBe('OPEN');
  });

  it('rests the Prophet for two nights', () => {
    const used = use(def('prophet', 'prophet_ask'), { lastUsedRound: 2 });
    expect([3, 4, 5].map((round) => availability(used, night(round)))).toEqual(['COOLDOWN', 'COOLDOWN', 'OPEN']);
  });

  it('opens a night-1-only mark on night 1 and never after', () => {
    const mark = use(def('assassin', 'assassin_mark', 'assassin_mark'));
    expect(availability(mark, night(1))).toBe('OPEN');
    expect(availability(mark, night(2))).toBe('EXPIRED');
  });

  it('waits for an ability that starts later, and for a scheduled copy', () => {
    const kill = use(def('infected_wolf', 'infected_kill'), { availableFromRound: 3 });
    expect(availability(kill, night(2))).toBe('NOT_YET');
    expect(availability(kill, night(3))).toBe('OPEN');
    expect(availability(use(def('seeker', 'seeker_investigate'), { status: 'SCHEDULED' }), night(2))).toBe('NOT_YET');
  });

  it('closes an expired copy', () => {
    const copy = use(def('seeker', 'seeker_investigate'), { expiresRound: 2 });
    expect(availability(copy, night(2))).toBe('OPEN');
    expect(availability(copy, night(3))).toBe('EXPIRED');
  });

  it('checks revoked before life, and life before phase', () => {
    const seeker = def('seeker', 'seeker_investigate');
    expect(availability(use(seeker, { status: 'REVOKED' }), night(1, { actorLife: 'DEAD', phase: 'VOTING' }))).toBe('REVOKED');
    expect(availability(use(seeker), night(1, { actorLife: 'DEAD', phase: 'VOTING' }))).toBe('DEAD');
  });
});

describe('target rules (WW-602)', () => {
  const one = def('seeker', 'seeker_investigate').target;

  it('takes exactly the configured number of distinct, known, living players', () => {
    expect(checkTargets(one, ['p2'], {}, targetCtx())).toBeNull();
    expect(checkTargets(one, [], {}, targetCtx())).toBe('TARGET_COUNT');
    expect(checkTargets(one, ['p2', 'p3'], {}, targetCtx())).toBe('TARGET_COUNT');
    expect(checkTargets(one, ['nobody'], {}, targetCtx())).toBe('TARGET_UNKNOWN');
    expect(checkTargets(one, ['p4'], {}, targetCtx())).toBe('TARGET_LIFE');
    const psychic = def('psychic', 'psychic_compare').target;
    expect(checkTargets(psychic, ['p2', 'p3'], {}, targetCtx())).toBeNull();
    expect(checkTargets(psychic, ['p2', 'p2'], {}, targetCtx())).toBe('TARGET_DUPLICATE');
  });

  it('lets the Medium choose only the dead', () => {
    const medium = def('medium', 'medium_investigate').target;
    expect(checkTargets(medium, ['p4'], {}, targetCtx())).toBeNull();
    expect(checkTargets(medium, ['p2'], {}, targetCtx())).toBe('TARGET_LIFE');
  });

  it('allows self only where the rule does (OD-47)', () => {
    expect(checkTargets(one, [ACTOR], {}, targetCtx())).toBe('TARGET_SELF');
    expect(checkTargets(def('alpha_wolf', 'alpha_infect').target, [ACTOR], {}, targetCtx())).toBe('TARGET_SELF');
    expect(checkTargets(def('guard', 'guard_protect').target, [ACTOR], {}, targetCtx())).toBeNull();
    expect(checkTargets(def('witch', 'witch_save').target, [ACTOR], {}, targetCtx())).toBeNull();
  });

  it('stops the Guard protecting the same player two nights running, but not after a rest', () => {
    const guard = def('guard', 'guard_protect').target;
    const lastNight = targetCtx({ round: 3, lastUsedRound: 2, lastTargetPlayerId: 'p2' });
    expect(checkTargets(guard, ['p2'], {}, lastNight)).toBe('TARGET_REPEAT');
    expect(checkTargets(guard, ['p3'], {}, lastNight)).toBeNull();
    expect(checkTargets(guard, ['p2'], {}, { ...lastNight, lastUsedRound: 1 })).toBeNull();
    // A Seeker has no such rule.
    expect(checkTargets(one, ['p2'], {}, lastNight)).toBeNull();
  });

  it('takes no player ids for the informed Doctor, a Seeker reveal, or the Spy', () => {
    for (const rule of [def('doctor', 'doctor_save', 'doctor_infection').target, def('seeker', 'seeker_public_reveal').target, def('spy', 'spy_count').target]) {
      expect(checkTargets(rule, [], {}, targetCtx()), rule.kind).toBeNull();
      expect(checkTargets(rule, ['p2'], {}, targetCtx()), rule.kind).toBe('TARGET_COUNT');
    }
  });

  it('accepts only a whitelisted Prophet question, never free text', () => {
    const prophet = def('prophet', 'prophet_ask').target;
    expect(checkTargets(prophet, [], { question: 'WOLF_PACK_SIZE_AT_LEAST' }, targetCtx())).toBeNull();
    expect(checkTargets(prophet, [], { question: 'Is Rafi a wolf?' }, targetCtx())).toBe('PAYLOAD');
    expect(checkTargets(prophet, [], {}, targetCtx())).toBe('PAYLOAD');
    expect(checkTargets(prophet, [], { question: 'WOLF_PACK_SIZE_AT_LEAST', extra: 1 }, targetCtx())).toBe('PAYLOAD');
  });

  it('rejects a payload on every other rule', () => {
    expect(checkTargets(one, ['p2'], { note: 'hi' }, targetCtx())).toBe('PAYLOAD');
  });
});

describe('checkSubmission', () => {
  const seeker = def('seeker', 'seeker_investigate');

  it('accepts a legal submission and names its window', () => {
    expect(checkSubmission(submission(seeker))).toEqual({ ok: true, window: 'NIGHT_SUBMIT' });
  });

  it('maps each refusal to its contract code', () => {
    expect(checkSubmission(submission(seeker, { actorId: 'p2' }))).toMatchObject({ refusal: 'NOT_FOUND' });
    expect(checkSubmission(submission(def('jester', 'jester_day_vote_win'), { targetPlayerIds: [] }))).toMatchObject({ refusal: 'ACTION_NOT_YOUR_ABILITY' });
    expect(checkSubmission(submission(seeker, { ability: use(seeker, { status: 'REVOKED' }) }))).toMatchObject({ refusal: 'ACTION_NOT_YOUR_ABILITY', reason: 'REVOKED' });
    expect(checkSubmission(submission(seeker, { actorLife: 'DEAD' }))).toMatchObject({ refusal: 'ACTION_DEAD' });
    expect(checkSubmission(submission(seeker, { phase: 'NIGHT_HOST_CONFIRM' }))).toMatchObject({ refusal: 'ACTION_WRONG_PHASE' });
    expect(checkSubmission(submission(seeker, { ability: use(seeker, { chargesRemaining: 0 }) }))).toMatchObject({ refusal: 'ACTION_NO_CHARGES' });
    expect(checkSubmission(submission(seeker, { targetPlayerIds: ['p4'] }))).toMatchObject({ refusal: 'ACTION_TARGET_ILLEGAL', reason: 'TARGET_LIFE' });
  });

  it('never reads a target role: an Alpha may name anyone alive, wolves included', () => {
    // The resolver drops an ineligible infection silently. A refusal here would tell the Alpha who the wolves are.
    const infect = def('alpha_wolf', 'alpha_infect');
    for (const target of ['p2', 'p3']) expect(checkSubmission(submission(infect, { targetPlayerIds: [target] })).ok).toBe(true);
  });

  it('accepts a Ghost hint that names nobody, and refuses a name or a seat', () => {
    const hint = def('ghost', 'ghost_hint');
    const names = new Map([['p2', 'Rafi']]);
    const dead = { actorLife: 'DEAD' as const, actorDiedRound: 1, round: 2, targetPlayerIds: [] as string[] };
    expect(checkSubmission(submission(hint, { ...dead, payload: { hint: 'trust the quiet one' }, displayNames: names })).ok).toBe(true);
    expect(checkSubmission(submission(hint, { ...dead, payload: { hint: 'Rafi is safe' }, displayNames: names }))).toMatchObject({ reason: 'TEXT_NAMES_PLAYER' });
    expect(checkSubmission(submission(hint, { ...dead, payload: { hint: 'see seat 7' }, displayNames: names }))).toMatchObject({ reason: 'TEXT_NAMES_PLAYER' });
    expect(checkSubmission(submission(hint, { ...dead, payload: { hint: '' }, displayNames: names }))).toMatchObject({ reason: 'TEXT_LENGTH' });
    expect(checkSubmission(submission(hint, { actorLife: 'ALIVE', targetPlayerIds: [], payload: { hint: 'too soon' } }))).toMatchObject({ reason: 'NOT_YET' });
    expect(checkSubmission(submission(hint, { ...dead, round: 4, payload: { hint: 'too late' } }))).toMatchObject({ reason: 'EXPIRED' });
  });

  it('lists the other abilities in an exclusive group', () => {
    const kill = use(def('alpha_wolf', 'alpha_u20_kill', 'alpha_ultimate'));
    const infect = use(def('alpha_wolf', 'alpha_u20_infect', 'alpha_ultimate'));
    const rows = [
      { id: 'kill', config: kill.config },
      { id: 'infect', config: infect.config },
    ];
    expect(exclusiveSiblings(rows, rows[0]!).map((row) => row.id)).toEqual(['infect']);
    expect(exclusiveSiblings(rows, rows[1]!).map((row) => row.id)).toEqual(['kill']);
  });
});
