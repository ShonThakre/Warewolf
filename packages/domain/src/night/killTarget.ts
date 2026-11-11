import type { PlayerId } from '../snapshot.js';
import { resolveNight } from './resolve.js';
import type { HostKillDecision, NightInput } from './types.js';

/**
 * WW-803: the host's kill confirmation (OD-01, night-resolution.md,
 * section 3). The host picks the final target among the players the wolves
 * actually named. The function never invents a target.
 */

/** One player the pack named tonight, and every wolf who named them. Host only. */
export interface KillCandidate {
  readonly playerId: PlayerId;
  readonly submittedBy: readonly PlayerId[];
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The legal choices for the host: targets of the pack's wolf-kill
 * submissions in the submission window, alive, and not a pack member when
 * friendly fire is off. Read from the locked actions before resolution, so a
 * wolf blocked by a Disruptor still appears here; the resolver drops that
 * contribution (step 2). The Lone Wolf's kill is its own attack and never a
 * candidate (section 3).
 */
export function packKillCandidates(input: Pick<NightInput, 'config' | 'players' | 'assignments' | 'abilities' | 'actions'>): KillCandidate[] {
  const alive = new Set(input.players.filter((p) => p.lifeStatus === 'ALIVE').map((p) => p.id));
  const faction = new Map(input.assignments.map((a) => [a.playerId, a.currentFaction]));
  const isPack = (playerId: PlayerId) => faction.get(playerId) === 'WOLF_PACK';
  const abilities = new Map(input.abilities.map((a) => [a.id, a]));

  const named = new Map<PlayerId, PlayerId[]>();
  for (const action of input.actions) {
    const ability = abilities.get(action.abilityInstanceId);
    if (action.phase !== 'NIGHT_SUBMIT' || !ability || ability.playerId !== action.playerId || ability.status !== 'ACTIVE') continue;
    if (ability.config.capability !== 'KILL' || ability.config.attackType !== 'WOLF_KILL' || !isPack(action.playerId)) continue;
    const target = action.targetPlayerIds[0];
    if (!target || !alive.has(target) || (!input.config.wolves.friendlyFire && isPack(target))) continue;
    named.set(target, [...(named.get(target) ?? []), action.playerId]);
  }
  return [...named.entries()]
    .sort(([a], [b]) => byString(a, b))
    .map(([playerId, wolves]) => ({ playerId, submittedBy: [...new Set(wolves)].sort(byString) }));
}

/** Why the host's choice is refused. Null when it is legal. */
export function hostDecisionProblem(decision: HostKillDecision, candidates: readonly KillCandidate[]): 'NOT_SUBMITTED' | null {
  if (decision.kind === 'NO_KILL') return null;
  return candidates.some((c) => c.playerId === decision.playerId) ? null : 'NOT_SUBMITTED';
}

/**
 * The target the informed Doctor is shown in the reaction window (OD-02):
 * exactly the final target step 4 will attack, with tonight's blocks
 * applied, or null when there is no attack. Computed by the resolver itself,
 * from the submission window's actions, so the two can never disagree.
 */
export function finalWolfTarget(input: NightInput): PlayerId | null {
  return resolveNight({ ...input, actions: input.actions.filter((a) => a.phase === 'NIGHT_SUBMIT'), effects: [] }).finalWolfTarget;
}
