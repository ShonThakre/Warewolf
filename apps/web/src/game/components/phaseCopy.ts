import type { PhaseClose } from '@warewolf/contracts';
import type { GamePhase, LifeStatus } from '@warewolf/domain';
import type { ApiErrorInfo } from '../../api/api';

/** Words for the status line. The phase code stays off the screen. */
export const PHASE_LABEL: Record<GamePhase, string> = {
  LOBBY: 'Lobby',
  ROLE_REVEAL: 'Role reveal',
  NIGHT_SUBMIT: 'Night',
  NIGHT_HOST_CONFIRM: 'Host confirm',
  NIGHT_REACTION: 'Reaction',
  DAY_ANNOUNCE: 'Morning',
  DAY_DISCUSSION: 'Day',
  VOTING: 'Voting',
  REVOTE: 'Revote',
  FINISHED: 'Finished',
  CANCELLED: 'Cancelled',
};

export function roundLabel(roundNumber: number): string {
  return `Round ${roundNumber}`;
}

/** Life is always a word. Dead seats stay visible and are not targets. */
export function lifeLabel(status: LifeStatus): string {
  return status === 'ALIVE' ? 'Alive' : 'Eliminated';
}

/**
 * The host button, from `state.close`. A `next` phase is a move with nothing
 * to resolve. `resolves` runs the night or the day inside the close.
 * A day discussion that resolves the day is a shot, not the vote.
 */
export function closeButtonLabel(close: PhaseClose, phase?: GamePhase | null): string {
  if (phase === 'DAY_DISCUSSION' && close.resolves === 'DAY') return 'Resolve the shot';
  if (close.resolves === 'NIGHT') return 'Resolve night';
  if (close.resolves === 'DAY') return 'End the day';
  switch (close.next) {
    case 'NIGHT_SUBMIT':
      return 'Begin the night';
    case 'NIGHT_HOST_CONFIRM':
      return 'Close night actions';
    case 'NIGHT_REACTION':
      return 'Open reactions';
    case 'DAY_ANNOUNCE':
      return 'Announce the morning';
    case 'DAY_DISCUSSION':
      return 'Continue to day';
    case 'VOTING':
      return 'Open voting';
    case 'REVOTE':
      return 'Start the revote';
    default:
      return 'Continue';
  }
}

/** Phases where players are still choosing. Closing one ends their chance. */
const ACTING_PHASES: ReadonlySet<GamePhase> = new Set(['NIGHT_SUBMIT', 'NIGHT_HOST_CONFIRM', 'NIGHT_REACTION', 'VOTING', 'REVOTE']);

/**
 * What the host's close does, in one or two sentences, from `state.close`.
 * It names the next phase when the server gives one and says when a resolution decides.
 */
export function closeConsequence(close: PhaseClose, phase?: GamePhase | null): string {
  if (phase === 'DAY_DISCUSSION' && close.resolves === 'DAY') {
    return 'Resolves the shot fired during this discussion. The result is announced and can end the game.';
  }
  if (close.resolves === 'NIGHT') {
    return 'Apply the submitted night actions and the chosen kill (or no kill), then advance to day.';
  }
  if (close.resolves === 'DAY') {
    if (phase === 'REVOTE') return 'Closes the revote and counts it. If it ties again, nobody is eliminated. The result can end the game.';
    return 'Closes voting and counts the ballots. Nobody can change a vote after this. A tie opens a revote. The result can end the game.';
  }
  switch (close.next) {
    case 'NIGHT_SUBMIT':
      return 'Starts the night. Players with night abilities choose in secret.';
    case 'NIGHT_HOST_CONFIRM':
      return 'Closes night choices. Anyone still choosing loses the chance. Next, you confirm the wolf target.';
    case 'NIGHT_REACTION':
      return 'Closes night choices and opens the reaction window, such as a save for the announced target.';
    case 'DAY_ANNOUNCE':
      return 'Moves to the morning announcement.';
    case 'DAY_DISCUSSION':
      return 'Starts the day discussion.';
    case 'VOTING':
      return 'Opens voting. Living players choose who to eliminate.';
    case 'REVOTE':
      return 'Starts the revote between the tied players.';
    default:
      return close.next ? `Moves to ${PHASE_LABEL[close.next]}.` : 'Moves the game on.';
  }
}

/** A close that resolves something, or ends a window where players are choosing, asks first. */
export function closeNeedsConfirm(close: PhaseClose, phase?: GamePhase | null): boolean {
  if (close.resolves) return true;
  return phase != null && ACTING_PHASES.has(phase);
}

/** One line under the phase name: what this phase is for. */
export function phaseGuide(phase: GamePhase): string {
  switch (phase) {
    case 'LOBBY':
      return 'Players are joining.';
    case 'ROLE_REVEAL':
      return 'Everyone reads their own role in private.';
    case 'NIGHT_SUBMIT':
      return 'Take your action.';
    case 'NIGHT_HOST_CONFIRM':
      return 'The host is confirming the night.';
    case 'NIGHT_REACTION':
      return 'Some roles may react to the night’s target.';
    case 'DAY_ANNOUNCE':
      return 'The village learns what happened in the night.';
    case 'DAY_DISCUSSION':
      return 'Talk it over. Voting opens next.';
    case 'VOTING':
      return 'Living players vote on who to eliminate.';
    case 'REVOTE':
      return 'The vote tied. Only the tied players can be chosen.';
    case 'FINISHED':
      return 'The game is over.';
    case 'CANCELLED':
      return 'The game was cancelled.';
  }
}

/** `m:ss` for `CountdownTimer`. `seconds` is already a whole number, never below 0. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

/** What a guest reads in the action row. The host gets the close button instead. */
export function guestActionCopy(state: { status: string; phaseEndsAt: string | null }): string {
  if (state.status === 'CANCELLED') return 'This game was cancelled. Roles stay hidden.';
  if (state.phaseEndsAt) return 'The timer closes this phase.';
  return 'Waiting for host';
}

/** A stale close is one sentence. Any other refusal shows the server's message. */
export function phaseActionNote(error: ApiErrorInfo | null): string | null {
  if (!error) return null;
  if (error.code === 'PHASE_CONFLICT') return 'The game moved on before that went through. This screen now shows the current phase.';
  return error.message;
}
