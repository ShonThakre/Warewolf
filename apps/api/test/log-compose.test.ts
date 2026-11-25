import { randomUUID } from 'node:crypto';
import { gameLogSchema, type LogPlayer } from '@warewolf/contracts';
import { describe, expect, it } from 'vitest';
import { composeLog, type LogEventRow, type LogSource, type RevealedRows } from '../src/log/compose.js';

const seat = (n: number): LogPlayer => ({ playerId: randomUUID(), displayName: `Player ${n}`, seatNumber: n, avatarId: n });
const [ana, ben, cal, dee] = [seat(1), seat(2), seat(3), seat(4)] as [LogPlayer, LogPlayer, LogPlayer, LogPlayer];

let seq = 0;
let clock = Date.UTC(2026, 10, 25, 12);
function ev(type: string, payload: Record<string, unknown>, audience: 'PUBLIC' | 'PLAYER' = 'PUBLIC'): LogEventRow {
  seq += 1;
  clock += 1000;
  return { seq, type, audience, payload, createdAt: new Date(clock) };
}

function base(events: LogEventRow[], over: Partial<LogSource> = {}): LogSource {
  return { status: 'ACTIVE', seats: [ana, ben, cal], events, own: { actions: [], votes: [] }, revealed: null, ...over };
}

/** A game where Dee joined and was kicked, then night 1 killed Ben and day 1 voted out Cal. */
function playedEvents(): LogEventRow[] {
  seq = 0;
  return [
    ev('ROOM_CREATED', { host: ana }),
    ev('PLAYER_JOINED', { player: ben }),
    ev('PLAYER_JOINED', { player: dee }),
    ev('PLAYER_KICKED', { player: dee, by: ana }),
    ev('PLAYER_JOINED', { player: cal }),
    ev('GAME_STARTED', { mode: 'CLASSIC', playerCount: 3 }),
    ev('PHASE_CHANGED', { phase: 'NIGHT_SUBMIT', roundNumber: 1, stateVersion: 3 }),
    ev('INVESTIGATION_RESULT', { roundNumber: 1, actionId: randomUUID(), abilityId: 'seer_inspect', targetPlayerIds: [cal.playerId], result: { faction: 'WOLF_PACK' } }, 'PLAYER'),
    ev('PLAYER_ELIMINATED', { roundNumber: 1, playerId: ben.playerId, seatNumber: 2, roleId: null }),
    ev('PHASE_CHANGED', { phase: 'DAY_ANNOUNCE', roundNumber: 1, stateVersion: 4 }),
    ev('PLAYER_DISCONNECTED', { player: cal }),
    ev('VOTE_TALLY', { roundNumber: 1, ballot: 1, counts: [{ targetPlayerId: cal.playerId, total: 2 }], abstentions: 0, votedOutPlayerId: cal.playerId, tiedPlayerIds: [] }),
    ev('DAY_ELIMINATED', { roundNumber: 1, player: cal, byVote: true, roleId: null }),
    ev('PHASE_CHANGED', { phase: 'FINISHED', roundNumber: 1, stateVersion: 6 }),
    ev('GAME_FINISHED', { roundNumber: 1, outcomes: [{ scope: 'TEAM', outcome: 'WIN', faction: 'VILLAGE', roleId: null, player: null }] }),
  ];
}

describe('composeLog (LOG-01)', () => {
  it('groups lobby, rounds, and the end, and names a kicked seat from its snapshot', () => {
    const log = gameLogSchema.parse(composeLog(base(playedEvents())));
    expect(log.lobby.map((e) => e.kind)).toEqual(['ROOM_CREATED', 'PLAYER_JOINED', 'PLAYER_JOINED', 'PLAYER_KICKED', 'PLAYER_JOINED', 'GAME_STARTED']);
    const kick = log.lobby.find((e) => e.kind === 'PLAYER_KICKED')!;
    expect(kick.targets[0]?.displayName).toBe('Player 4');
    expect(kick.actors[0]?.playerId).toBe(ana.playerId);
    expect(log.rounds).toHaveLength(1);
    const [round] = log.rounds;
    expect(round!.night.map((e) => e.kind)).toEqual(['PHASE_CHANGED', 'PRIVATE_NOTICE', 'NIGHT_DEATH']);
    expect(round!.day.map((e) => e.kind)).toEqual(['PHASE_CHANGED', 'PLAYER_DISCONNECTED', 'VOTE_TALLY', 'DAY_ELIMINATION']);
    expect(round!.summary).toEqual({ deaths: 2, saves: 0 });
    expect(log.end.map((e) => e.kind)).toEqual(['GAME_FINISHED']);
    expect(log.lastSeq).toBe(seq);
  });

  it('marks a morning with no death as a peaceful night', () => {
    seq = 0;
    const log = composeLog(base([ev('GAME_STARTED', {}), ev('PHASE_CHANGED', { phase: 'NIGHT_SUBMIT', roundNumber: 1 }), ev('PHASE_CHANGED', { phase: 'DAY_ANNOUNCE', roundNumber: 1 })]));
    expect(log.rounds[0]!.night.map((e) => e.kind)).toContain('PEACEFUL_NIGHT');
  });

  it('during play: no secret entries, the viewer’s own action and vote are private', () => {
    const actionId = randomUUID();
    const log = composeLog(
      base(playedEvents(), {
        own: {
          actions: [{ id: actionId, playerId: ana.playerId, roundNumber: 1, phase: 'NIGHT_SUBMIT', abilityId: 'seer_inspect', targetPlayerIds: [cal.playerId], status: 'RESOLVED', createdAt: new Date(clock) }],
          votes: [{ id: randomUUID(), voterPlayerId: ana.playerId, roundNumber: 1, ballot: 1, targetPlayerId: cal.playerId, submittedAt: new Date(clock) }],
        },
      }),
    );
    const all = [...log.lobby, ...log.rounds.flatMap((r) => [...r.night, ...r.day]), ...log.end];
    expect(log.revealed).toBe(false);
    expect(all.some((e) => e.visibility === 'REVEALED')).toBe(false);
    expect(all.filter((e) => e.visibility === 'PRIVATE').map((e) => e.kind).sort()).toEqual(['MY_ACTION', 'MY_VOTE', 'PRIVATE_NOTICE']);
    // The public night death names no killer and no role.
    const death = all.find((e) => e.kind === 'NIGHT_DEATH')!;
    expect(death.actors).toEqual([]);
    expect(death.detail.roleId).toBeNull();
  });

  it('skips private event types it does not know', () => {
    seq = 0;
    const log = composeLog(base([ev('GAME_STARTED', {}), ev('SOMETHING_NEW', { roundNumber: 1 }, 'PLAYER')]));
    expect(log.rounds).toEqual([]);
  });

  it('at game end: who killed whom, saves, ballots and roles are revealed, and public deaths give way to KILL', () => {
    const killId = randomUUID();
    const revealed: RevealedRows = {
      roles: [ana, ben, cal].map((p, i) => ({ playerId: p.playerId, roleId: i === 2 ? 'alpha_wolf' : 'normal_villager', faction: i === 2 ? 'WOLF_PACK' : 'VILLAGE', at: new Date(clock) })),
      actions: [],
      votes: [{ id: randomUUID(), voterPlayerId: ben.playerId, roundNumber: 1, ballot: 1, targetPlayerId: cal.playerId, submittedAt: new Date(clock) }],
      eliminations: [
        { id: killId, playerId: ben.playerId, roundNumber: 1, phaseKind: 'NIGHT', roleAtDeath: 'normal_villager', factionAtDeath: 'VILLAGE', causes: [{ type: 'WOLF_KILL', actorIds: [cal.playerId] }], at: new Date(clock) },
        { id: randomUUID(), playerId: cal.playerId, roundNumber: 1, phaseKind: 'DAY', roleAtDeath: 'alpha_wolf', factionAtDeath: 'WOLF_PACK', causes: [{ type: 'DAY_VOTE', actorIds: [ana.playerId, ben.playerId] }], at: new Date(clock) },
      ],
      saves: [{ roundNumber: 1, playerId: ana.playerId, attackType: 'WOLF_KILL', saverIds: [ben.playerId], at: new Date(clock) }],
      infections: [],
      conversions: [],
      investigations: [],
    };
    const log = gameLogSchema.parse(composeLog(base(playedEvents(), { status: 'FINISHED', revealed })));
    const all = log.rounds.flatMap((r) => [...r.night, ...r.day]);
    expect(log.revealed).toBe(true);
    expect(all.some((e) => e.kind === 'NIGHT_DEATH' || e.kind === 'DAY_ELIMINATION')).toBe(false);
    const kill = all.find((e) => e.id === `k${killId}`)!;
    expect(kill).toMatchObject({ kind: 'KILL', visibility: 'REVEALED', stage: 'NIGHT' });
    expect(kill.actors.map((p) => p.playerId)).toEqual([cal.playerId]);
    expect(kill.detail).toMatchObject({ causes: ['WOLF_KILL'], roleId: 'normal_villager' });
    // A ballot death names nobody as the killer; the ballots say who voted.
    expect(all.find((e) => e.kind === 'KILL' && e.stage === 'DAY')!.actors).toEqual([]);
    expect(all.filter((e) => e.kind === 'BALLOT')).toHaveLength(1);
    expect(all.filter((e) => e.kind === 'ROLE_DEALT')).toHaveLength(3);
    expect(all.find((e) => e.kind === 'SAVE')!.actors[0]?.playerId).toBe(ben.playerId);
    expect(log.rounds[0]!.summary).toEqual({ deaths: 2, saves: 1 });
  });

  it('keeps only primitive result fields', () => {
    seq = 0;
    const log = gameLogSchema.parse(
      composeLog(base([ev('GAME_STARTED', {}), ev('RESULT_PUBLISHED', { roundNumber: 1, publisherPlayerId: ana.playerId, targetPlayerIds: [ben.playerId], result: { faction: 'VILLAGE', nested: { secret: 1 } } })])),
    );
    expect(log.rounds[0]!.day[0]!.detail.result).toEqual({ faction: 'VILLAGE' });
  });
});
