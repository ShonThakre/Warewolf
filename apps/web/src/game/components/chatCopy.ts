import type { ChatRefusal } from '@warewolf/domain';

/**
 * Composer copy (WW-1206). The server decides `canPost` and `refusal`.
 * These sentences do not name a role or a team.
 */

export function chatRefusalCopy(refusal: ChatRefusal | null): string | null {
  switch (refusal) {
    case 'CLOSED':
      return 'Discussion is closed at night.';
    case 'DEAD':
      return 'The dead read only.';
    case 'MUTED':
      return 'The host muted you.';
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
