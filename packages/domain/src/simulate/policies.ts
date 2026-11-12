import { availability, checkSubmission, exclusiveGroupOf, type ActionPayload } from '../action/submission.js';
import type { TargetRule } from '../catalog/types.js';
import type { LifeStatus } from '../game.js';
import type { PlayerId } from '../snapshot.js';
import type { Rng } from './rng.js';
import { type BotAction, type BotChoice, type ProjectedAbility, type SeatProjection } from './view.js';

export const POLICY_IDS = ['random-legal', 'infection-priority', 'vote-random', 'saving-doctor'] as const;
export type PolicyId = (typeof POLICY_IDS)[number];

export interface Policy {
  readonly id: PolicyId;
  choose(view: SeatProjection, rng: Rng): BotChoice;
}

/**
 * Uniform among the legal target sets for each open ability, plus skipping it.
 * An exclusive group contributes one choice or a skip, never two.
 * `infection-priority` uses the same night choices: a public heuristic cannot
 * know who holds a power, so the testing plan says to choose randomly.
 */
function nightActions(view: SeatProjection, rng: Rng): BotAction[] {
  const players = new Map(view.seats.map((seat) => [seat.id, seat.lifeStatus]));
  const open = view.abilities.filter(
    (ability) =>
      availability(toUse(view.selfId, ability), {
        status: 'ACTIVE',
        phase: view.phase,
        round: view.round,
        actorLife: view.lifeStatus,
      }) === 'OPEN',
  );
  const grouped = new Map<string, ProjectedAbility[]>();
  const single: ProjectedAbility[] = [];
  for (const ability of open) {
    const group = exclusiveGroupOf(ability.config);
    if (!group) single.push(ability);
    else grouped.set(group, [...(grouped.get(group) ?? []), ability]);
  }
  const chosen: BotAction[] = [];
  for (const ability of single) pickOne(chosen, view, ability, players, rng);
  for (const group of grouped.values()) {
    const options = group.flatMap((ability) => legalSets(view, ability, players).map((set) => ({ ability, set })));
    if (options.length === 0) continue;
    const pick = rng.int(options.length + 1);
    if (pick === options.length) continue;
    const option = options[pick]!;
    chosen.push({ abilityInstanceId: option.ability.id, targetPlayerIds: option.set.targets, payload: option.set.payload });
  }
  return chosen;
}

function pickOne(chosen: BotAction[], view: SeatProjection, ability: ProjectedAbility, players: Map<PlayerId, LifeStatus>, rng: Rng): void {
  const sets = legalSets(view, ability, players);
  if (sets.length === 0) return;
  const pick = rng.int(sets.length + 1);
  if (pick === sets.length) return;
  const set = sets[pick]!;
  chosen.push({ abilityInstanceId: ability.id, targetPlayerIds: set.targets, payload: set.payload });
}

function legalSets(
  view: SeatProjection,
  ability: ProjectedAbility,
  players: Map<PlayerId, LifeStatus>,
): { targets: PlayerId[]; payload: ActionPayload }[] {
  const rule = ability.config.target;
  const candidates = candidateTargets(rule, view);
  const payloads: ActionPayload[] = rule.kind === 'QUESTION' ? rule.questions.map((question) => ({ question })) : [{}];
  const sets: { targets: PlayerId[]; payload: ActionPayload }[] = [];
  for (const payload of payloads) {
    for (const targets of candidates) {
      const check = checkSubmission({
        status: 'ACTIVE',
        phase: view.phase,
        round: view.round,
        actorLife: view.lifeStatus,
        actorId: view.selfId,
        ability: toUse(view.selfId, ability),
        players,
        targetPlayerIds: targets,
        payload,
      });
      if (check.ok) sets.push({ targets, payload });
    }
  }
  return sets;
}

function candidateTargets(rule: TargetRule, view: SeatProjection): PlayerId[][] {
  if (rule.kind === 'TEXT') return [];
  if (rule.kind !== 'PLAYERS') return [[]];
  const pool = view.seats.map((seat) => seat.id);
  if (rule.count <= 1) return pool.map((id) => [id]);
  return combinations(pool, rule.count).slice(0, 256);
}

function combinations(ids: readonly PlayerId[], count: number): PlayerId[][] {
  const out: PlayerId[][] = [];
  const walk = (start: number, chosen: PlayerId[]) => {
    if (chosen.length === count) {
      out.push([...chosen]);
      return;
    }
    for (let i = start; i < ids.length && out.length < 256; i++) {
      chosen.push(ids[i]!);
      walk(i + 1, chosen);
      chosen.pop();
    }
  };
  walk(0, []);
  return out;
}

function toUse(playerId: PlayerId, ability: ProjectedAbility) {
  return { playerId, ...ability, config: ability.config };
}

function killChoice(view: SeatProjection, rng: Rng): BotChoice {
  const options: (PlayerId | null)[] = [...(view.killCandidates ?? []), null];
  return { kind: 'KILL', targetPlayerId: options[rng.int(options.length)] ?? null };
}

function voteChoice(view: SeatProjection, rng: Rng, allowAbstain: boolean): BotChoice {
  const targets = allowAbstain ? view.voteTargets : view.voteTargets.filter((id): id is PlayerId => id !== null);
  if (targets.length === 0) return { kind: 'VOTE', targetPlayerId: null };
  return { kind: 'VOTE', targetPlayerId: targets[rng.int(targets.length)] ?? null };
}

function chooseRandom(view: SeatProjection, rng: Rng, votes: 'abstain' | 'living'): BotChoice {
  if (view.window === 'KILL') return killChoice(view, rng);
  if (view.window === 'VOTE') return voteChoice(view, rng, votes === 'abstain');
  return { kind: 'ACTIONS', actions: nightActions(view, rng) };
}

/**
 * `saving-doctor` (WW-1402 follow-up): `random-legal`, except that a seat told
 * the final wolf target always spends its save on it. This measures the OD-02
 * case directly: an informed Doctor with unlimited saves who never declines.
 * It knows only what the projection tells that seat.
 */
function savingChoice(view: SeatProjection, rng: Rng): BotChoice {
  const random = chooseRandom(view, rng, 'abstain');
  if (view.window !== 'NIGHT_REACTION' || !view.finalWolfTarget || random.kind !== 'ACTIONS') return random;
  const players = new Map(view.seats.map((seat) => [seat.id, seat.lifeStatus]));
  const actions = [...random.actions];
  for (const ability of view.abilities) {
    if (ability.config.target.kind !== 'FINAL_WOLF_TARGET') continue;
    if (actions.some((action) => action.abilityInstanceId === ability.id)) continue;
    const set = legalSets(view, ability, players)[0];
    if (set) actions.push({ abilityInstanceId: ability.id, targetPlayerIds: set.targets, payload: set.payload });
  }
  return { kind: 'ACTIONS', actions };
}

export const POLICIES: Readonly<Record<PolicyId, Policy>> = {
  'saving-doctor': { id: 'saving-doctor', choose: savingChoice },
  'random-legal': { id: 'random-legal', choose: (view, rng) => chooseRandom(view, rng, 'abstain') },
  'infection-priority': { id: 'infection-priority', choose: (view, rng) => chooseRandom(view, rng, 'living') },
  'vote-random': {
    id: 'vote-random',
    choose: (view, rng) => (view.window === 'VOTE' ? voteChoice(view, rng, false) : view.window === 'KILL' ? killChoice(view, rng) : { kind: 'ACTIONS', actions: [] }),
  },
};
