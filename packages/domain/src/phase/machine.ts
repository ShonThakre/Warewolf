import { DEFAULT_CATALOG, type RoleCatalog } from '../catalog/catalog.js';
import { resolveEntry } from '../config/resolve.js';
import type { GameConfiguration } from '../config/types.js';
import type { GamePhase, GameStatus } from '../game.js';

/**
 * The phase machine (WW-501 to WW-503). Pure: the API decides when a phase
 * closes, runs any resolution inside its transaction, and asks these
 * functions where the game goes next. See docs/werewolf/implementation-plan.md,
 * section 8, and docs/werewolf/night-resolution.md, section 1.
 */

/**
 * Which optional night windows a game opens.
 *
 * Both are fixed by the frozen configuration and never by who is alive or
 * what was submitted. If the reaction window opened only while an informed
 * Doctor could act, every player would see it skipped the night the Doctor
 * was silently infected, and silent infection (OD-44) would be public. A
 * Doctor who cannot act is a decline (night-resolution.md, section 1). See
 * OD-74.
 */
export interface NightWindows {
  /** The host picks the final wolf target from the submissions (OD-01). */
  readonly hostConfirm: boolean;
  /** A seated role reacts to the final target, such as the informed Doctor (OD-02). */
  readonly reaction: boolean;
}

export function nightWindows(config: GameConfiguration, catalog: RoleCatalog = DEFAULT_CATALOG): NightWindows {
  const reaction = config.roles.some(
    (entry) => entry.count > 0 && (resolveEntry(entry, catalog)?.abilities.some((a) => a.timing === 'NIGHT_REACTION') ?? false),
  );
  return { hostConfirm: config.wolves.killAggregation === 'HOST_SELECT_AMONG_SUBMISSIONS', reaction };
}

/** Everything about a game's configuration that the phase machine reads. */
export interface PhaseRules {
  readonly windows: NightWindows;
  readonly votingEnabled: boolean;
  readonly pacing: GameConfiguration['pacing'];
  readonly timers: GameConfiguration['timers'];
}

export function phaseRules(config: GameConfiguration, catalog: RoleCatalog = DEFAULT_CATALOG): PhaseRules {
  return { windows: nightWindows(config, catalog), votingEnabled: config.voting.enabled, pacing: config.pacing, timers: config.timers };
}

/** Phases an active game can be in. Lobby, finished, and cancelled have no close. */
export const CLOSABLE_PHASES = [
  'ROLE_REVEAL',
  'NIGHT_SUBMIT',
  'NIGHT_HOST_CONFIRM',
  'NIGHT_REACTION',
  'DAY_ANNOUNCE',
  'DAY_DISCUSSION',
  'VOTING',
  'REVOTE',
] as const satisfies readonly GamePhase[];
export type ClosablePhase = (typeof CLOSABLE_PHASES)[number];

export function isClosable(phase: GamePhase): phase is ClosablePhase {
  return (CLOSABLE_PHASES as readonly GamePhase[]).includes(phase);
}

/** Which ballot a day resolution closes. `NONE` is a day with voting turned off. */
export type Ballot = 'FIRST' | 'REVOTE' | 'NONE';

/**
 * What closing a phase does. `ADVANCE` moves on with nothing to resolve. The
 * other two run a resolution inside the close, and its result picks the next phase.
 */
export type CloseStep =
  | { readonly kind: 'ADVANCE'; readonly to: ClosablePhase }
  | { readonly kind: 'RESOLVE_NIGHT' }
  | { readonly kind: 'RESOLVE_DAY'; readonly ballot: Ballot };

export function planClose(phase: ClosablePhase, rules: PhaseRules): CloseStep {
  const { hostConfirm, reaction } = rules.windows;
  switch (phase) {
    case 'ROLE_REVEAL':
      return { kind: 'ADVANCE', to: 'NIGHT_SUBMIT' };
    case 'NIGHT_SUBMIT':
      if (hostConfirm) return { kind: 'ADVANCE', to: 'NIGHT_HOST_CONFIRM' };
      return reaction ? { kind: 'ADVANCE', to: 'NIGHT_REACTION' } : { kind: 'RESOLVE_NIGHT' };
    case 'NIGHT_HOST_CONFIRM':
      return reaction ? { kind: 'ADVANCE', to: 'NIGHT_REACTION' } : { kind: 'RESOLVE_NIGHT' };
    case 'NIGHT_REACTION':
      return { kind: 'RESOLVE_NIGHT' };
    case 'DAY_ANNOUNCE':
      return { kind: 'ADVANCE', to: 'DAY_DISCUSSION' };
    case 'DAY_DISCUSSION':
      return rules.votingEnabled ? { kind: 'ADVANCE', to: 'VOTING' } : { kind: 'RESOLVE_DAY', ballot: 'NONE' };
    case 'VOTING':
      return { kind: 'RESOLVE_DAY', ballot: 'FIRST' };
    case 'REVOTE':
      return { kind: 'RESOLVE_DAY', ballot: 'REVOTE' };
  }
}

/** What the night resolver (WW-802) reports back to the machine. */
export interface NightResolution {
  /** A terminal victory or draw was recorded. Day does not open (OD-68). */
  readonly gameOver: boolean;
}

/** What the day resolver (WW-901, WW-902) reports back to the machine. */
export interface DayResolution {
  readonly gameOver: boolean;
  /** The ballot tied. Only a first ballot's tie opens a revote; a second tie eliminates nobody (OD-40). */
  readonly tied: boolean;
}

/** A close with its resolution, if it had one. */
export type CloseResult =
  | Extract<CloseStep, { kind: 'ADVANCE' }>
  | ({ readonly kind: 'RESOLVE_NIGHT' } & NightResolution)
  | ({ readonly kind: 'RESOLVE_DAY'; readonly ballot: Ballot } & DayResolution);

export interface PhasePosition {
  readonly status: GameStatus;
  readonly phase: GamePhase;
  readonly roundNumber: number;
}

const FINISHED = (roundNumber: number): PhasePosition => ({ status: 'FINISHED', phase: 'FINISHED', roundNumber });

/** Where a close leaves the game. A round is one night and the day after it. */
export function positionAfter(from: PhasePosition, result: CloseResult): PhasePosition {
  const round = from.roundNumber;
  switch (result.kind) {
    case 'ADVANCE':
      return { status: 'ACTIVE', phase: result.to, roundNumber: round };
    case 'RESOLVE_NIGHT':
      return result.gameOver ? FINISHED(round) : { status: 'ACTIVE', phase: 'DAY_ANNOUNCE', roundNumber: round };
    case 'RESOLVE_DAY':
      if (result.gameOver) return FINISHED(round);
      if (result.tied && result.ballot === 'FIRST') return { status: 'ACTIVE', phase: 'REVOTE', roundNumber: round };
      return { status: 'ACTIVE', phase: 'NIGHT_SUBMIT', roundNumber: round + 1 };
  }
}

/**
 * Every legal phase change. The machine above only produces these; the API
 * checks each write against this table as a last guard.
 */
export const PHASE_TRANSITIONS: Readonly<Record<GamePhase, readonly GamePhase[]>> = {
  LOBBY: ['ROLE_REVEAL', 'CANCELLED'],
  ROLE_REVEAL: ['NIGHT_SUBMIT', 'CANCELLED'],
  NIGHT_SUBMIT: ['NIGHT_HOST_CONFIRM', 'NIGHT_REACTION', 'DAY_ANNOUNCE', 'FINISHED', 'CANCELLED'],
  NIGHT_HOST_CONFIRM: ['NIGHT_REACTION', 'DAY_ANNOUNCE', 'FINISHED', 'CANCELLED'],
  NIGHT_REACTION: ['DAY_ANNOUNCE', 'FINISHED', 'CANCELLED'],
  DAY_ANNOUNCE: ['DAY_DISCUSSION', 'CANCELLED'],
  DAY_DISCUSSION: ['VOTING', 'NIGHT_SUBMIT', 'FINISHED', 'CANCELLED'],
  VOTING: ['REVOTE', 'NIGHT_SUBMIT', 'FINISHED', 'CANCELLED'],
  REVOTE: ['NIGHT_SUBMIT', 'FINISHED', 'CANCELLED'],
  FINISHED: [],
  CANCELLED: [],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}

/**
 * When a phase closes by itself. Only timed games have deadlines, and only
 * for the three configured timers (OD-43): night submission, day discussion,
 * and each ballot. Role reveal, the day announcement, host confirm, and the
 * reaction window wait for the host in every game, because each needs a
 * person: the table reading cards, the host reading results, the host
 * choosing a target, or the Doctor answering.
 */
export function phaseDeadline(phase: GamePhase, rules: PhaseRules, now: Date): Date | null {
  if (rules.pacing !== 'TIMED' || !rules.timers) return null;
  const seconds = timerSeconds(phase, rules.timers);
  return seconds === null ? null : new Date(now.getTime() + seconds * 1000);
}

function timerSeconds(phase: GamePhase, timers: NonNullable<GameConfiguration['timers']>): number | null {
  switch (phase) {
    case 'NIGHT_SUBMIT':
      return timers.nightSeconds;
    case 'DAY_DISCUSSION':
      return timers.daySeconds;
    case 'VOTING':
    case 'REVOTE':
      return timers.voteSeconds;
    default:
      return null;
  }
}
