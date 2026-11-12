import type { ChatRefusal, GamePhase } from '@warewolf/domain';

/**
 * Composer copy (WW-1206). The server decides `canPost` and `refusal`.
 * These sentences do not name a role or a team.
 */

export function chatRefusalCopy(refusal: ChatRefusal | null, phase?: GamePhase | null): string | null {
  switch (refusal) {
    case 'CLOSED':
      return phase === 'DAY_ANNOUNCE' ? 'Discussion will open after you continue to day.' : 'Discussion is closed at night.';
    case 'DEAD':
      return 'The dead read only.';
    case 'MUTED':
      return 'You cannot post in the discussion.';
    default:
      return null;
  }
}

/** The counter under the field. An emoji counts as one, matching the server. */
export function chatRemainingCopy(remaining: number): string {
  if (remaining === 1) return '1 character left';
  if (remaining === -1) return '1 character over the limit';
  if (remaining < 0) return `${Math.abs(remaining)} characters over the limit`;
  return `${remaining} characters left`;
}

export function chatSeatName(players: readonly { readonly playerId: string; readonly displayName: string }[], playerId: string): string {
  return players.find((player) => player.playerId === playerId)?.displayName ?? 'A player';
}
