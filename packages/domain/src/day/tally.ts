import { DEFAULT_CATALOG, type RoleCatalog } from '../catalog/catalog.js';
import type { AbilityDefinition, IndividualTrigger } from '../catalog/types.js';
import type { LifeStatus } from '../game.js';
import type { AbilityStatus } from '../roles.js';
import type { PlayerId, RoleId } from '../snapshot.js';

/**
 * Pure day tally (the domain half of WW-901). Every mode uses it. The ballot
 * API calls it later. Living voters only. A unique top count is the
 * elimination. A tie on the first ballot is reported and not eliminated. A
 * tie on the revote eliminates nobody.
 */

export type DayBallot = 'FIRST' | 'REVOTE';

export interface TallyVote {
  readonly voterId: PlayerId;
  /** Null is an abstention. */
  readonly targetId: PlayerId | null;
}

/** Mind Controller: this voter's cast ballot goes to `targetId` instead. An abstention is left alone. */
export interface TallyMindControl {
  readonly voterId: PlayerId;
  readonly targetId: PlayerId;
}

export const CHAOS_DAY_KINDS = ['NO_VOTE', 'SWAP_VOTES', 'DOUBLE_VOTE'] as const;
export type ChaosDayKind = (typeof CHAOS_DAY_KINDS)[number];

export interface TallyChaosEffect {
  readonly kind: ChaosDayKind;
  readonly playerIds: readonly PlayerId[];
}

export interface TallyAbility {
  readonly playerId: PlayerId;
  readonly status: AbilityStatus;
  readonly config: AbilityDefinition;
}

export interface TallyAssignment {
  readonly playerId: PlayerId;
  readonly currentRoleId: RoleId;
  readonly currentProfileId: string;
}

export interface TallyInput {
  readonly round: number;
  readonly ballot: DayBallot;
  readonly players: readonly { readonly id: PlayerId; readonly lifeStatus: LifeStatus }[];
  readonly assignments: readonly TallyAssignment[];
  readonly abilities: readonly TallyAbility[];
  readonly votes: readonly TallyVote[];
  readonly mindControl?: readonly TallyMindControl[];
  readonly chaosEffects?: readonly TallyChaosEffect[];
  /** When the configuration allows it, a dead player's stored vote still counts. Targets must still be alive. */
  readonly countDeadVotes?: boolean;
  readonly catalog?: RoleCatalog;
}

export interface TallyIndividualWin {
  readonly playerId: PlayerId;
  readonly trigger: IndividualTrigger;
}

export interface TallyActionOutcome {
  readonly kind: 'MIND_CONTROL';
  readonly voterId: PlayerId;
  readonly applied: boolean;
}

export interface TallyChaosOutcome {
  readonly kind: ChaosDayKind;
  readonly applied: boolean;
}

export interface TallyResult {
  readonly eliminated: PlayerId | null;
  readonly tied: readonly PlayerId[];
  readonly counts: Readonly<Record<PlayerId, number>>;
  readonly individualWins: readonly TallyIndividualWin[];
  readonly chaosOutcomes: readonly TallyChaosOutcome[];
  readonly actionOutcomes: readonly TallyActionOutcome[];
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Base 1, plus each vote modifier's extra (`weight - 1`). Elder is 2. Elder
 * and Mayor together are 3, the sum of the extras, not 2 × 2.
 */
export function voteWeight(playerId: PlayerId, abilities: readonly TallyAbility[]): number {
  const extra = abilities
    .filter((a) => a.playerId === playerId && a.status === 'ACTIVE' && a.config.capability === 'VOTE_MODIFIER')
    .map((a) => a.config.config['weight'])
    .filter((w): w is number => typeof w === 'number')
    .reduce((sum, w) => sum + Math.max(0, w - 1), 0);
  return 1 + extra;
}

/**
 * Tallies one ballot. Chaos day effects apply in order: no-vote, then the
 * vote swap, then the double vote. Mind Controller redirects run first, and
 * they do not turn an abstention into a vote.
 */
export function tallyDay(input: TallyInput): TallyResult {
  const catalog = input.catalog ?? DEFAULT_CATALOG;
  const alive = new Set(input.players.filter((p) => p.lifeStatus === 'ALIVE').map((p) => p.id));
  const canVote = input.countDeadVotes ? new Set(input.players.map((p) => p.id)) : alive;
  const actionOutcomes: TallyActionOutcome[] = [];
  const redirects = new Map((input.mindControl ?? []).map((m) => [m.voterId, m.targetId]));

  let ballots = input.votes
    .filter((v) => canVote.has(v.voterId))
    .map((v) => {
      if (v.targetId === null || !redirects.has(v.voterId)) return v;
      const targetId = redirects.get(v.voterId)!;
      return { voterId: v.voterId, targetId: alive.has(targetId) ? targetId : v.targetId };
    });
  for (const control of input.mindControl ?? []) {
    const vote = input.votes.find((v) => v.voterId === control.voterId);
    const applied = !!vote && vote.targetId !== null && canVote.has(vote.voterId) && alive.has(control.targetId);
    actionOutcomes.push({ kind: 'MIND_CONTROL', voterId: control.voterId, applied });
  }

  const chaosOutcomes: TallyChaosOutcome[] = [];
  for (const effect of input.chaosEffects ?? []) {
    if (effect.kind === 'NO_VOTE') {
      const before = ballots.length;
      const blocked = new Set(effect.playerIds);
      ballots = ballots.filter((v) => !blocked.has(v.voterId));
      chaosOutcomes.push({ kind: effect.kind, applied: ballots.length !== before });
      continue;
    }
    if (effect.kind === 'SWAP_VOTES') {
      const [first, second] = effect.playerIds;
      const left = ballots.find((v) => v.voterId === first);
      const right = ballots.find((v) => v.voterId === second);
      if (!left || !right || left.targetId === null || right.targetId === null) {
        chaosOutcomes.push({ kind: effect.kind, applied: false });
        continue;
      }
      const swapped = left.targetId;
      ballots = ballots.map((v) => {
        if (v.voterId === left.voterId) return { ...v, targetId: right.targetId };
        if (v.voterId === right.voterId) return { ...v, targetId: swapped };
        return v;
      });
      chaosOutcomes.push({ kind: effect.kind, applied: left.targetId !== right.targetId });
      continue;
    }
    chaosOutcomes.push({ kind: effect.kind, applied: ballots.some((v) => v.voterId === effect.playerIds[0] && v.targetId !== null) });
  }

  const doubled = new Set((input.chaosEffects ?? []).filter((e) => e.kind === 'DOUBLE_VOTE').flatMap((e) => e.playerIds));
  const counts = new Map<PlayerId, number>();
  for (const vote of ballots) {
    if (vote.targetId === null || !alive.has(vote.targetId)) continue;
    const weight = voteWeight(vote.voterId, input.abilities) * (doubled.has(vote.voterId) ? 2 : 1);
    counts.set(vote.targetId, (counts.get(vote.targetId) ?? 0) + weight);
  }

  const top = Math.max(0, ...counts.values());
  const leaders = [...counts.entries()].filter(([, n]) => n === top && n > 0).map(([id]) => id).sort(byString);
  const tied = leaders.length > 1 ? leaders : [];
  const eliminated = leaders.length === 1 ? leaders[0]! : null;

  const individualWins: TallyIndividualWin[] = [];
  if (eliminated) {
    const assignment = input.assignments.find((a) => a.playerId === eliminated);
    const profile = assignment ? catalog.byId.get(assignment.currentRoleId)?.profiles[assignment.currentProfileId] : undefined;
    const trigger = profile?.victory.type === 'INDIVIDUAL' ? profile.victory.trigger : null;
    const dayWin = profile?.abilities.some((a) => a.handlerKey === 'jester.onDayElimination') === true;
    if (trigger === 'ELIMINATED_BY_DAY_VOTE' && dayWin) individualWins.push({ playerId: eliminated, trigger });
  }

  return {
    eliminated,
    tied: input.ballot === 'REVOTE' ? tied : tied,
    counts: Object.fromEntries([...counts.entries()].sort(([a], [b]) => byString(a, b))),
    individualWins,
    chaosOutcomes,
    actionOutcomes,
  };
}
