import type { RoleCatalog } from '../catalog/catalog.js';
import type { AbilityDefinition, ProphetQuestion, ResultKind } from '../catalog/types.js';
import type { LifeStatus } from '../game.js';
import type { PlayerId } from '../snapshot.js';
import type { InformationValue, NightAction, NightAssignment, RoleCategoryReport, Visit } from './types.js';

/**
 * Steps 3 and 17 (night-resolution.md): private facts for investigators.
 * Everything except tracking reads the start-of-night state, so a check on
 * tonight's infection target still reads their old alignment (OD-38).
 * Tracking reads this night's surviving actions (section 4).
 */

/** Result kinds the information step answers. ATTACKER_IDS belongs to traps (step 6). */
export const INFORMATION_KINDS: ReadonlySet<ResultKind> = new Set<ResultKind>([
  'ALIGNMENT_WOLF_OR_NOT',
  'ROLE_CATEGORY',
  'ROLE_ID',
  'SAME_OR_DIFFERENT_FACTION',
  'ROLE_AT_DEATH',
  'VISITED_PLAYER_IDS',
  'YES_NO',
  'WOLF_KILL_SUBMISSION_COUNT',
  'FACTION',
]);

export interface InformationContext {
  readonly catalog: RoleCatalog;
  readonly life: ReadonlyMap<PlayerId, LifeStatus>;
  readonly assignment: ReadonlyMap<PlayerId, NightAssignment>;
  readonly assignments: readonly NightAssignment[];
  /** Each player's visits tonight: actions that survived step 2, in both night windows. */
  readonly visits: ReadonlyMap<PlayerId, readonly Visit[]>;
  /** Wolf-kill submissions that survived step 2 (OD-19). */
  readonly wolfKillSubmissions: number;
  readonly includeActionTypes: boolean;
}

/** Why an information ability cannot be answered, checked in step 1 so it spends nothing. Null when it can. */
export function unanswerable(def: AbilityDefinition): string | null {
  if (!def.result || !INFORMATION_KINDS.has(def.result)) return 'result kind';
  // A lie table was never specified, so only a truthful Seer exists (OD-22).
  if (def.result === 'ROLE_ID' && def.config['accuracyPercent'] !== undefined && def.config['accuracyPercent'] !== 100) return 'accuracy';
  if (def.result === 'YES_NO' && typeof def.config['packSizeAtLeast'] !== 'number') return 'question threshold';
  return null;
}

/** One investigator's answer. */
export function informationFor(def: AbilityDefinition, action: NightAction, ctx: InformationContext): InformationValue {
  const [first, second] = action.targetPlayerIds;
  const of = (playerId: PlayerId | undefined) => (playerId ? ctx.assignment.get(playerId) : undefined);

  switch (def.result) {
    case 'ALIGNMENT_WOLF_OR_NOT':
      return { kind: 'ALIGNMENT_WOLF_OR_NOT', value: of(first)?.wolfAligned ? 'WOLF' : 'NOT_WOLF' };
    case 'ROLE_CATEGORY':
      return { kind: 'ROLE_CATEGORY', value: roleCategory(of(first), ctx.catalog) };
    case 'ROLE_ID':
      return { kind: 'ROLE_ID', value: of(first)?.currentRoleId ?? 'unknown' };
    case 'ROLE_AT_DEATH':
      // A dead player's current role is the role they died with: conversions only reach the living.
      return { kind: 'ROLE_AT_DEATH', value: of(first)?.currentRoleId ?? 'unknown' };
    case 'SAME_OR_DIFFERENT_FACTION':
      // OD-24: current faction. Two Neutrals read as the same faction.
      return { kind: 'SAME_OR_DIFFERENT_FACTION', value: of(first)?.currentFaction === of(second)?.currentFaction ? 'SAME' : 'DIFFERENT' };
    case 'VISITED_PLAYER_IDS': {
      const visits = first ? (ctx.visits.get(first) ?? []) : [];
      const ids = [...new Set(visits.map((v) => v.playerId))].sort();
      const typed = [...new Map(visits.map((v) => [`${v.playerId}|${v.capability}`, v])).values()].sort((a, b) =>
        a.playerId === b.playerId ? String(a.capability).localeCompare(String(b.capability)) : a.playerId < b.playerId ? -1 : 1,
      );
      return { kind: 'VISITED_PLAYER_IDS', value: ids, visits: ctx.includeActionTypes ? typed : null };
    }
    case 'YES_NO': {
      const question = action.payload['question'] as ProphetQuestion;
      const threshold = def.config['packSizeAtLeast'] as number;
      const pack = ctx.assignments.filter((a) => a.currentFaction === 'WOLF_PACK' && ctx.life.get(a.playerId) === 'ALIVE').length;
      return { kind: 'YES_NO', question, threshold, value: pack >= threshold };
    }
    case 'WOLF_KILL_SUBMISSION_COUNT':
      return { kind: 'WOLF_KILL_SUBMISSION_COUNT', value: ctx.wolfKillSubmissions };
    case 'FACTION':
      return { kind: 'FACTION', value: of(first)?.currentFaction ?? 'VILLAGE' };
    default:
      // `unanswerable` rejected every other kind in step 1.
      throw new Error(`No information handler for ${String(def.result)}`);
  }
}

/**
 * OD-21. Read from the current faction, so a Lone Wolf reads Independent and a
 * Neutral seat reads Neutral. A Village role with no ability at all is basic;
 * any ability, even a passive one, is a power.
 */
function roleCategory(target: NightAssignment | undefined, catalog: RoleCatalog): RoleCategoryReport {
  switch (target?.currentFaction) {
    case 'WOLF_PACK':
      return 'WOLF';
    case 'NEUTRAL':
      return 'NEUTRAL';
    case 'INDEPENDENT':
      return 'INDEPENDENT';
    default: {
      const profile = target ? catalog.byId.get(target.currentRoleId)?.profiles[target.currentProfileId] : undefined;
      return profile && profile.abilities.length > 0 ? 'VILLAGE_POWER' : 'VILLAGE_BASIC';
    }
  }
}
