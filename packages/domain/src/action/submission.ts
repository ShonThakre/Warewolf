import type { AbilityDefinition, AbilityTiming, TargetRule } from '../catalog/types.js';
import type { GamePhase, GameStatus, LifeStatus } from '../game.js';
import type { AbilityStatus } from '../roles.js';
import type { PlayerId } from '../snapshot.js';
import { DEFAULT_CAPABILITY_REGISTRY, handlerFor, type CapabilityRegistry } from './registry.js';

/**
 * Whether a player may submit an ability right now, and with which targets
 * (WW-601 to WW-603). Pure: the API passes in the rows, under the game lock.
 *
 * Privacy rule: every check reads only what the actor already knows: the
 * phase, public life status, their own seat, and their own ability. A check
 * that read a target's role or team would answer "is that player a wolf?"
 * through the error code. Such rules (a wolf cannot be infected, the
 * infection cap) belong to the night resolver, which applies them silently.
 */

export const NIGHT_ACTION_STATUSES = ['PENDING', 'LOCKED', 'RESOLVED', 'REJECTED', 'CANCELLED'] as const;
export type NightActionStatus = (typeof NIGHT_ACTION_STATUSES)[number];

/** Phases in which players submit actions. Closing one locks its pending actions. */
export const ACTION_WINDOWS = ['NIGHT_SUBMIT', 'NIGHT_REACTION', 'DAY_DISCUSSION'] as const satisfies readonly GamePhase[];
export type ActionWindow = (typeof ACTION_WINDOWS)[number];

/**
 * The phase an ability is submitted in. Day abilities close before voting
 * opens (game-rules.md, section 6), so they belong to day discussion.
 */
export function actionWindow(timing: AbilityTiming): ActionWindow | null {
  switch (timing) {
    case 'NIGHT':
      return 'NIGHT_SUBMIT';
    case 'NIGHT_REACTION':
      return 'NIGHT_REACTION';
    case 'DAY':
      return 'DAY_DISCUSSION';
    case 'PASSIVE':
      return null;
  }
}

export function isActionWindow(phase: GamePhase): phase is ActionWindow {
  return (ACTION_WINDOWS as readonly GamePhase[]).includes(phase);
}

/** The parts of an ability instance row the rules read. */
export interface AbilityUse {
  readonly playerId: PlayerId;
  readonly status: AbilityStatus;
  /** Null is unlimited. */
  readonly chargesRemaining: number | null;
  readonly usesConsumed: number;
  readonly lastUsedRound: number | null;
  readonly lastTargetPlayerId: PlayerId | null;
  readonly availableFromRound: number;
  readonly expiresRound: number | null;
  /** The definition frozen on the instance, with this game's overrides. */
  readonly config: AbilityDefinition;
}

/**
 * Why an ability can or cannot be submitted now, in the order checked.
 * `OPEN` is the only one that accepts a submission.
 */
export const AVAILABILITIES = [
  'PASSIVE',
  'REVOKED',
  'DEAD',
  'NOT_THIS_PHASE',
  'NOT_YET',
  'EXPIRED',
  'NO_USES',
  'COOLDOWN',
  'OPEN',
] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export interface AvailabilityContext {
  readonly status: GameStatus;
  readonly phase: GamePhase;
  readonly round: number;
  readonly actorLife: LifeStatus;
  /** The round this actor died. Required for `actsWhileDead`. */
  readonly actorDiedRound?: number | null;
  readonly registry?: CapabilityRegistry;
}

/** WW-603: one ability's availability this phase. Shown to its owner and enforced on submit. */
export function availability(ability: AbilityUse, ctx: AvailabilityContext): Availability {
  const def = ability.config;
  const window = actionWindow(def.timing);
  if (!window || !handlerFor(def, ctx.registry ?? DEFAULT_CAPABILITY_REGISTRY)?.submittable) return 'PASSIVE';
  if (ability.status === 'REVOKED') return 'REVOKED';
  if (def.config['actsWhileDead'] === true) {
    // Ghost: a living actor is too early. A dead actor is open only the next night.
    if (ctx.actorLife === 'ALIVE') return 'NOT_YET';
    if (ctx.actorDiedRound == null || ctx.round !== ctx.actorDiedRound + 1) return 'EXPIRED';
  } else if (ctx.actorLife !== 'ALIVE') return 'DEAD';
  if (ctx.status !== 'ACTIVE' || ctx.phase !== window) return 'NOT_THIS_PHASE';
  if (ability.status === 'SCHEDULED' || ctx.round < ability.availableFromRound || (def.onlyRound !== null && ctx.round < def.onlyRound)) {
    return 'NOT_YET';
  }
  if ((def.onlyRound !== null && ctx.round > def.onlyRound) || (ability.expiresRound !== null && ctx.round > ability.expiresRound)) {
    return 'EXPIRED';
  }
  if (ability.status === 'EXHAUSTED' || ability.chargesRemaining === 0 || def.usesPerPhase === 0) return 'NO_USES';
  // "Every other night" is a cooldown of 1: used in round 1, rests in round 2, open in round 3.
  if (ability.lastUsedRound !== null && ctx.round - ability.lastUsedRound <= def.cooldownNights) return 'COOLDOWN';
  return 'OPEN';
}

export type ActionPayload = Readonly<Record<string, string | number | boolean>>;

/** Why a target list or payload is illegal. All are 422 ACTION_TARGET_ILLEGAL. */
export type TargetProblem =
  | 'TARGET_COUNT'
  | 'TARGET_DUPLICATE'
  | 'TARGET_UNKNOWN'
  | 'TARGET_LIFE'
  | 'TARGET_SELF'
  /** Guard and Shieldbearer: the same player as the previous round. */
  | 'TARGET_REPEAT'
  | 'PAYLOAD'
  /** Ghost hint: empty, or longer than the rule allows. */
  | 'TEXT_LENGTH'
  /** Ghost hint: names a player or a seat. */
  | 'TEXT_NAMES_PLAYER';

export interface TargetContext {
  readonly actorId: PlayerId;
  readonly round: number;
  /** Every seat in the game with its public life status. */
  readonly players: ReadonlyMap<PlayerId, LifeStatus>;
  /** Display names, for a TEXT hint that must not name a player. */
  readonly displayNames?: ReadonlyMap<PlayerId, string>;
  /** From the actor's own ability row. */
  readonly lastUsedRound: number | null;
  readonly lastTargetPlayerId: PlayerId | null;
}

/** The exclusive group on an ability, or null when it has none. Alpha and Mimic use one. */
export function exclusiveGroupOf(def: AbilityDefinition): string | null {
  const group = def.config['exclusiveGroup'];
  return typeof group === 'string' && group.length > 0 ? group : null;
}

/** Other abilities in the same exclusive group. The caller cancels their pending rows. */
export function exclusiveSiblings<T extends { readonly id: string; readonly config: AbilityDefinition }>(
  abilities: readonly T[],
  ability: T,
): T[] {
  const group = exclusiveGroupOf(ability.config);
  if (!group) return [];
  return abilities.filter((other) => other.id !== ability.id && exclusiveGroupOf(other.config) === group);
}

function namesPlayer(hint: string, names: ReadonlyMap<PlayerId, string> | undefined): boolean {
  if (/\bseat\s+\d+\b/i.test(hint) || /#\d+\b/.test(hint)) return true;
  if (!names) return false;
  for (const name of names.values()) {
    const trimmed = name.trim();
    if (trimmed.length < 2) continue;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(hint)) return true;
  }
  return false;
}

const isEmpty = (payload: ActionPayload) => Object.keys(payload).length === 0;

/** WW-602: the shared target rules. Only `QUESTION` takes a payload. */
export function checkTargets(rule: TargetRule, targets: readonly PlayerId[], payload: ActionPayload, ctx: TargetContext): TargetProblem | null {
  if (rule.kind === 'QUESTION') {
    const keys = Object.keys(payload);
    const question = payload['question'];
    if (keys.length !== 1 || typeof question !== 'string' || !(rule.questions as readonly string[]).includes(question)) return 'PAYLOAD';
    return targets.length === 0 ? null : 'TARGET_COUNT';
  }
  if (rule.kind === 'TEXT') {
    if (targets.length !== 0) return 'TARGET_COUNT';
    const keys = Object.keys(payload);
    const hint = payload['hint'];
    if (keys.length !== 1 || typeof hint !== 'string' || hint !== hint.trim()) return 'PAYLOAD';
    if (hint.length < 1 || hint.length > rule.maxLength) return 'TEXT_LENGTH';
    if (namesPlayer(hint, ctx.displayNames)) return 'TEXT_NAMES_PLAYER';
    return null;
  }
  if (!isEmpty(payload)) return 'PAYLOAD';

  switch (rule.kind) {
    case 'NONE':
    // The informed Doctor saves whoever the host confirmed; the server knows who.
    case 'FINAL_WOLF_TARGET':
    // A Seeker publishes their own stored result, which names its own target.
    case 'OWN_RESULT':
      return targets.length === 0 ? null : 'TARGET_COUNT';
    case 'PLAYERS': {
      if (targets.length !== rule.count) return 'TARGET_COUNT';
      if (new Set(targets).size !== targets.length) return 'TARGET_DUPLICATE';
      for (const target of targets) {
        const life = ctx.players.get(target);
        if (!life) return 'TARGET_UNKNOWN';
        if (life !== rule.life) return 'TARGET_LIFE';
        if (target === ctx.actorId && !rule.self) return 'TARGET_SELF';
        if (rule.notSameAsLastRound && ctx.lastUsedRound === ctx.round - 1 && target === ctx.lastTargetPlayerId) return 'TARGET_REPEAT';
      }
      return null;
    }
  }
}

/** Contract error codes for a refused submission. NOT_FOUND covers an ability the caller does not own. */
export type SubmissionRefusal =
  | 'NOT_FOUND'
  | 'ACTION_NOT_YOUR_ABILITY'
  | 'ACTION_DEAD'
  | 'ACTION_WRONG_PHASE'
  | 'ACTION_NO_CHARGES'
  | 'ACTION_TARGET_ILLEGAL';

const REFUSAL_BY_AVAILABILITY: Readonly<Record<Exclude<Availability, 'OPEN'>, SubmissionRefusal>> = {
  PASSIVE: 'ACTION_NOT_YOUR_ABILITY',
  REVOKED: 'ACTION_NOT_YOUR_ABILITY',
  DEAD: 'ACTION_DEAD',
  NOT_THIS_PHASE: 'ACTION_WRONG_PHASE',
  NOT_YET: 'ACTION_WRONG_PHASE',
  EXPIRED: 'ACTION_WRONG_PHASE',
  NO_USES: 'ACTION_NO_CHARGES',
  COOLDOWN: 'ACTION_NO_CHARGES',
};

export interface SubmissionInput extends AvailabilityContext {
  readonly actorId: PlayerId;
  readonly ability: AbilityUse;
  readonly players: ReadonlyMap<PlayerId, LifeStatus>;
  readonly displayNames?: ReadonlyMap<PlayerId, string>;
  readonly targetPlayerIds: readonly PlayerId[];
  readonly payload: ActionPayload;
}

export type SubmissionCheck =
  | { readonly ok: true; readonly window: ActionWindow }
  | { readonly ok: false; readonly refusal: SubmissionRefusal; readonly reason: Exclude<Availability, 'OPEN'> | TargetProblem | 'NOT_OWNER' };

/**
 * The submission gate (implementation-plan.md, section 6, "Execution"):
 * owner, then availability (passive, revoked, life, phase, round, uses,
 * cooldown), then targets.
 */
export function checkSubmission(input: SubmissionInput): SubmissionCheck {
  if (input.ability.playerId !== input.actorId) return { ok: false, refusal: 'NOT_FOUND', reason: 'NOT_OWNER' };
  const open = availability(input.ability, input);
  if (open !== 'OPEN') return { ok: false, refusal: REFUSAL_BY_AVAILABILITY[open], reason: open };

  const problem = checkTargets(input.ability.config.target, input.targetPlayerIds, input.payload, {
    actorId: input.actorId,
    round: input.round,
    players: input.players,
    ...(input.displayNames ? { displayNames: input.displayNames } : {}),
    lastUsedRound: input.ability.lastUsedRound,
    lastTargetPlayerId: input.ability.lastTargetPlayerId,
  });
  if (problem) return { ok: false, refusal: 'ACTION_TARGET_ILLEGAL', reason: problem };
  return { ok: true, window: actionWindow(input.ability.config.timing)! };
}

/** The ability row after one resolved use. */
export interface UsePatch {
  readonly chargesRemaining: number | null;
  readonly usesConsumed: number;
  readonly lastUsedRound: number;
  readonly lastTargetPlayerId: PlayerId | null;
  readonly status: AbilityStatus;
}

/**
 * WW-603: what one resolved use does to its ability row. The resolver
 * (WW-802) calls it for every action that spent a use, including a redundant
 * protection (OD-48). Unlimited abilities stay unlimited; a finite one is
 * exhausted at 0, which stops a Witch potion after one use.
 */
export function consumeUse(ability: AbilityUse, round: number, targetPlayerIds: readonly PlayerId[]): UsePatch {
  const chargesRemaining = ability.chargesRemaining === null ? null : Math.max(0, ability.chargesRemaining - 1);
  return {
    chargesRemaining,
    usesConsumed: ability.usesConsumed + 1,
    lastUsedRound: round,
    lastTargetPlayerId: targetPlayerIds[0] ?? null,
    status: chargesRemaining === 0 ? 'EXHAUSTED' : ability.status,
  };
}
