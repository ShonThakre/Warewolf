import type { GameEvent } from '@warewolf/contracts';
import { roleLabel, teamWord } from './resultsCopy';

/**
 * Sentences for the facts a seat may read at the table (WW-1001).
 * A host copy names an actor or a source. Those stay off this surface.
 */

const CATEGORY: Record<string, string> = {
  WOLF: 'a Wolf',
  NEUTRAL: 'Neutral',
  INDEPENDENT: 'Independent',
  VILLAGE_POWER: 'a Village role with a power',
  VILLAGE_BASIC: 'a Villager',
};

type NameOf = (playerId: string) => string;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function names(ids: unknown, nameOf: NameOf): string {
  if (!Array.isArray(ids) || ids.length === 0) return 'no one';
  const line = ids.filter((id): id is string => typeof id === 'string').map(nameOf);
  if (line.length === 0) return 'no one';
  if (line.length === 1) return line[0]!;
  if (line.length === 2) return `${line[0]} and ${line[1]}`;
  return `${line.slice(0, -1).join(', ')}, and ${line.at(-1)}`;
}

/** One event, or null when it is not for this seat's table. */
export function tableNote(event: GameEvent, youId: string, nameOf: NameOf): string | null {
  const payload = event.payload;
  if (event.type === 'INVESTIGATION_RESULT') {
    if (text(payload['actorPlayerId']) && payload['actorPlayerId'] !== youId) return null;
    return investigation(payload, nameOf);
  }
  if (event.type === 'INFECTION_OCCURRED') {
    if (text(payload['sourcePlayerId'])) return null;
    const role = text(payload['roleId']);
    return role ? `You are now ${roleLabel(role)}.` : null;
  }
  if (event.type === 'ROLE_CONVERTED') {
    const about = text(payload['playerId']);
    if (about && about !== youId) return null;
    const role = text(payload['roleId']);
    return role ? `You are now ${roleLabel(role)}.` : null;
  }
  if (event.type === 'ACTION_BLOCKED') {
    if (text(payload['actorId'])) return null;
    return 'Your action was blocked.';
  }
  if (event.type === 'PLAYER_ELIMINATED') {
    const id = text(payload['playerId']);
    if (!id) return null;
    const role = text(payload['roleId']);
    const name = nameOf(id);
    return role ? `${name} was eliminated. They were ${roleLabel(role)}.` : `${name} was eliminated.`;
  }
  return null;
}

function investigation(payload: Record<string, unknown>, nameOf: NameOf): string | null {
  const kind = text(payload['kind']);
  const result = isRecord(payload['result']) ? payload['result'] : {};
  const who = names(payload['targetPlayerIds'], nameOf);
  const value = result['value'];
  if (kind === 'ALIGNMENT_WOLF_OR_NOT') {
    if (value === 'WOLF') return `${who} is a Wolf.`;
    if (value === 'NOT_WOLF') return `${who} is not a Wolf.`;
    return null;
  }
  if (kind === 'ROLE_CATEGORY') return `${who} reads as ${CATEGORY[String(value)] ?? 'a role'}.`;
  if (kind === 'ROLE_ID') return `${who} is ${roleLabel(String(value))}.`;
  if (kind === 'ROLE_AT_DEATH') return `${who} was ${roleLabel(String(value))}.`;
  if (kind === 'SAME_OR_DIFFERENT_FACTION') {
    return value === 'SAME' ? `${who} are the same faction.` : `${who} are different factions.`;
  }
  if (kind === 'VISITED_PLAYER_IDS') {
    const visited = names(value, nameOf);
    return visited === 'no one' ? `${who} visited no one.` : `${who} visited ${visited}.`;
  }
  if (kind === 'YES_NO') return value === true ? 'Yes.' : 'No.';
  if (kind === 'WOLF_KILL_SUBMISSION_COUNT') return `${Number(value) || 0} kill choices.`;
  if (kind === 'FACTION' && (value === 'VILLAGE' || value === 'WOLF_PACK' || value === 'NEUTRAL' || value === 'INDEPENDENT')) {
    return `${who} is ${teamWord(value)}.`;
  }
  return null;
}
