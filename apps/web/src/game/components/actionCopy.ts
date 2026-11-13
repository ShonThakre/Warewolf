import type { OwnAbility, TargetRuleDto } from '@warewolf/contracts';
import type { Availability } from '@warewolf/domain';
import type { ActionPrompt } from '../state/actions';

/**
 * Sentences for the one action panel (WW-604). The capability decides the
 * words. The target rule decides whether a seat, a question, or nothing is
 * required. Role ids never appear here.
 */

/** The Seeker's once-per-game role card (PLAY-FIX-01). Shares the night with the Wolf check. */
export const SEE_ROLE_ABILITY_ID = 'seeker_see_role';

export function promptLabel(ability: Pick<OwnAbility, 'capability' | 'target'> & { readonly abilityId?: string }): string {
  const { capability, target } = ability;
  if (ability.abilityId === SEE_ROLE_ABILITY_ID) return "See a player's role card (once per game)";
  if (target.kind === 'FINAL_WOLF_TARGET') return 'Save the announced target';
  if (target.kind === 'OWN_RESULT' || capability === 'ROLE_REVEAL') return 'Publish a stored result';
  if (target.kind === 'QUESTION' || capability === 'DETECT') return 'Ask the allowed question';
  if (target.kind === 'TEXT' || capability === 'HINT') return 'Write a hint';
  if (target.kind === 'NONE' && capability === 'CHAOS') return 'Trigger a chaos event';
  if (target.kind === 'NONE') return 'Confirm this action';

  const count = target.count;
  switch (capability) {
    case 'INFECT':
      return 'Choose a player to infect';
    case 'KILL':
      return 'Choose a kill target';
    case 'INVESTIGATE':
      if (count === 2) return 'Choose two players to investigate';
      if (target.life === 'DEAD') return 'Choose a dead player to investigate';
      return 'Choose a player to investigate';
    case 'PROTECT':
      return 'Choose a player to protect';
    case 'HEAL':
      return 'Save this player';
    case 'POISON':
      return 'Choose a player to poison';
    case 'TRACK':
      return 'Choose a player to track';
    case 'BLOCK_ACTION':
      return 'Choose a player to block';
    case 'ROLE_COPY':
      return target.life === 'DEAD' ? 'Choose a dead player to copy' : 'Choose a player to copy';
    case 'CONVERT':
      return 'Choose a player to mark';
    case 'REWIND':
      return 'Choose a player to rewind';
    case 'SILENCE':
      return 'Choose a player to silence';
    case 'REVIVE':
      return 'Choose a dead player to return';
    case 'MODIFY_VOTING':
      return count === 2 ? 'Choose the voter, then their new target' : 'Change one player’s vote';
    default:
      return count === 1 ? 'Choose a player' : `Choose ${count} players`;
  }
}

const QUESTION_LABELS: Readonly<Record<string, string>> = {
  WOLF_PACK_SIZE_AT_LEAST: 'Is the wolf pack at least this size?',
};

/** The words on a question control. The payload still sends the question id. */
export function questionLabel(question: string): string {
  return QUESTION_LABELS[question] ?? 'Ask the allowed question';
}

/** The note under an exclusive choice. The Vampire team may take only one of its two actions. */
export function exclusiveNote(group: string | undefined): string | null {
  if (!group) return null;
  if (group === 'vampire_choice') return 'The Vampire team chooses one action tonight: kill or mark.';
  return 'This replaces your other choice.';
}

/** Why a row is disabled. PASSIVE is omitted by the panel, so it has no sentence. */
export function availabilitySentence(availability: Availability): string | null {
  switch (availability) {
    case 'OPEN':
    case 'PASSIVE':
      return null;
    case 'REVOKED':
      return 'This ability was taken away.';
    case 'DEAD':
      return 'You cannot act.';
    case 'NOT_THIS_PHASE':
      return 'Not during this phase.';
    case 'NOT_YET':
      return 'Not yet.';
    case 'EXPIRED':
      return 'This ability has expired.';
    case 'NO_USES':
      return 'No uses left.';
    case 'COOLDOWN':
      return 'This ability is resting.';
  }
}

export function shownPrompt(prompt: ActionPrompt): boolean {
  return prompt.availability !== 'PASSIVE';
}

/** OPEN, and not yet locked by the server. */
export function editablePrompt(prompt: ActionPrompt): boolean {
  return prompt.availability === 'OPEN' && prompt.action?.status !== 'LOCKED';
}

export function seatSelectable(
  player: { readonly playerId: string; readonly lifeStatus: string },
  youId: string,
  rule: TargetRuleDto | null,
): boolean {
  if (!rule || rule.kind !== 'PLAYERS') return false;
  if (player.lifeStatus !== rule.life) return false;
  if (!rule.self && player.playerId === youId) return false;
  return true;
}

export function choiceReady(rule: TargetRuleDto, selected: readonly string[], question: string | null, hint = ''): boolean {
  switch (rule.kind) {
    case 'PLAYERS':
      return selected.length === rule.count;
    case 'QUESTION':
      return question != null && (rule.questions as readonly string[]).includes(question);
    case 'TEXT': {
      const text = hint.trim();
      return text.length >= 1 && text.length <= rule.maxLength;
    }
    case 'NONE':
    case 'FINAL_WOLF_TARGET':
    case 'OWN_RESULT':
      return true;
  }
}

export function choiceNames(players: readonly { readonly playerId: string; readonly displayName: string }[], ids: readonly string[]): string {
  const names = ids.map((id) => players.find((player) => player.playerId === id)?.displayName).filter((name): name is string => name != null);
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** Seat labels for the night "Selected target" field, matching the public seat cards. */
export function choiceSeatLine(
  players: readonly { readonly playerId: string; readonly displayName: string; readonly seatNumber: number }[],
  ids: readonly string[],
): string {
  const labels = ids
    .map((id) => players.find((player) => player.playerId === id))
    .filter((player): player is { readonly playerId: string; readonly displayName: string; readonly seatNumber: number } => player != null)
    .map((player) => `${player.seatNumber}. ${player.displayName}`);
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const seen = new Set(left);
  return right.every((id) => seen.has(id));
}

/** The current draft is the choice the server already stored. */
export function matchesChoice(prompt: ActionPrompt, selected: readonly string[], question: string | null, hint = ''): boolean {
  const action = prompt.action;
  if (!action || (action.status !== 'PENDING' && action.status !== 'LOCKED')) return false;
  const rule = prompt.ability.target;
  if (rule.kind === 'PLAYERS') return sameMembers(action.targetPlayerIds, selected) && selected.length === rule.count;
  if (rule.kind === 'QUESTION') return question != null && action.payload['question'] === question;
  if (rule.kind === 'TEXT') return action.payload['hint'] === hint.trim();
  return true;
}

/**
 * The action row. An open ability names the choice, or "Submitted" once that
 * choice is stored. A night with nothing left to send waits for the night.
 */
export function actionRowText(night: boolean, active: ActionPrompt | null, names: string, stored: boolean, anyStored: boolean): string | null {
  if (active) {
    if (stored) return names ? `Your choice: ${names}. You can change it until this phase closes.` : 'Sent. You can change it until this phase closes.';
    if (names) return `Selected: ${names}. Not sent yet.`;
    return promptLabel(active.ability);
  }
  if (!night) return null;
  return anyStored ? 'Submitted' : 'Waiting for night to end';
}

export type ActionTone = 'choose' | 'pending' | 'done' | 'waiting';

/** The pill beside the action line. Words carry the state; the tone only adds color. */
export function actionStatus(input: { readonly active: boolean; readonly ready: boolean; readonly stored: boolean; readonly anyStored: boolean }): { tone: ActionTone; label: string } {
  if (input.active) {
    if (input.stored) return { tone: 'done', label: 'Submitted' };
    if (input.ready) return { tone: 'pending', label: 'Not sent yet' };
    return { tone: 'choose', label: 'Your move' };
  }
  return input.anyStored ? { tone: 'done', label: 'Done' } : { tone: 'waiting', label: 'Waiting' };
}

/** The submit button: send, change a stored choice, or confirm it is stored. */
export function submitLabel(input: { readonly hasStored: boolean; readonly stored: boolean; readonly submitting: boolean }): string {
  if (input.submitting) return 'Sending…';
  if (input.stored) return 'Choice sent';
  return input.hasStored ? 'Update choice' : 'Submit';
}
