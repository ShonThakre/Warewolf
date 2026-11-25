import type { GameEvent, LogEntry, LogKind, LogPlayer } from '@warewolf/contracts';
import { DEFAULT_CATALOG, type Faction } from '@warewolf/domain';
import type { GameIconName } from './GameIcon';
import { capabilityTitle } from './roleCopy';
import { roleLabel, teamWord } from './resultsCopy';
import { tableNote } from './tableNotes';

/**
 * LOG-02: words for the game log. Every entry becomes a sentence of segments,
 * so the log can draw each named player as a chip. A team colour always comes
 * with its word, and a death is always said in words.
 */

export type LogSegment = string | { readonly player: LogPlayer } | { readonly team: Faction };

export interface LogLine {
  readonly segments: readonly LogSegment[];
  /** A second, quieter line: the tally, the roles of the killers. */
  readonly detail?: string;
  readonly icon: GameIconName;
  /** Drives the row's accent: deaths, saves, secrets, and table chatter read differently. */
  readonly tone: 'death' | 'save' | 'vote' | 'info' | 'table' | 'secret';
}

const ABILITY_CAPABILITY = new Map<string, string | null>();
for (const role of DEFAULT_CATALOG.roles)
  for (const profile of Object.values(role.profiles)) for (const ability of profile.abilities) ABILITY_CAPABILITY.set(ability.id, ability.capability);

/** "Investigate", "Protect": the catalog has no ability names, so the capability names it. */
export function abilityName(abilityId: string | undefined): string {
  if (!abilityId) return 'an ability';
  const capability = ABILITY_CAPABILITY.get(abilityId);
  return capability ? capabilityTitle(capability) : 'an ability';
}

const ATTACK_VERB: Record<string, string> = {
  WOLF_KILL: 'attacked',
  SNIPER: 'shot',
  POISON: 'poisoned',
  REVENGE: 'took revenge on',
  VAMPIRE: 'drained',
  DAY_VOTE: 'voted out',
};

const ATTACK_NOUN: Record<string, string> = {
  WOLF_KILL: 'the wolf attack',
  SNIPER: 'a shot',
  POISON: 'poison',
  REVENGE: 'revenge',
  VAMPIRE: 'the vampire',
  DAY_VOTE: 'the vote',
};

const PHASE_SENTENCE: Record<string, string> = {
  ROLE_REVEAL: 'Roles are dealt. Everyone checks their card.',
  NIGHT_SUBMIT: 'Night falls. Night roles choose their targets.',
  NIGHT_HOST_CONFIRM: 'The host confirms the wolves’ target.',
  NIGHT_REACTION: 'Reactions open for the night.',
  DAY_ANNOUNCE: 'Morning breaks over the village.',
  DAY_DISCUSSION: 'Discussion opens.',
  VOTING: 'Voting opens.',
  REVOTE: 'The vote tied. A revote opens.',
};

const RESULT_WORD: Record<string, string> = {
  WOLF: 'a Wolf',
  WOLF_PACK: 'a Wolf',
  VILLAGE: 'Village',
  NEUTRAL: 'Neutral',
  INDEPENDENT: 'Independent',
  VILLAGE_POWER: 'a Village role with a power',
  VILLAGE_BASIC: 'a Villager',
  true: 'yes',
  false: 'no',
};

/** "Ana", "Ana and Ben", "Ana, Ben, and Cal" as segments. */
function list(players: readonly LogPlayer[]): LogSegment[] {
  if (players.length === 0) return ['no one'];
  const out: LogSegment[] = [];
  players.forEach((player, i) => {
    if (i > 0) out.push(i === players.length - 1 ? (players.length === 2 ? ' and ' : ', and ') : ', ');
    out.push({ player });
  });
  return out;
}

function resultWord(result: Record<string, unknown> | undefined): string {
  if (!result) return 'a result';
  for (const value of Object.values(result)) {
    if (value === null || value === undefined) continue;
    const key = String(value);
    if (RESULT_WORD[key]) return RESULT_WORD[key];
    if (DEFAULT_CATALOG.byId.has(key)) return roleLabel(key);
    return key.toLowerCase().replace(/_/g, ' ');
  }
  return 'a result';
}

function roleWithTeam(roleId: string | null | undefined, faction: Faction | null | undefined): LogSegment[] {
  if (!roleId) return [];
  return faction ? [roleLabel(roleId), ' (', { team: faction }, ')'] : [roleLabel(roleId)];
}

/** A name for a seat id, for sentences built by `tableNote`. */
function nameFrom(entry: LogEntry, seats: ReadonlyMap<string, LogPlayer>) {
  return (id: string) => seats.get(id)?.displayName ?? entry.targets.find((p) => p.playerId === id)?.displayName ?? 'a player';
}

/** The sentence for one entry. `seats` names players a private notice mentions by id. */
export function logLine(entry: LogEntry, youId: string, seats: ReadonlyMap<string, LogPlayer> = new Map()): LogLine {
  const d = entry.detail;
  const [actor] = entry.actors;
  const [target] = entry.targets;
  const a = actor ? { player: actor } : 'Someone';
  const t = target ? { player: target } : 'someone';

  switch (entry.kind) {
    case 'ROOM_CREATED':
      return { segments: [a, ' opened the room.'], icon: 'plus', tone: 'table' };
    case 'PLAYER_JOINED':
      return { segments: [t, ' joined.'], icon: 'people', tone: 'table' };
    case 'PLAYER_LEFT':
      return { segments: [t, ' left the room.'], icon: 'people', tone: 'table' };
    case 'PLAYER_KICKED':
      return { segments: [a, ' removed ', t, ' from the room.'], icon: 'cross', tone: 'table' };
    case 'HOST_CHANGED':
      return { segments: [t, ' is now the host', ...(actor ? [', handed over by ', a] : []), '.'], icon: 'people', tone: 'table' };
    case 'GAME_STARTED':
      return { segments: [`The game began with ${d.playerCount ?? 'all'} players.`], icon: 'play', tone: 'info' };
    case 'GAME_CANCELLED':
      return {
        segments: d.reason === 'SURRENDER' ? ['The table agreed to end the game.'] : [a, ' ended the game.'],
        icon: 'cross',
        tone: 'info',
      };
    case 'GAME_FINISHED':
      return { segments: finishSegments(d.outcomes ?? []), icon: 'check', tone: 'info' };
    case 'PLAYER_DISCONNECTED':
      return { segments: [t, ' lost connection.'], icon: 'people', tone: 'table' };
    case 'PLAYER_RECONNECTED':
      return { segments: [t, ' is back.'], icon: 'people', tone: 'table' };
    case 'SEAT_RECLAIMED':
      return { segments: [t, d.via === 'CODE' ? ' rejoined from another device.' : ' rejoined.'], icon: 'people', tone: 'table' };
    case 'PHASE_CHANGED':
      return { segments: [PHASE_SENTENCE[d.phase ?? ''] ?? 'The phase changed.'], icon: d.phase?.startsWith('NIGHT') || d.phase === 'ROLE_REVEAL' ? 'moon' : 'sun', tone: 'info' };
    case 'PEACEFUL_NIGHT':
      return { segments: ['Nobody died in the night.'], icon: 'moon', tone: 'save' };
    case 'NIGHT_DEATH':
      return { segments: [t, ' was found dead at dawn', ...(d.roleId ? [' — ', roleLabel(d.roleId)] : []), '.'], icon: 'kill', tone: 'death' };
    case 'DAY_ELIMINATION':
      return {
        segments: [t, d.byVote ? ' was voted out' : ' was eliminated during the day', ...(d.roleId ? [' — ', roleLabel(d.roleId)] : []), '.'],
        icon: d.byVote ? 'vote' : 'kill',
        tone: 'death',
      };
    case 'VOTE_TALLY': {
      const counts = (d.counts ?? []).map((c) => `${c.player.displayName} ${c.total}`);
      if (d.abstentions) counts.push(`abstained ${d.abstentions}`);
      const label = d.ballot === 2 ? 'Revote' : 'Vote';
      const segments: LogSegment[] = target
        ? [`${label}: `, t, ' received the most votes.']
        : d.tied
          ? [`${label}: a tie. Nobody was voted out.`]
          : [`${label}: nobody was voted out.`];
      return { segments, ...(counts.length ? { detail: counts.join(' · ') } : {}), icon: 'vote', tone: 'vote' };
    }
    case 'RESULT_PUBLISHED':
      return { segments: [a, ' made a result public: ', ...list(entry.targets), ` is ${resultWord(d.result)}.`], icon: 'magnifier', tone: 'info' };
    case 'GHOST_HINT':
      return { segments: [`A ghost left a hint: “${d.text ?? ''}”`], icon: 'book', tone: 'info' };
    case 'PLAYER_RETURNED':
      return { segments: [t, ' returned from the dead.'], icon: 'heal', tone: 'save' };
    case 'MY_ACTION':
      return {
        segments: [`You used ${abilityName(d.abilityId)}`, ...(entry.targets.length ? [' on ', ...list(entry.targets)] : []), d.status === 'REJECTED' ? ', but it did not go through.' : '.'],
        icon: 'lock',
        tone: 'secret',
      };
    case 'MY_VOTE':
      return {
        segments: [d.ballot === 2 ? 'In the revote, you ' : 'You ', ...(target ? ['voted for ', t, '.'] : ['abstained.'])],
        icon: 'vote',
        tone: 'secret',
      };
    case 'PRIVATE_NOTICE': {
      const event: GameEvent = { seq: entry.seq ?? 1, type: d.eventType ?? '', audience: 'PLAYER', payload: d.payload ?? {} };
      const sentence = tableNote(event, youId, nameFrom(entry, seats));
      return { segments: [sentence ?? 'You received a private result.'], icon: 'lock', tone: 'secret' };
    }
    case 'ROLE_DEALT':
      return { segments: [t, ' was ', ...roleWithTeam(d.roleId, d.faction), '.'], icon: 'card', tone: 'secret' };
    case 'NIGHT_ACTION':
      return {
        segments: [a, ` used ${abilityName(d.abilityId)}`, ...(entry.targets.length ? [' on ', ...list(entry.targets)] : []), d.status === 'REJECTED' ? ', but it did not go through.' : '.'],
        icon: 'magnifier',
        tone: 'secret',
      };
    case 'KILL': {
      const causes = d.causes ?? [];
      if (d.byVote) return { segments: [t, ' was voted out. They were ', ...roleWithTeam(d.roleId, d.faction), '.'], icon: 'vote', tone: 'death' };
      const verb = ATTACK_VERB[causes[0] ?? ''] ?? 'killed';
      const segments: LogSegment[] = entry.actors.length ? [...list(entry.actors), ` ${verb} `, t, '.'] : [t, ` died from ${ATTACK_NOUN[causes[0] ?? ''] ?? 'an attack'}.`];
      return { segments, ...(d.roleId ? { detail: `${target?.displayName ?? 'They'} was ${roleLabel(d.roleId)}${d.faction ? ` (${teamWord(d.faction)})` : ''}.` } : {}), icon: 'kill', tone: 'death' };
    }
    case 'SAVE':
      return { segments: [...list(entry.actors), ' saved ', t, ` from ${ATTACK_NOUN[d.causes?.[0] ?? ''] ?? 'an attack'}.`], icon: 'shield', tone: 'save' };
    case 'BALLOT':
      return { segments: [a, ...(target ? [' voted for ', t] : [' abstained']), d.ballot === 2 ? ' in the revote.' : '.'], icon: 'vote', tone: 'vote' };
    case 'INFECTION':
      return {
        segments: d.outcome === 'SUCCESS' ? [a, ' infected ', t, '.'] : [a, ' tried to infect ', t, ', but it failed.'],
        icon: 'infect',
        tone: d.outcome === 'SUCCESS' ? 'death' : 'secret',
      };
    case 'CONVERSION':
      return { segments: [t, ' became ', ...roleWithTeam(d.roleId, d.faction), '.'], icon: 'potion', tone: 'secret' };
    case 'INVESTIGATION':
      return { segments: [a, ' investigated ', ...list(entry.targets), ` and learned ${resultWord(d.result)}.`], icon: 'magnifier', tone: 'secret' };
    default:
      return { segments: ['Something happened.'], icon: 'book', tone: 'info' };
  }
}

function finishSegments(outcomes: NonNullable<LogEntry['detail']['outcomes']>): LogSegment[] {
  const team = outcomes.find((o) => o.scope === 'TEAM');
  if (!team || team.outcome === 'DRAW') {
    if (outcomes.some((o) => o.outcome === 'DRAW')) return ['The game ended in a draw.'];
  }
  const out: LogSegment[] = team?.faction ? ['Game over. ', { team: team.faction }, ' wins.'] : ['Game over.'];
  for (const solo of outcomes.filter((o) => o.scope === 'INDIVIDUAL' && o.player)) {
    out.push(' ', { player: solo.player! }, ` also wins${solo.roleId ? ` as ${roleLabel(solo.roleId)}` : ''}.`);
  }
  return out;
}

/** Plain text of a line, for an accessible label and for tests. */
export function lineText(line: LogLine): string {
  return line.segments
    .map((s) => (typeof s === 'string' ? s : 'player' in s ? s.player.displayName : teamWord(s.team)))
    .join('');
}

export type LogFilter = 'all' | 'deaths' | 'votes' | 'players' | 'mine';

export const LOG_FILTERS: readonly { readonly id: LogFilter; readonly label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'deaths', label: 'Deaths' },
  { id: 'votes', label: 'Votes' },
  { id: 'players', label: 'Players' },
  { id: 'mine', label: 'Mine' },
];

const FILTER_KINDS: Record<Exclude<LogFilter, 'all' | 'mine'>, ReadonlySet<LogKind>> = {
  deaths: new Set(['NIGHT_DEATH', 'DAY_ELIMINATION', 'KILL', 'SAVE', 'PEACEFUL_NIGHT', 'PLAYER_RETURNED', 'INFECTION']),
  votes: new Set(['VOTE_TALLY', 'MY_VOTE', 'BALLOT', 'DAY_ELIMINATION']),
  players: new Set(['ROOM_CREATED', 'PLAYER_JOINED', 'PLAYER_LEFT', 'PLAYER_KICKED', 'HOST_CHANGED', 'PLAYER_DISCONNECTED', 'PLAYER_RECONNECTED', 'SEAT_RECLAIMED']),
};

export function matchesFilter(entry: LogEntry, filter: LogFilter, youId: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'mine') return entry.visibility === 'PRIVATE' || [...entry.actors, ...entry.targets].some((p) => p.playerId === youId);
  if (filter === 'votes' && entry.kind === 'KILL') return entry.detail.byVote === true;
  return FILTER_KINDS[filter].has(entry.kind);
}

/** The round header's summary chip. */
export function roundSummary(summary: { readonly deaths: number; readonly saves: number }): string {
  const parts = [summary.deaths === 0 ? 'No deaths' : summary.deaths === 1 ? '1 eliminated' : `${summary.deaths} eliminated`];
  if (summary.saves > 0) parts.push(summary.saves === 1 ? '1 saved' : `${summary.saves} saved`);
  return parts.join(' · ');
}

export const VISIBILITY_LABEL = { PRIVATE: 'Only you', REVEALED: 'Revealed' } as const;
