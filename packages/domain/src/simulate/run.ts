import { dealRoles } from '../assignment/deal.js';
import type { AbilityDefinition } from '../catalog/types.js';
import { getPack } from '../config/packs.js';
import { tallyDay } from '../day/tally.js';
import type { Faction } from '../factions.js';
import type { LifeStatus } from '../game.js';
import { resolveNight } from '../night/resolve.js';
import type { HostKillDecision, NightAbility, NightAction, NightEffect, NightInput, NightResult } from '../night/types.js';
import type { AbilitySource, AbilityStatus, IndividualVictoryState } from '../roles.js';
import type { PlayerId } from '../snapshot.js';
import { evaluateVictory, type VictoryResult } from '../victory/evaluate.js';
import { POLICIES, type PolicyId } from './policies.js';
import { mulberry32, type Rng } from './rng.js';
import type { BotChoice, ProjectedAbility, SeatProjection } from './view.js';

/**
 * Seeded batch runner (WW-1401). Bots receive `SeatProjection` only. The
 * harness keeps the roster so it can call `resolveNight`, and it never passes
 * that roster into a policy. Frequencies are measurements of the bots.
 */
export interface SimulationReport {
  readonly presetId: string;
  readonly policyId: PolicyId;
  readonly seed: number;
  readonly games: number;
  readonly finished: number;
  readonly note: string;
  readonly finish: { readonly VILLAGE: number; readonly WOLF_PACK: number; readonly draw: number; readonly other: number };
  readonly individuals: Readonly<Record<string, number>>;
  readonly rounds: { readonly mean: number; readonly median: number };
  readonly deaths: { readonly nightMean: number; readonly dayMean: number };
  readonly infectionSuccesses: Readonly<Record<string, number>>;
  readonly survivalByStartingRole: Readonly<Record<string, number>>;
  readonly abilityUseRate: Readonly<Record<string, number>>;
  /** Wolf attacks whose target was saved by a Doctor, divided by wolf attacks. */
  readonly doctorNegatedFraction: number;
}

export interface SimulateOptions {
  readonly presetId?: string;
  readonly games: number;
  readonly seed: number;
  readonly policyId?: PolicyId;
  /** Called with each projection before the policy chooses. For the privacy test. */
  readonly onView?: (view: SeatProjection) => void;
}

interface SimPlayer {
  id: PlayerId;
  lifeStatus: LifeStatus;
  startingRoleId: string;
}

interface SimAssignment {
  playerId: PlayerId;
  currentRoleId: string;
  currentProfileId: string;
  currentFaction: Faction;
  wolfAligned: boolean;
  individualVictory: IndividualVictoryState;
  markTargetPlayerId: PlayerId | null;
}

interface SimAbility {
  id: string;
  playerId: PlayerId;
  abilityId: string;
  definition: AbilityDefinition;
  status: AbilityStatus;
  chargesRemaining: number | null;
  usesConsumed: number;
  lastUsedRound: number | null;
  lastTargetPlayerId: PlayerId | null;
  availableFromRound: number;
  expiresRound: number | null;
  source: AbilitySource;
}

interface SimEffect extends NightEffect {
  status: 'ACTIVE' | 'SPENT' | 'EXPIRED';
}

interface Table {
  round: number;
  hostId: PlayerId;
  players: Map<PlayerId, SimPlayer>;
  assignments: Map<PlayerId, SimAssignment>;
  abilities: SimAbility[];
  effects: SimEffect[];
  logs: Map<PlayerId, { round: number; kind: string; value: unknown }[]>;
  infection: { successes: number; sealed: boolean };
  nextId: number;
}

const NOTE = 'Bot measurements for this seed and policy. Not a human win rate.';

export function simulate(options: SimulateOptions): SimulationReport {
  const presetId = options.presetId ?? 'infection-core';
  const policyId = options.policyId ?? 'random-legal';
  const policy = POLICIES[policyId];
  const pack = getPack(presetId);
  if (!policy) throw new Error(`simulate: unknown policy ${policyId}`);
  if (!pack) throw new Error(`simulate: unknown preset ${presetId}`);
  const config = pack.config;
  const rng = mulberry32(options.seed);
  const finish = { VILLAGE: 0, WOLF_PACK: 0, draw: 0, other: 0 };
  const individuals: Record<string, number> = {};
  const rounds: number[] = [];
  let nightDeaths = 0;
  let dayDeaths = 0;
  let wolfAttacks = 0;
  let doctorNegated = 0;
  const infectionCounts: Record<string, number> = {};
  const seated = new Map<string, number>();
  const survived = new Map<string, number>();
  const uses = new Map<string, number>();
  let finished = 0;

  for (let n = 0; n < options.games; n++) {
    const ids = Array.from({ length: config.playerCount }, (_, i) => `p${i + 1}`);
    const dealt = dealRoles(config, ids, rng.int);
    const table = emptyTable(ids[0]!, dealt);
    let victory: VictoryResult = { ended: false, team: null, draw: false, individuals: [], chaosAchieved: false };
    let round = 1;
    for (; round <= config.roundCap; round++) {
      table.round = round;
      const night = playNight(table, config, policy, rng, options.onView, uses);
      nightDeaths += night.deaths;
      wolfAttacks += night.attack ? 1 : 0;
      doctorNegated += night.doctorSaved ? 1 : 0;
      victory = judge(table, config.roundCap, round, []);
      if (victory.ended) break;
      const day = playDay(table, config.voting.abstain, policy, rng, options.onView);
      dayDeaths += day.deaths;
      victory = judge(table, config.roundCap, round, day.votedOut);
      if (victory.ended) break;
    }
    finished += 1;
    rounds.push(round);
    if (victory.team === 'VILLAGE') finish.VILLAGE += 1;
    else if (victory.team === 'WOLF_PACK') finish.WOLF_PACK += 1;
    else if (victory.draw || victory.team === null) finish.draw += 1;
    else finish.other += 1;
    for (const win of victory.individuals) {
      if (win.state !== 'ACHIEVED') continue;
      const role = table.players.get(win.playerId)?.startingRoleId ?? win.trigger;
      individuals[role] = (individuals[role] ?? 0) + 1;
    }
    const successes = String(table.infection.successes);
    infectionCounts[successes] = (infectionCounts[successes] ?? 0) + 1;
    for (const player of table.players.values()) {
      seated.set(player.startingRoleId, (seated.get(player.startingRoleId) ?? 0) + 1);
      if (player.lifeStatus === 'ALIVE') survived.set(player.startingRoleId, (survived.get(player.startingRoleId) ?? 0) + 1);
    }
  }

  const games = options.games;
  const survivalByStartingRole: Record<string, number> = {};
  for (const [role, count] of seated) survivalByStartingRole[role] = count === 0 ? 0 : (survived.get(role) ?? 0) / count;
  const abilityUseRate: Record<string, number> = {};
  for (const [abilityId, count] of uses) abilityUseRate[abilityId] = games === 0 ? 0 : count / games;

  return {
    presetId,
    policyId,
    seed: options.seed,
    games,
    finished,
    note: NOTE,
    finish,
    individuals,
    rounds: { mean: mean(rounds), median: median(rounds) },
    deaths: { nightMean: games === 0 ? 0 : nightDeaths / games, dayMean: games === 0 ? 0 : dayDeaths / games },
    infectionSuccesses: infectionCounts,
    survivalByStartingRole,
    abilityUseRate,
    doctorNegatedFraction: wolfAttacks === 0 ? 0 : doctorNegated / wolfAttacks,
  };
}

function emptyTable(hostId: PlayerId, dealt: ReturnType<typeof dealRoles>): Table {
  const table: Table = {
    round: 1,
    hostId,
    players: new Map(),
    assignments: new Map(),
    abilities: [],
    effects: [],
    logs: new Map(),
    infection: { successes: 0, sealed: false },
    nextId: 1,
  };
  for (const card of dealt) {
    table.players.set(card.playerId, { id: card.playerId, lifeStatus: 'ALIVE', startingRoleId: card.roleId });
    table.assignments.set(card.playerId, {
      playerId: card.playerId,
      currentRoleId: card.roleId,
      currentProfileId: card.profileId,
      currentFaction: card.faction,
      wolfAligned: card.wolfAligned,
      individualVictory: 'NONE',
      markTargetPlayerId: null,
    });
    for (const ability of card.abilities) {
      table.abilities.push({
        id: `a${table.nextId++}`,
        playerId: card.playerId,
        abilityId: ability.abilityId,
        definition: ability.definition,
        status: 'ACTIVE',
        chargesRemaining: ability.chargesRemaining,
        usesConsumed: 0,
        lastUsedRound: null,
        lastTargetPlayerId: null,
        availableFromRound: ability.availableFromRound,
        expiresRound: null,
        source: 'NATIVE',
      });
    }
  }
  return table;
}

function playNight(
  table: Table,
  config: NonNullable<ReturnType<typeof getPack>>['config'],
  policy: (typeof POLICIES)[PolicyId],
  rng: Rng,
  onView: SimulateOptions['onView'],
  uses: Map<string, number>,
): { deaths: number; attack: boolean; doctorSaved: boolean } {
  const actions: NightAction[] = [];
  let actionNo = 0;
  const ask = (playerId: PlayerId, window: SeatProjection['window'], extra: Partial<SeatProjection> = {}) => {
    const view = projection(table, playerId, window, extra);
    onView?.(view);
    return policy.choose(view, rng);
  };
  for (const player of living(table)) {
    const choice = ask(player.id, 'NIGHT_SUBMIT');
    pushActions(table, actions, choice, 'NIGHT_SUBMIT', () => `n${table.round}-${actionNo++}`, uses);
  }
  let hostDecision: HostKillDecision | null = null;
  if (config.wolves.killAggregation === 'HOST_SELECT_AMONG_SUBMISSIONS') {
    const candidates = killCandidates(table, actions);
    const choice = ask(table.hostId, 'KILL', { killCandidates: candidates });
    const target = choice.kind === 'KILL' ? choice.targetPlayerId : null;
    hostDecision = target && candidates.includes(target) ? { kind: 'TARGET', playerId: target } : { kind: 'NO_KILL' };
  }
  const finalTarget = confirmedTarget(config, table, actions, hostDecision);
  for (const player of living(table)) {
    const told = table.abilities.some(
      (ability) => ability.playerId === player.id && ability.definition.timing === 'NIGHT_REACTION' && ability.definition.target.kind === 'FINAL_WOLF_TARGET',
    );
    const choice = ask(player.id, 'NIGHT_REACTION', told ? { finalWolfTarget: finalTarget } : {});
    pushActions(table, actions, choice, 'NIGHT_REACTION', () => `r${table.round}-${actionNo++}`, uses);
  }
  const doctorIds = new Set(table.abilities.filter((ability) => ability.abilityId === 'doctor_save').map((ability) => ability.id));
  const input: NightInput = {
    round: table.round,
    config,
    players: [...table.players.values()].map((player) => ({ id: player.id, lifeStatus: player.lifeStatus })),
    assignments: [...table.assignments.values()],
    abilities: table.abilities.map(nightAbility),
    actions,
    hostDecision,
    infection: table.infection,
    effects: table.effects.filter((effect) => effect.status === 'ACTIVE'),
  };
  const result = resolveNight(input);
  applyNight(table, result);
  const doctorSaved =
    result.finalWolfTarget !== null &&
    result.saves.some((save) => save.playerId === result.finalWolfTarget && save.savedBy.some((id) => doctorIds.has(id)));
  return { deaths: result.deaths.length, attack: result.finalWolfTarget !== null, doctorSaved };
}

function playDay(
  table: Table,
  abstain: boolean,
  policy: (typeof POLICIES)[PolicyId],
  rng: Rng,
  onView: SimulateOptions['onView'],
): { deaths: number; votedOut: PlayerId[] } {
  let deaths = 0;
  for (const effect of table.effects) {
    if (effect.status !== 'ACTIVE' || effect.kind !== 'POISON' || effect.duePhase !== 'DAY' || effect.dueRound !== table.round) continue;
    const target = table.players.get(effect.targetPlayerId);
    if (target?.lifeStatus === 'ALIVE') {
      target.lifeStatus = 'DEAD';
      effect.status = 'SPENT';
      deaths += 1;
    } else effect.status = 'EXPIRED';
  }
  sealIfAlphaDead(table);
  const votedOut: PlayerId[] = [];
  const first = ballot(table, abstain, policy, rng, onView, null, 'FIRST');
  const eliminated = first.eliminated ?? (first.tied.length > 1 ? ballot(table, abstain, policy, rng, onView, first.tied, 'REVOTE').eliminated : null);
  if (eliminated) {
    const target = table.players.get(eliminated);
    if (target && target.lifeStatus === 'ALIVE') {
      target.lifeStatus = 'DEAD';
      votedOut.push(eliminated);
      deaths += 1;
    }
  }
  sealIfAlphaDead(table);
  return { deaths, votedOut };
}

function ballot(
  table: Table,
  abstain: boolean,
  policy: (typeof POLICIES)[PolicyId],
  rng: Rng,
  onView: SimulateOptions['onView'],
  tied: readonly PlayerId[] | null,
  kind: 'FIRST' | 'REVOTE',
) {
  const votes = living(table).map((player) => {
    const voteTargets = votePool(table, player.id, abstain, tied);
    const view = projection(table, player.id, 'VOTE', { voteTargets });
    onView?.(view);
    const choice = policy.choose(view, rng);
    const targetId = choice.kind === 'VOTE' && voteTargets.includes(choice.targetPlayerId) ? choice.targetPlayerId : null;
    return { voterId: player.id, targetId };
  });
  return tallyDay({
    round: table.round,
    ballot: kind,
    players: [...table.players.values()].map((player) => ({ id: player.id, lifeStatus: player.lifeStatus })),
    assignments: [...table.assignments.values()],
    abilities: table.abilities.map((ability) => ({ playerId: ability.playerId, status: ability.status, config: ability.definition })),
    votes,
  });
}

function judge(table: Table, roundCap: number, round: number, dayEliminated: readonly PlayerId[]): VictoryResult {
  return evaluateVictory({
    round,
    roundCap,
    players: [...table.players.values()].map((player) => ({ id: player.id, lifeStatus: player.lifeStatus })),
    assignments: [...table.assignments.values()],
    dayEliminated,
  });
}

function applyNight(table: Table, result: NightResult): void {
  for (const death of result.deaths) {
    const player = table.players.get(death.playerId);
    if (player) player.lifeStatus = 'DEAD';
  }
  for (const conversion of result.conversions) {
    const assignment = table.assignments.get(conversion.playerId);
    if (!assignment) continue;
    assignment.currentRoleId = conversion.toRoleId;
    assignment.currentProfileId = conversion.toProfileId;
    assignment.currentFaction = conversion.toFaction;
    assignment.wolfAligned = conversion.wolfAligned;
    if (conversion.individualVictory) assignment.individualVictory = conversion.individualVictory;
  }
  for (const mark of result.marks) {
    const assignment = table.assignments.get(mark.playerId);
    if (assignment) assignment.markTargetPlayerId = mark.targetId;
  }
  for (const update of result.abilityUpdates) {
    const ability = table.abilities.find((row) => row.id === update.abilityInstanceId);
    if (!ability) continue;
    const patch = update.patch;
    if (patch.chargesRemaining !== undefined) ability.chargesRemaining = patch.chargesRemaining;
    if (patch.usesConsumed !== undefined) ability.usesConsumed = patch.usesConsumed;
    if (patch.lastUsedRound !== undefined) ability.lastUsedRound = patch.lastUsedRound;
    if (patch.lastTargetPlayerId !== undefined) ability.lastTargetPlayerId = patch.lastTargetPlayerId;
    if (patch.status !== undefined) ability.status = patch.status;
  }
  for (const grant of result.grants) {
    table.abilities.push({
      id: `a${table.nextId++}`,
      playerId: grant.playerId,
      abilityId: grant.abilityId,
      definition: grant.definition,
      status: grant.chargesRemaining === 0 ? 'EXHAUSTED' : 'ACTIVE',
      chargesRemaining: grant.chargesRemaining,
      usesConsumed: 0,
      lastUsedRound: null,
      lastTargetPlayerId: null,
      availableFromRound: grant.availableFromRound,
      expiresRound: grant.expiresRound,
      source: grant.source,
    });
  }
  for (const effect of result.newEffects) {
    table.effects.push({ ...effect, id: `e${table.nextId++}`, attackTypes: [...effect.attackTypes], status: 'ACTIVE' });
  }
  for (const closed of result.closedEffects) {
    const effect = table.effects.find((row) => row.id === closed.effectId);
    if (effect) effect.status = closed.status;
  }
  for (const fact of result.investigations) {
    const value = 'value' in fact ? fact.value : null;
    const log = table.logs.get(fact.actorId) ?? [];
    log.push({ round: table.round, kind: fact.kind, value });
    table.logs.set(fact.actorId, log);
  }
  table.infection = { successes: result.infectionState.successes, sealed: result.infectionState.sealed };
  sealIfAlphaDead(table);
}

function sealIfAlphaDead(table: Table): void {
  for (const assignment of table.assignments.values()) {
    if (assignment.currentRoleId === 'alpha_wolf' && table.players.get(assignment.playerId)?.lifeStatus === 'DEAD') table.infection.sealed = true;
  }
}

function projection(table: Table, playerId: PlayerId, window: SeatProjection['window'], extra: Partial<SeatProjection>): SeatProjection {
  const player = table.players.get(playerId)!;
  const assignment = table.assignments.get(playerId)!;
  const phase = window === 'NIGHT_SUBMIT' ? 'NIGHT_SUBMIT' : window === 'NIGHT_REACTION' ? 'NIGHT_REACTION' : window === 'KILL' ? 'NIGHT_HOST_CONFIRM' : 'VOTING';
  return {
    selfId: playerId,
    isHost: playerId === table.hostId,
    lifeStatus: player.lifeStatus,
    roleId: assignment.currentRoleId,
    faction: assignment.currentFaction,
    round: table.round,
    phase,
    window,
    abilities: table.abilities.filter((ability) => ability.playerId === playerId).map(projectedAbility),
    seats: [...table.players.values()].map((seat) => ({ id: seat.id, lifeStatus: seat.lifeStatus })),
    ownResults: table.logs.get(playerId) ?? [],
    killCandidates: extra.killCandidates ?? null,
    ...(extra.finalWolfTarget !== undefined ? { finalWolfTarget: extra.finalWolfTarget } : {}),
    voteTargets: extra.voteTargets ?? [],
  };
}

function projectedAbility(ability: SimAbility): ProjectedAbility {
  return {
    id: ability.id,
    abilityId: ability.abilityId,
    status: ability.status,
    chargesRemaining: ability.chargesRemaining,
    usesConsumed: ability.usesConsumed,
    lastUsedRound: ability.lastUsedRound,
    lastTargetPlayerId: ability.lastTargetPlayerId,
    availableFromRound: ability.availableFromRound,
    expiresRound: ability.expiresRound,
    config: ability.definition,
  };
}

function nightAbility(ability: SimAbility): NightAbility {
  return { ...projectedAbility(ability), playerId: ability.playerId, source: ability.source };
}

function pushActions(
  table: Table,
  actions: NightAction[],
  choice: BotChoice,
  phase: 'NIGHT_SUBMIT' | 'NIGHT_REACTION',
  id: () => string,
  uses: Map<string, number>,
): void {
  if (choice.kind !== 'ACTIONS') return;
  for (const action of choice.actions) {
    const ability = table.abilities.find((row) => row.id === action.abilityInstanceId);
    if (!ability) continue;
    actions.push({
      id: id(),
      playerId: ability.playerId,
      abilityInstanceId: ability.id,
      phase,
      targetPlayerIds: action.targetPlayerIds,
      payload: action.payload,
    });
    uses.set(ability.abilityId, (uses.get(ability.abilityId) ?? 0) + 1);
  }
}

function killCandidates(table: Table, actions: readonly NightAction[]): PlayerId[] {
  const ids = new Set<PlayerId>();
  for (const action of actions) {
    const ability = table.abilities.find((row) => row.id === action.abilityInstanceId);
    const target = action.targetPlayerIds[0];
    if (ability?.definition.capability === 'KILL' && target && table.players.get(target)?.lifeStatus === 'ALIVE') ids.add(target);
  }
  return [...ids].sort();
}

/** The same three aggregators as the night resolver. Only the chosen id is shown, and only to a reacting seat. */
function confirmedTarget(
  config: NonNullable<ReturnType<typeof getPack>>['config'],
  table: Table,
  actions: readonly NightAction[],
  decision: HostKillDecision | null,
): PlayerId | null {
  const isPack = (id: PlayerId) => table.assignments.get(id)?.currentFaction === 'WOLF_PACK';
  const legal = (id: PlayerId) => table.players.get(id)?.lifeStatus === 'ALIVE' && (config.wolves.friendlyFire || !isPack(id));
  const submitted = actions
    .filter((action) => table.abilities.find((ability) => ability.id === action.abilityInstanceId)?.definition.capability === 'KILL')
    .map((action) => action.targetPlayerIds[0]!)
    .filter((id) => id && legal(id));
  if (config.wolves.killAggregation === 'HOST_SELECT_AMONG_SUBMISSIONS') {
    return decision?.kind === 'TARGET' && submitted.includes(decision.playerId) ? decision.playerId : null;
  }
  if (config.wolves.killAggregation === 'ALPHA_PRIORITY') {
    const alpha = actions.find((action) => table.abilities.some((ability) => ability.playerId === action.playerId && ability.definition.capability === 'INFECT'));
    const alphaTarget = alpha?.targetPlayerIds[0];
    if (alphaTarget && legal(alphaTarget)) return alphaTarget;
  }
  const counts = new Map<PlayerId, number>();
  for (const id of submitted) counts.set(id, (counts.get(id) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  const leaders = [...counts.entries()].filter(([, n]) => n === top);
  return leaders.length === 1 ? leaders[0]![0] : null;
}

function votePool(table: Table, self: PlayerId, abstain: boolean, tied: readonly PlayerId[] | null): (PlayerId | null)[] {
  let ids = living(table)
    .map((player) => player.id)
    .filter((id) => id !== self);
  if (tied) ids = ids.filter((id) => tied.includes(id));
  return abstain ? [...ids, null] : ids;
}

function living(table: Table): SimPlayer[] {
  return [...table.players.values()].filter((player) => player.lifeStatus === 'ALIVE');
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
