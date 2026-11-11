import type { OwnAbility, TargetRuleDto } from '@warewolf/contracts';
import type { Availability } from '@warewolf/domain';
import type { ActionPrompt } from '../state/actions';

/**
 * Sentences for the one action panel (WW-604). The capability decides the
 * words. The target rule decides whether a seat, a question, or nothing is
 * required. Role ids never appear here.
 */

export function promptLabel(ability: Pick<OwnAbility, 'capability' | 'target'>): string {
  const { capability, target } = ability;
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
    if (stored) return 'Submitted';
    if (names) return names;
    return promptLabel(active.ability);
  }
  if (!night) return null;
  return anyStored ? 'Submitted' : 'Waiting for night to end';
}
