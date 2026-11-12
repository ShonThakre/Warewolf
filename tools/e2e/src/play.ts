import type { GameState, KillTargetView, OwnAbility, RosterEntry } from '@warewolf/contracts';
import type { Choice, GameDriver, KillDecisionRequest, Seat } from './driver.js';
import { HttpError } from './http.js';
import { checkPhase, type Violation } from './invariants.js';
import { createRng, type Rng } from './rng.js';

/**
 * Plays a started game phase by phase until it ends. A policy decides every
 * seat's action, the host's kill pick, and every ballot. The host roster is
 * the policy's view: scenarios script an ending, so they may look at roles.
 * Invariants are checked from the players' side after every phase.
 */

export interface AbilityView {
  readonly abilityInstanceId: string;
  readonly abilityId: string;
  readonly capability: OwnAbility['capability'];
  readonly timing: OwnAbility['timing'];
  readonly target: OwnAbility['target'];
  readonly exclusiveGroup: string | undefined;
  /** The informed Doctor's prompt in the reaction window. */
  readonly finalWolfTarget: string | null | undefined;
}

export interface PhaseContext {
  readonly driver: GameDriver;
  readonly state: GameState;
  readonly roster: readonly RosterEntry[];
  readonly rng: Rng;
  /** Scratch space a scenario keeps across phases. */
  readonly memo: Map<string, unknown>;
  alive(): RosterEntry[];
  /** Living wolf-aligned seats, in seat order. */
  wolves(): RosterEntry[];
  /** Living seats that are not wolf-aligned, in seat order. */
  others(): RosterEntry[];
  entry(playerId: string): RosterEntry;
  seat(playerId: string): Seat;
}

export interface Policy {
  readonly name: string;
  /** Null skips the ability this phase. */
  act(ctx: PhaseContext, actor: RosterEntry, ability: AbilityView): Choice | null;
  hostKill(ctx: PhaseContext, view: KillTargetView): KillDecisionRequest;
  /** A player id, null to abstain, or undefined to not vote at all. */
  vote(ctx: PhaseContext, voter: RosterEntry, ballot: 1 | 2, candidates: readonly string[]): string | null | undefined;
}

export interface Rejection {
  readonly round: number;
  readonly phase: string;
  readonly player: string;
  readonly what: string;
  readonly status: number;
  readonly code: string | undefined;
}

export interface PlayLog {
  readonly policy: string;
  readonly seed: number;
  readonly phases: { round: number; phase: string }[];
  readonly rejections: Rejection[];
  readonly violations: Violation[];
  submitted: number;
  votes: number;
  final: GameState | null;
}

export interface PlayOptions {
  readonly policy: Policy;
  readonly seed?: number;
  /** Safety stop. Default: enough closes for the 20-round cap. */
  readonly maxCloses?: number;
  readonly invariants?: boolean;
  /** Runs before the policy in every phase. Throw to fail the game. */
  readonly onPhase?: (ctx: PhaseContext) => Promise<void>;
  /** Stops before closing a phase for which this returns true. */
  readonly stopWhen?: (state: GameState) => boolean;
}

const ACTION_PHASES = new Set(['NIGHT_SUBMIT', 'NIGHT_REACTION', 'DAY_DISCUSSION']);

function context(driver: GameDriver, state: GameState, roster: readonly RosterEntry[], rng: Rng, memo: Map<string, unknown>): PhaseContext {
  const alive = () => roster.filter((p) => p.lifeStatus === 'ALIVE');
  return {
    driver,
    state,
    roster,
    rng,
    memo,
    alive,
    wolves: () => alive().filter((p) => p.wolfAligned),
    others: () => alive().filter((p) => !p.wolfAligned),
    entry(playerId) {
      const found = roster.find((p) => p.playerId === playerId);
      if (!found) throw new Error(`no roster entry ${playerId}`);
      return found;
    },
    seat: (playerId) => driver.seat(playerId),
  };
}

async function actAll(ctx: PhaseContext, policy: Policy, log: PlayLog): Promise<void> {
  for (const seat of ctx.driver.seats) {
    const actions = await ctx.driver.myActions(seat);
    const open = actions.abilities.filter((a) => a.availability === 'OPEN');
    if (open.length === 0) continue;
    const me = await ctx.driver.me(seat);
    const actor = ctx.entry(seat.playerId);
    for (const prompt of open) {
      const own = me.abilities.find((a) => a.abilityInstanceId === prompt.abilityInstanceId);
      if (!own) continue;
      const ability: AbilityView = {
        abilityInstanceId: prompt.abilityInstanceId,
        abilityId: prompt.abilityId,
        capability: own.capability,
        timing: own.timing,
        target: own.target,
        exclusiveGroup: own.exclusiveGroup,
        finalWolfTarget: prompt.finalWolfTarget,
      };
      const choice = policy.act(ctx, actor, ability);
      if (!choice) continue;
      const res = await ctx.driver.submit(seat, prompt.abilityInstanceId, choice);
      if (res.status === 200) log.submitted++;
      else log.rejections.push(rejection(ctx, seat, prompt.abilityId, res.status, res.body));
    }
  }
}

async function voteAll(ctx: PhaseContext, policy: Policy, log: PlayLog): Promise<void> {
  const ballot: 1 | 2 = ctx.state.phase === 'REVOTE' ? 2 : 1;
  let candidates = ctx.alive().map((p) => p.playerId);
  if (ballot === 2) {
    const tallies = await ctx.driver.tallies();
    const first = tallies.filter((t) => t.roundNumber === ctx.state.roundNumber && t.ballot === 1).at(-1);
    candidates = first?.tiedPlayerIds ?? candidates;
  }
  for (const voter of ctx.alive()) {
    const target = policy.vote(ctx, voter, ballot, candidates.filter((id) => id !== voter.playerId));
    if (target === undefined) continue;
    const res = await ctx.driver.vote(ctx.seat(voter.playerId), target);
    if (res.status === 200) log.votes++;
    else log.rejections.push(rejection(ctx, ctx.seat(voter.playerId), `vote ${ballot}`, res.status, res.body));
  }
}

function rejection(ctx: PhaseContext, seat: Seat, what: string, status: number, body: unknown): Rejection {
  const error = (body as { error?: { code?: string } } | null)?.error;
  return { round: ctx.state.roundNumber, phase: ctx.state.phase, player: seat.displayName, what, status, code: error?.code };
}

export async function play(driver: GameDriver, options: PlayOptions): Promise<PlayLog> {
  const seed = options.seed ?? 1;
  const rng = createRng(seed);
  const memo = new Map<string, unknown>();
  const log: PlayLog = { policy: options.policy.name, seed, phases: [], rejections: [], violations: [], submitted: 0, votes: 0, final: null };
  const maxCloses = options.maxCloses ?? 200;
  let state = await driver.state();

  for (let i = 0; i < maxCloses && state.status === 'ACTIVE'; i++) {
    if (options.stopWhen?.(state)) break;
    const roster = (await driver.roster()).players;
    const ctx = context(driver, state, roster, rng, memo);
    log.phases.push({ round: state.roundNumber, phase: state.phase });

    await options.onPhase?.(ctx);
    if (ACTION_PHASES.has(state.phase)) await actAll(ctx, options.policy, log);
    if (state.phase === 'NIGHT_HOST_CONFIRM') await driver.setKillTarget(options.policy.hostKill(ctx, await driver.killTarget()));
    if (state.phase === 'VOTING' || state.phase === 'REVOTE') await voteAll(ctx, options.policy, log);
    if (options.invariants ?? true) log.violations.push(...(await checkPhase(ctx)));

    try {
      state = await driver.close();
    } catch (error) {
      // A timed phase can close by itself between our read and our close.
      if (!(error instanceof HttpError) || error.code !== 'PHASE_CONFLICT') throw error;
      state = await driver.state();
    }
  }

  log.final = state;
  return log;
}

export { createRng };
