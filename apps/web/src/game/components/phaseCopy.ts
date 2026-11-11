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
 */
export function closeButtonLabel(close: PhaseClose): string {
  if (close.resolves === 'NIGHT') return 'End the night';
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
  if (error.code === 'PHASE_CONFLICT') return 'The game moved on.';
  return error.message;
}
