import type { GameLog, LogDetail, LogEntry, LogKind, LogPlayer, LogRound, LogStage, LogVisibility } from '@warewolf/contracts';
import type { Faction, GameStatus } from '@warewolf/domain';

/**
 * LOG-01: turns stored rows into the game log. Pure, so the redaction rules
 * are unit-tested without a database. `log.service.ts` loads the rows.
 *
 * The redaction contract:
 * - `events` holds PUBLIC rows and the viewer's own PLAYER rows only. HOST
 *   rows never reach this function.
 * - `own` holds the viewer's own actions and ballots.
 * - `revealed` is present only when the game is FINISHED, or for the host
 *   log. Every secret in the log comes from it.
 */

export interface LogEventRow {
  readonly seq: number;
  readonly type: string;
  readonly audience: 'PUBLIC' | 'PLAYER';
  readonly payload: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface LogActionRow {
  readonly id: string;
  readonly playerId: string;
  readonly roundNumber: number;
  readonly phase: string;
  readonly abilityId: string;
  readonly targetPlayerIds: readonly string[];
  readonly status: string;
  readonly createdAt: Date;
}

export interface LogVoteRow {
  readonly id: string;
  readonly voterPlayerId: string;
  readonly roundNumber: number;
  readonly ballot: number;
  readonly targetPlayerId: string | null;
  readonly submittedAt: Date;
}

export interface RevealedRows {
  readonly roles: readonly { playerId: string; roleId: string; faction: Faction; at: Date }[];
  readonly actions: readonly LogActionRow[];
  readonly votes: readonly LogVoteRow[];
  readonly eliminations: readonly {
    id: string;
    playerId: string;
    roundNumber: number;
    phaseKind: string;
    roleAtDeath: string;
    factionAtDeath: Faction;
    causes: readonly { type: string; actorIds: readonly string[] }[];
    at: Date;
  }[];
  readonly saves: readonly { roundNumber: number; playerId: string; attackType: string; saverIds: readonly string[]; at: Date }[];
  readonly infections: readonly { id: string; roundNumber: number; sourcePlayerId: string; targetPlayerId: string; outcome: string; at: Date }[];
  readonly conversions: readonly { id: string; roundNumber: number; playerId: string; toRoleId: string; toFaction: Faction; reason: string; at: Date }[];
  readonly investigations: readonly {
    id: string;
    roundNumber: number;
    actorPlayerId: string;
    abilityId: string;
    targetPlayerIds: readonly string[];
    result: Record<string, unknown>;
    at: Date;
  }[];
}

export interface LogSource {
  readonly status: GameStatus;
  /** Current seats. Removed lobby seats are named from event snapshots instead. */
  readonly seats: readonly LogPlayer[];
  readonly events: readonly LogEventRow[];
  readonly own: { readonly actions: readonly LogActionRow[]; readonly votes: readonly LogVoteRow[] };
  readonly revealed: RevealedRows | null;
}

const NIGHT_PHASES = new Set(['ROLE_REVEAL', 'NIGHT_SUBMIT', 'NIGHT_HOST_CONFIRM', 'NIGHT_REACTION']);
const END_PHASES = new Set(['FINISHED', 'CANCELLED']);

function stageOfPhase(phase: string): LogStage {
  if (NIGHT_PHASES.has(phase)) return 'NIGHT';
  if (END_PHASES.has(phase)) return 'END';
  return 'DAY';
}

function stageOfAction(phase: string): LogStage {
  return phase === 'DAY_DISCUSSION' ? 'DAY' : 'NIGHT';
}

/** Primitive fields only, so a stored result can never smuggle a nested object out. */
function scalars(value: unknown): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, field] of Object.entries(value)) {
    if (field === null || ['string', 'number', 'boolean'].includes(typeof field)) out[key] = field as string | number | boolean | null;
  }
  return out;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asSnapshot(value: unknown): LogPlayer | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const playerId = str(v['playerId']);
  const displayName = str(v['displayName']);
  const seatNumber = num(v['seatNumber']);
  const avatarId = num(v['avatarId']);
  if (!playerId || !displayName || seatNumber === null || avatarId === null) return null;
  return { playerId, displayName, seatNumber, avatarId };
}

/** Event types the log shows as a sentence of the viewer's own. Anything else private is skipped. */
const PRIVATE_TYPES = new Set([
  'INVESTIGATION_RESULT',
  'INFECTION_OCCURRED',
  'ROLE_CONVERTED',
  'VAMPIRE_TEAM_JOIN',
  'ACTION_BLOCKED',
  'SILENCED',
  'REWIND_RESULT',
  'ABILITY_COPIED',
  'CHAOS_EVENT',
]);

export function composeLog(source: LogSource): GameLog {
  const seats = new Map(source.seats.map((s) => [s.playerId, s]));
  // Snapshots from events name seats that were later removed in the lobby.
  for (const event of source.events) {
    for (const key of ['player', 'by', 'from', 'to', 'host']) {
      const snap = asSnapshot(event.payload[key]);
      if (snap && !seats.has(snap.playerId)) seats.set(snap.playerId, snap);
    }
  }
  const who = (id: string | null | undefined): LogPlayer[] => {
    if (!id) return [];
    const seat = seats.get(id);
    return seat ? [seat] : [];
  };
  const many = (ids: readonly string[]): LogPlayer[] => [...new Set(ids)].flatMap((id) => who(id));

  const reveal = source.revealed !== null;
  const entries: LogEntry[] = [];
  const add = (
    id: string,
    seq: number | null,
    at: Date,
    roundNumber: number,
    stage: LogStage,
    kind: LogKind,
    visibility: LogVisibility,
    actors: LogPlayer[],
    targets: LogPlayer[],
    detail: LogDetail = {},
  ) => entries.push({ id, seq, at: at.toISOString(), roundNumber, stage, kind, visibility, actors, targets, detail });

  // Walk the stored events in order, tracking where the table is.
  let round = 0;
  let stage: LogStage = 'LOBBY';
  const nightDeathRounds = new Set<number>();
  for (const event of [...source.events].sort((a, b) => a.seq - b.seq)) {
    const p = event.payload;
    const id = `e${event.seq}`;
    const at = event.createdAt;
    const roundOf = (fallback = round) => num(p['roundNumber']) ?? fallback;
    const player = asSnapshot(p['player']);
    const players = player ? [player] : [];

    if (event.audience === 'PLAYER') {
      if (!PRIVATE_TYPES.has(event.type)) continue;
      add(id, event.seq, at, roundOf(), 'NIGHT', 'PRIVATE_NOTICE', 'PRIVATE', [], many(targetIds(p)), { eventType: event.type, payload: p });
      continue;
    }

    switch (event.type) {
      case 'ROOM_CREATED': {
        const host = asSnapshot(p['host']);
        add(id, event.seq, at, 0, 'LOBBY', 'ROOM_CREATED', 'PUBLIC', host ? [host] : [], []);
        break;
      }
      case 'PLAYER_JOINED':
      case 'PLAYER_LEFT':
        add(id, event.seq, at, round, stage, event.type, 'PUBLIC', [], players);
        break;
      case 'PLAYER_KICKED': {
        const by = asSnapshot(p['by']);
        add(id, event.seq, at, round, stage, 'PLAYER_KICKED', 'PUBLIC', by ? [by] : [], players);
        break;
      }
      case 'HOST_CHANGED': {
        const from = asSnapshot(p['from']);
        const to = asSnapshot(p['to']);
        add(id, event.seq, at, round, stage, 'HOST_CHANGED', 'PUBLIC', from ? [from] : [], to ? [to] : []);
        break;
      }
      case 'GAME_STARTED':
        round = 1;
        add(id, event.seq, at, 0, 'LOBBY', 'GAME_STARTED', 'PUBLIC', [], [], { mode: str(p['mode']) ?? undefined, playerCount: num(p['playerCount']) ?? undefined });
        stage = 'NIGHT';
        break;
      case 'PLAYER_DISCONNECTED':
      case 'PLAYER_RECONNECTED':
        add(id, event.seq, at, round, stage, event.type, 'PUBLIC', [], players);
        break;
      case 'SEAT_RECLAIMED':
        add(id, event.seq, at, round, stage, 'SEAT_RECLAIMED', 'PUBLIC', [], players, { via: str(p['via']) ?? undefined });
        break;
      case 'PHASE_CHANGED': {
        const phase = str(p['phase']) ?? '';
        round = num(p['roundNumber']) ?? round;
        stage = stageOfPhase(phase);
        if (stage === 'END') break;
        add(id, event.seq, at, round, stage, 'PHASE_CHANGED', 'PUBLIC', [], [], { phase });
        // The morning after a night with no public death.
        if (phase === 'DAY_ANNOUNCE' && !nightDeathRounds.has(round)) add(`peace${round}`, null, at, round, 'NIGHT', 'PEACEFUL_NIGHT', 'PUBLIC', [], []);
        break;
      }
      case 'PLAYER_ELIMINATED': {
        const r = roundOf();
        nightDeathRounds.add(r);
        if (reveal) break; // KILL replaces it with the causes.
        add(id, event.seq, at, r, 'NIGHT', 'NIGHT_DEATH', 'PUBLIC', [], who(str(p['playerId'])), { roleId: str(p['roleId']) });
        break;
      }
      case 'DAY_ELIMINATED':
        if (reveal) break;
        add(id, event.seq, at, roundOf(), 'DAY', 'DAY_ELIMINATION', 'PUBLIC', [], players, { byVote: p['byVote'] === true, roleId: str(p['roleId']) });
        break;
      case 'VOTE_TALLY': {
        const counts = Array.isArray(p['counts']) ? (p['counts'] as { targetPlayerId?: unknown; total?: unknown }[]) : [];
        const tied = Array.isArray(p['tiedPlayerIds']) ? (p['tiedPlayerIds'] as string[]) : [];
        add(id, event.seq, at, roundOf(), 'DAY', 'VOTE_TALLY', 'PUBLIC', [], who(str(p['votedOutPlayerId'])), {
          ballot: num(p['ballot']) ?? 1,
          counts: counts.flatMap((c) => {
            const seat = who(str(c.targetPlayerId))[0];
            return seat && typeof c.total === 'number' ? [{ player: seat, total: c.total }] : [];
          }),
          abstentions: num(p['abstentions']) ?? 0,
          tied: tied.length > 1,
        });
        break;
      }
      case 'RESULT_PUBLISHED':
        add(id, event.seq, at, roundOf(), 'DAY', 'RESULT_PUBLISHED', 'PUBLIC', who(str(p['publisherPlayerId'])), many(targetIds(p)), { result: scalars(p['result']) });
        break;
      case 'GHOST_HINT':
        add(id, event.seq, at, roundOf(), 'NIGHT', 'GHOST_HINT', 'PUBLIC', [], [], { text: str(p['text']) ?? '' });
        break;
      case 'PLAYER_RETURNED':
        add(id, event.seq, at, roundOf(), 'NIGHT', 'PLAYER_RETURNED', 'PUBLIC', [], who(str(p['playerId'])));
        break;
      case 'GAME_FINISHED':
        add(id, event.seq, at, round, 'END', 'GAME_FINISHED', 'PUBLIC', [], [], { outcomes: outcomesOf(p['outcomes']) });
        break;
      case 'GAME_CANCELLED': {
        const by = asSnapshot(p['by']);
        add(id, event.seq, at, round, 'END', 'GAME_CANCELLED', 'PUBLIC', by ? [by] : [], [], { reason: str(p['reason']) ?? undefined });
        break;
      }
      default:
        break;
    }
  }

  if (source.revealed) {
    addRevealed(source.revealed, add, who, many);
  } else {
    for (const action of source.own.actions) {
      if (action.status === 'CANCELLED') continue;
      add(`a${action.id}`, null, action.createdAt, action.roundNumber, stageOfAction(action.phase), 'MY_ACTION', 'PRIVATE', who(action.playerId), many(action.targetPlayerIds), {
        abilityId: action.abilityId,
        status: action.status,
      });
    }
    for (const vote of source.own.votes) {
      add(`v${vote.id}`, null, vote.submittedAt, vote.roundNumber, 'DAY', 'MY_VOTE', 'PRIVATE', who(vote.voterPlayerId), who(vote.targetPlayerId), { ballot: vote.ballot });
    }
  }

  return group(source.status, reveal, entries, source.events.reduce((max, e) => Math.max(max, e.seq), 0));
}

type Add = (
  id: string,
  seq: number | null,
  at: Date,
  roundNumber: number,
  stage: LogStage,
  kind: LogKind,
  visibility: LogVisibility,
  actors: LogPlayer[],
  targets: LogPlayer[],
  detail?: LogDetail,
) => void;

function addRevealed(rows: RevealedRows, add: Add, who: (id: string | null) => LogPlayer[], many: (ids: readonly string[]) => LogPlayer[]): void {
  for (const role of rows.roles) {
    add(`r${role.playerId}`, null, role.at, 1, 'NIGHT', 'ROLE_DEALT', 'REVEALED', [], who(role.playerId), { roleId: role.roleId, faction: role.faction });
  }
  for (const action of rows.actions) {
    if (action.status === 'CANCELLED') continue;
    add(`a${action.id}`, null, action.createdAt, action.roundNumber, stageOfAction(action.phase), 'NIGHT_ACTION', 'REVEALED', who(action.playerId), many(action.targetPlayerIds), {
      abilityId: action.abilityId,
      status: action.status,
    });
  }
  for (const death of rows.eliminations) {
    const killers = death.causes.flatMap((cause) => cause.actorIds);
    const byVote = death.causes.some((cause) => cause.type === 'DAY_VOTE');
    add(`k${death.id}`, null, death.at, death.roundNumber, death.phaseKind === 'NIGHT' ? 'NIGHT' : 'DAY', 'KILL', 'REVEALED', byVote ? [] : many(killers), who(death.playerId), {
      causes: death.causes.map((cause) => cause.type),
      roleId: death.roleAtDeath,
      faction: death.factionAtDeath,
      byVote,
    });
  }
  rows.saves.forEach((save, i) => {
    add(`s${save.roundNumber}-${save.playerId}-${i}`, null, save.at, save.roundNumber, 'NIGHT', 'SAVE', 'REVEALED', many(save.saverIds), who(save.playerId), { causes: [save.attackType] });
  });
  for (const vote of rows.votes) {
    add(`v${vote.id}`, null, vote.submittedAt, vote.roundNumber, 'DAY', 'BALLOT', 'REVEALED', who(vote.voterPlayerId), who(vote.targetPlayerId), { ballot: vote.ballot });
  }
  for (const row of rows.infections) {
    add(`i${row.id}`, null, row.at, row.roundNumber, 'NIGHT', 'INFECTION', 'REVEALED', who(row.sourcePlayerId), who(row.targetPlayerId), { outcome: row.outcome });
  }
  for (const row of rows.conversions) {
    add(`c${row.id}`, null, row.at, row.roundNumber, 'NIGHT', 'CONVERSION', 'REVEALED', [], who(row.playerId), { roleId: row.toRoleId, faction: row.toFaction, reason: row.reason });
  }
  for (const row of rows.investigations) {
    add(`n${row.id}`, null, row.at, row.roundNumber, 'NIGHT', 'INVESTIGATION', 'REVEALED', who(row.actorPlayerId), many(row.targetPlayerIds), {
      abilityId: row.abilityId,
      result: scalars(row.result),
    });
  }
}

function targetIds(p: Record<string, unknown>): string[] {
  const ids = Array.isArray(p['targetPlayerIds']) ? p['targetPlayerIds'] : [];
  return ids.filter((id): id is string => typeof id === 'string');
}

function outcomesOf(value: unknown): NonNullable<LogDetail['outcomes']> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row: Record<string, unknown>) => {
    if (!row || typeof row !== 'object') return [];
    return [
      {
        scope: str(row['scope']) ?? 'TEAM',
        outcome: str(row['outcome']) ?? 'WIN',
        faction: (str(row['faction']) as Faction | null) ?? null,
        roleId: str(row['roleId']),
        player: asSnapshot(row['player']),
      },
    ];
  });
}

/** Lobby, then rounds oldest first with night before day, then the end. Inside a stage, by time. */
function group(status: GameStatus, revealed: boolean, entries: readonly LogEntry[], lastSeq: number): GameLog {
  const byTime = (a: LogEntry, b: LogEntry) => a.at.localeCompare(b.at) || (a.seq ?? Infinity) - (b.seq ?? Infinity) || a.id.localeCompare(b.id);
  const lobby = entries.filter((e) => e.stage === 'LOBBY').sort(byTime);
  const end = entries.filter((e) => e.stage === 'END').sort(byTime);
  const rounds = new Map<number, LogRound>();
  for (const entry of entries) {
    if (entry.stage !== 'NIGHT' && entry.stage !== 'DAY') continue;
    const n = Math.max(1, entry.roundNumber);
    const round = rounds.get(n) ?? { roundNumber: n, night: [], day: [], summary: { deaths: 0, saves: 0 } };
    (entry.stage === 'NIGHT' ? round.night : round.day).push(entry);
    rounds.set(n, round);
  }
  const list = [...rounds.values()].sort((a, b) => a.roundNumber - b.roundNumber).map((round) => {
    const all = [...round.night, ...round.day];
    return {
      roundNumber: round.roundNumber,
      night: [...round.night].sort(byTime),
      day: [...round.day].sort(byTime),
      summary: {
        deaths: all.filter((e) => e.kind === 'NIGHT_DEATH' || e.kind === 'DAY_ELIMINATION' || e.kind === 'KILL').length,
        saves: all.filter((e) => e.kind === 'SAVE').length,
      },
    };
  });
  return { status, revealed, lastSeq, lobby, rounds: list, end };
}
