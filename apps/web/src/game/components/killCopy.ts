import type { KillDecision } from '@warewolf/contracts';
import type { ActionPrompt } from '../state/actions';
import { choiceNames } from './actionCopy';

/**
 * Words for the host's kill confirmation and the informed Doctor's target
 * line (WW-803b). Display names only. Role ids and the word "wolf" stay off
 * both surfaces. Who submitted a name is host-only and never goes in the rail.
 */

export type KillPick = { readonly kind: 'TARGET'; readonly playerId: string } | { readonly kind: 'NO_KILL' };

type Named = { readonly playerId: string; readonly displayName: string };

export function killPickOf(decision: KillDecision | null): KillPick | null {
  if (!decision) return null;
  if (decision.kind === 'NO_KILL') return { kind: 'NO_KILL' };
  return { kind: 'TARGET', playerId: decision.playerId };
}

export function sameKillPick(left: KillPick | null, right: KillPick | null): boolean {
  if (!left || !right) return false;
  if (left.kind === 'NO_KILL' || right.kind === 'NO_KILL') return left.kind === 'NO_KILL' && right.kind === 'NO_KILL';
  return left.playerId === right.playerId;
}

export function playerName(players: readonly Named[], playerId: string): string | null {
  return players.find((player) => player.playerId === playerId)?.displayName ?? null;
}

/** Host only. Empty when none of the submitters are on the public seat list. */
export function namedByLine(players: readonly Named[], submittedBy: readonly string[]): string | null {
  const line = choiceNames(players, submittedBy);
  return line ? `Named by ${line}` : null;
}

/**
 * The action-row sentence. A stored choice reads "Submitted" and can be
 * replaced until the window closes. A locked window states the attack.
 */
export function killRowText(options: { readonly editable: boolean; readonly stored: KillPick | null; readonly pick: KillPick | null; readonly name: string | null }): string {
  const showing = options.pick ?? options.stored;
  const saved = showing != null && sameKillPick(showing, options.stored);
  if (!options.editable) {
    if (options.stored?.kind === 'NO_KILL') return 'There is no attack.';
    if (options.stored?.kind === 'TARGET' && options.name) return `The attack is on ${options.name}.`;
    if (options.stored?.kind === 'TARGET') return 'The attack is chosen.';
    return 'Waiting for the host.';
  }
  if (saved && options.stored?.kind === 'NO_KILL') return 'Submitted. There is no attack. You can change it until this window closes.';
  if (saved && options.stored?.kind === 'TARGET') {
    return options.name ? `Submitted. The attack is on ${options.name}. You can change it until this window closes.` : 'Submitted. You can change it until this window closes.';
  }
  if (showing?.kind === 'NO_KILL') return 'No kill.';
  if (showing?.kind === 'TARGET' && options.name) return options.name;
  return 'Choose the player the pack named, or no kill.';
}

/**
 * The informed Doctor's line, from `finalWolfTarget` on `doctor_save`.
 * Absent outside the reaction window. Null means the host chose no attack.
 */
export function doctorAttackLine(prompts: readonly ActionPrompt[], players: readonly Named[]): string | null {
  const save = prompts.find((prompt) => prompt.abilityId === 'doctor_save' && prompt.finalWolfTarget !== undefined);
  if (!save || save.finalWolfTarget === undefined) return null;
  if (save.finalWolfTarget === null) return 'There is no attack.';
  const name = playerName(players, save.finalWolfTarget);
  return name ? `The attack is on ${name}.` : 'The attack is on a seated player.';
}
