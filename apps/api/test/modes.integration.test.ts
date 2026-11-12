import { writeFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import type { FinishedResults, GameResults, RosterEntry } from '@warewolf/contracts';
import {
  GameDriver,
  Http,
  idle,
  listen,
  play,
  randomLegal,
  secretKeys,
  tieTwice,
  villageWin,
  voteOutRole,
  wolfWin,
  type GameMode,
  type PlayLog,
  type PlayOptions,
  type Policy,
} from '@warewolf/e2e-tools';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * E2E-02. Every role pack, played from create to results through the public
 * HTTP API only, with the black-box driver in tools/e2e.
 *
 * By default this boots the app on a throwaway database. With E2E_API_URL set
 * (`pnpm e2e:api`), it plays against that running server instead. With
 * E2E_REPORT set, it writes a JSON row per scenario for docs/werewolf/e2e-report.md.
 */

const LIVE = process.env['E2E_API_URL'];
const REPORT = process.env['E2E_REPORT'];

let db: TestDatabase | undefined;
let app: INestApplication | undefined;
let http: Http;

interface Row {
  pack: string;
  scenario: string;
  winner: string | null;
  rounds: number | null;
  phases: number;
  requests: number;
  notes: string;
}
const rows: Row[] = [];

beforeAll(async () => {
  if (LIVE) {
    http = new Http(LIVE.replace(/\/$/, ''));
    return;
  }
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  http = new Http(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`);
}, 60_000);

afterAll(async () => {
  if (REPORT) writeFileSync(REPORT, JSON.stringify(rows, null, 2));
  await app?.close();
  await db?.drop();
});

const MODE_BY_PACK: Readonly<Record<string, GameMode>> = {
  'infection-core': 'INFECTION',
  'classic-10': 'CLASSIC',
  'expanded-infection-20': 'EXPANDED',
  'investigation-15': 'EXPANDED',
  'protection-15': 'EXPANDED',
  'chaos-15': 'EXPANDED',
  'expanded-24': 'EXPANDED',
  'expanded-30': 'EXPANDED',
  'ultimate-20': 'ULTIMATE_20',
};

/** A full lobby for the pack, started and sitting in ROLE_REVEAL. */
async function startedGame(packId: string): Promise<GameDriver> {
  const game = await GameDriver.create(http, { mode: MODE_BY_PACK[packId]! });
  // The default pack for the mode is already saved; others are applied.
  const saved = await game.configuration();
  if (saved.draft.rolePackId !== packId) await game.applyPack(packId);
  await game.fill();
  await game.start();
  return game;
}

async function run(game: GameDriver, options: PlayOptions): Promise<PlayLog> {
  const before = http.serverErrors.length;
  const log = await play(game, options);
  expect(http.serverErrors.slice(before), 'no 5xx').toEqual([]);
  expect(log.violations, 'invariants').toEqual([]);
  return log;
}

/** Plays to the end and returns the finished results. */
async function finish(packId: string, scenario: string, game: GameDriver, policy: Policy, extra: Partial<PlayOptions> = {}): Promise<{ log: PlayLog; results: FinishedResults }> {
  const startRequests = http.requestCount;
  const log = await run(game, { policy, ...extra });
  expect(log.final?.status, `${packId} ${scenario} ended`).toBe('FINISHED');
  const results = await game.results();
  if (results.status !== 'FINISHED') throw new Error(`expected FINISHED, got ${results.status}`);
  // Every seat reads the same results.
  const other = game.seats.at(-1)!;
  expect((await game.results(other)).status).toBe('FINISHED');
  rows.push({
    pack: packId,
    scenario,
    winner: results.draw ? 'DRAW' : results.winningTeam,
    rounds: results.roundNumber,
    phases: log.phases.length,
    requests: http.requestCount - startRequests,
    notes: [
      results.infections.length ? `${results.infections.length} infection(s)` : '',
      results.seats.filter((s) => s.individualWin).length ? `individual: ${results.seats.filter((s) => s.individualWin).map((s) => s.finalRoleId).join(', ')}` : '',
      log.rejections.length ? `${log.rejections.length} refused submissions` : '',
    ]
      .filter(Boolean)
      .join('; '),
  });
  return { log, results };
}

const seatWith = (results: FinishedResults, roleId: string) => results.seats.find((s) => s.originalRoleId === roleId);
const byRole = (roster: readonly RosterEntry[], roleId: string) => roster.filter((p) => p.currentRoleId === roleId);

describe('E2E-02: every pack plays to a result', () => {
  describe('infection-core', () => {
    it('village win: the Alpha is voted out on day 1', async () => {
      const { results, log } = await finish('infection-core', 'village win', await startedGame('infection-core'), villageWin);
      expect(results.winningTeam).toBe('VILLAGE');
      expect(log.rejections).toEqual([]);
      // Host confirm and the Doctor reaction both open in this mode.
      expect(log.phases.map((p) => p.phase)).toEqual(expect.arrayContaining(['NIGHT_HOST_CONFIRM', 'NIGHT_REACTION', 'DAY_ANNOUNCE', 'VOTING']));
    });

    it('wolf win with at least one infection', async () => {
      const { results, log } = await finish('infection-core', 'wolf win', await startedGame('infection-core'), wolfWin);
      expect(results.winningTeam).toBe('WOLF_PACK');
      expect(results.infections.length).toBeGreaterThanOrEqual(1);
      expect(log.rejections).toEqual([]);
    });

    it('the host picks the kill, the informed Doctor sees it and saves', async () => {
      const game = await startedGame('infection-core');
      const doctorPolicy: Policy = {
        name: 'doctor-save',
        act(ctx, actor, ability) {
          const victim = ctx.others().find((p) => p.currentRoleId === 'normal_villager')!;
          ctx.memo.set('victim', victim.playerId);
          if (ability.capability === 'KILL') return { targetPlayerIds: [victim.playerId] };
          if (actor.currentRoleId === 'doctor' && ability.capability === 'HEAL') {
            ctx.memo.set('doctorSaw', ability.finalWolfTarget);
            return { targetPlayerIds: [] };
          }
          return null;
        },
        hostKill: (_ctx, view) => ({ targetPlayerId: view.candidates[0]!.playerId }),
        vote: () => null,
      };
      let memo: Map<string, unknown> | undefined;
      const log = await run(game, {
        policy: doctorPolicy,
        onPhase: async (ctx) => {
          memo = ctx.memo;
        },
        stopWhen: (s) => s.phase === 'DAY_ANNOUNCE',
      });
      expect(log.rejections).toEqual([]);
      expect(memo!.get('doctorSaw')).toBe(memo!.get('victim'));
      const state = await game.state();
      expect(state.players.every((p) => p.lifeStatus === 'ALIVE')).toBe(true);
      rows.push({ pack: 'infection-core', scenario: 'host kill + Doctor save', winner: null, rounds: 1, phases: log.phases.length, requests: 0, notes: 'victim alive at dawn' });
      await game.cancel();
    });

    it('a tie, then a tied revote, eliminates nobody', async () => {
      const game = await startedGame('infection-core');
      const log = await run(game, { policy: tieTwice, stopWhen: (s) => s.roundNumber === 2 });
      expect(log.rejections).toEqual([]);
      expect(log.phases.map((p) => p.phase)).toContain('REVOTE');
      const state = await game.state();
      expect(state).toMatchObject({ phase: 'NIGHT_SUBMIT', roundNumber: 2 });
      expect(state.players.filter((p) => p.lifeStatus === 'DEAD')).toEqual([]);
      const tallies = await game.tallies();
      expect(tallies.map((t) => [t.ballot, t.tiedPlayerIds.length, t.votedOutPlayerId])).toEqual([
        [1, 2, null],
        [2, 2, null],
      ]);
      rows.push({ pack: 'infection-core', scenario: 'tie then revote tie', winner: null, rounds: 1, phases: log.phases.length, requests: 0, notes: 'nobody eliminated' });
      await game.cancel();
    });

    it('a Seeker publishes a stored result in day discussion, and the room sees it', async () => {
      const game = await startedGame('infection-core');
      const [first, second] = byRole((await game.roster()).players, 'seeker');
      // Only the first Seeker investigates, so only the first has something to publish.
      const publish: Policy = {
        name: 'seeker-publish',
        act(ctx, actor, ability) {
          if (ability.capability === 'INVESTIGATE' && actor.playerId === first!.playerId) return { targetPlayerIds: [ctx.wolves()[0]!.playerId] };
          if (ability.capability === 'ROLE_REVEAL') return { targetPlayerIds: [] };
          return null;
        },
        hostKill: () => ({ noKill: true }),
        vote: () => null,
      };
      const log = await run(game, { policy: publish, stopWhen: (s) => s.phase === 'VOTING' });
      expect(log.rejections).toEqual([
        expect.objectContaining({ phase: 'DAY_DISCUSSION', player: game.seat(second!.playerId).displayName, status: 422, code: 'ACTION_TARGET_ILLEGAL' }),
      ]);
      const villager = game.seats.find((s) => !s.isHost && s.playerId !== first!.playerId)!;
      const published = (await game.events(villager)).filter((e) => e.audience === 'PUBLIC' && e.type === 'RESULT_PUBLISHED');
      rows.push({ pack: 'infection-core', scenario: 'Seeker publishes', winner: null, rounds: 1, phases: log.phases.length, requests: 0, notes: published.length ? 'public event seen' : 'NO public event' });
      expect(published).toHaveLength(1);
      expect(published[0]!.payload).toMatchObject({
        roundNumber: 1,
        investigatedRound: 1,
        publisherPlayerId: first!.playerId,
        kind: 'ALIGNMENT_WOLF_OR_NOT',
        result: { value: 'WOLF' },
      });
      // The private record is not repeated: nothing is left to publish on day 2 without a new result.
      await game.cancel();
    });

    it('host cancel: results list seats and hide every role', async () => {
      const game = await startedGame('infection-core');
      await run(game, { policy: idle, stopWhen: (s) => s.phase === 'DAY_DISCUSSION' });
      await game.cancel();
      const results: GameResults = await game.results(game.seats[3]!);
      expect(results.status).toBe('CANCELLED');
      expect(secretKeys(results)).toEqual([]);
      rows.push({ pack: 'infection-core', scenario: 'host cancel', winner: null, rounds: null, phases: 0, requests: 0, notes: 'roles hidden' });
    });
  });

  describe('classic-10', () => {
    it('village win', async () => {
      const { results, log } = await finish('classic-10', 'village win', await startedGame('classic-10'), villageWin);
      expect(results.winningTeam).toBe('VILLAGE');
      expect(log.rejections).toEqual([]);
    });

    it('wolf win', async () => {
      const { results, log } = await finish('classic-10', 'wolf win', await startedGame('classic-10'), wolfWin);
      expect(results.winningTeam).toBe('WOLF_PACK');
      expect(log.rejections).toEqual([]);
    });

    it('a tie, then a tied revote, eliminates nobody', async () => {
      const game = await startedGame('classic-10');
      const log = await run(game, { policy: tieTwice, stopWhen: (s) => s.roundNumber === 2 });
      expect(log.phases.map((p) => p.phase)).toContain('REVOTE');
      expect((await game.state()).players.filter((p) => p.lifeStatus === 'DEAD')).toEqual([]);
      await game.cancel();
    });

    it('a timed night closes by itself', async () => {
      const game = await GameDriver.create(http, { mode: 'CLASSIC' });
      const { draft } = await game.configuration();
      await game.saveConfiguration({ ...draft, timers: { nightSeconds: 1, daySeconds: 60, voteSeconds: 60 } });
      await game.fill();
      await game.start();
      await game.close(); // ROLE_REVEAL waits for the host
      expect((await game.state()).phase).toBe('NIGHT_SUBMIT');
      const deadline = Date.now() + 8_000;
      let phase = 'NIGHT_SUBMIT';
      while (phase === 'NIGHT_SUBMIT' && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 250));
        phase = (await game.state()).phase;
      }
      expect(phase).toBe('DAY_ANNOUNCE');
      rows.push({ pack: 'classic-10', scenario: 'timed night auto-advance', winner: null, rounds: 1, phases: 0, requests: 0, notes: '1 s night' });
      await game.cancel();
    });
  });

  describe('expanded-infection-20', () => {
    it('the Jester is voted out, the game goes on, and the Jester wins individually', async () => {
      const game = await startedGame('expanded-infection-20');
      const { results } = await finish('expanded-infection-20', 'Jester voted out, then village win', game, voteOutRole('jester', villageWin));
      expect(results.winningTeam).toBe('VILLAGE');
      expect(results.roundNumber).toBeGreaterThan(1);
      expect(seatWith(results, 'jester')).toMatchObject({ individualWin: true, won: true, lifeStatus: 'DEAD' });
    });

    it('random legal play finishes', async () => {
      await finish('expanded-infection-20', 'random legal (seed 11)', await startedGame('expanded-infection-20'), randomLegal(), { seed: 11 });
    });
  });

  describe('investigation-15', () => {
    it('each information result reaches only its owner, live and on reload', async () => {
      const game = await startedGame('investigation-15');
      const roster = (await game.roster()).players;
      const listeners = await Promise.all(game.seats.map((seat) => listen(http.baseUrl, seat)));
      try {
        const infoPolicy: Policy = {
          name: 'investigate-first-wolf',
          act(ctx, actor, ability) {
            const wolf = ctx.wolves()[0]!;
            const other = ctx.others().find((p) => p.playerId !== actor.playerId)!;
            if (ability.target.kind === 'QUESTION') return { targetPlayerIds: [], payload: { question: ability.target.questions[0]! } };
            if (ability.target.kind !== 'PLAYERS' || actor.wolfAligned) return null;
            // The Medium reads the dead; nobody has died on night 1.
            if (ability.target.life === 'DEAD') return null;
            if (ability.target.count === 2) return { targetPlayerIds: [wolf.playerId, other.playerId] };
            return { targetPlayerIds: [wolf.playerId === actor.playerId ? other.playerId : wolf.playerId] };
          },
          hostKill: () => ({ noKill: true }),
          vote: () => null,
        };
        const log = await run(game, { policy: infoPolicy, stopWhen: (s) => s.phase === 'DAY_DISCUSSION' });
        expect(log.rejections).toEqual([]);
        await new Promise((r) => setTimeout(r, 300));

        const investigators = new Set(['seeker', 'detective', 'oracle', 'psychic', 'seer', 'tracker', 'prophet']);
        for (const listener of listeners) {
          const role = roster.find((p) => p.playerId === listener.seat.playerId)!.currentRoleId;
          const stored = (await game.events(listener.seat)).filter((e) => e.audience === 'PLAYER');
          const live = listener.events.filter((e) => e.audience === 'PLAYER');
          if (investigators.has(role)) expect(stored.length, `${role} got a result`).toBeGreaterThan(0);
          else if (!listener.seat.isHost) expect(stored, `${role} got nothing private`).toEqual([]);
          expect(live.map((e) => e.seq).sort(), `${role}: live matches stored`).toEqual(stored.map((e) => e.seq).sort());
        }
      } finally {
        for (const l of listeners) l.close();
      }
      const { results } = await finish('investigation-15', 'results privately delivered, then village win', game, villageWin);
      expect(results.winningTeam).toBe('VILLAGE');
    });
  });

  describe('protection-15', () => {
    it('a Guard-protected target survives the pack kill', async () => {
      const game = await startedGame('protection-15');
      const roster = (await game.roster()).players;
      const victim = byRole(roster, 'normal_villager')[0]!;
      const protect: Policy = {
        name: 'guard-protects-victim',
        act(_ctx, actor, ability) {
          if (ability.capability === 'KILL' && actor.wolfAligned) return { targetPlayerIds: [victim.playerId] };
          if (actor.currentRoleId === 'guard' && ability.capability === 'PROTECT') return { targetPlayerIds: [victim.playerId] };
          return null;
        },
        hostKill: () => ({ noKill: true }),
        vote: () => null,
      };
      const log = await run(game, { policy: protect, stopWhen: (s) => s.phase === 'DAY_ANNOUNCE' });
      expect(log.rejections).toEqual([]);
      expect((await game.state()).players.find((p) => p.playerId === victim.playerId)?.lifeStatus).toBe('ALIVE');
      const { results } = await finish('protection-15', 'Guard save, then village win', game, villageWin);
      expect(results.winningTeam).toBe('VILLAGE');
    });

    it('wolf win', async () => {
      await finish('protection-15', 'wolf win', await startedGame('protection-15'), wolfWin);
    });
  });

  describe('chaos-15', () => {
    it('village win, and a surviving Neutral without its own win condition wins by surviving', async () => {
      const { results } = await finish('chaos-15', 'village win', await startedGame('chaos-15'), villageWin);
      expect(results.winningTeam).toBe('VILLAGE');
      expect(seatWith(results, 'lone_wolf')).toMatchObject({ lifeStatus: 'DEAD', won: false });
      expect(seatWith(results, 'shapeshifter')).toMatchObject({ lifeStatus: 'ALIVE', individualWin: true });
    });

    it('random legal play finishes', async () => {
      await finish('chaos-15', 'random legal (seed 3)', await startedGame('chaos-15'), randomLegal(), { seed: 3 });
    });
  });

  describe.each(['expanded-24', 'expanded-30'])('%s', (packId) => {
    it.each([1, 2, 3])('random legal play finishes (seed %i)', async (seed) => {
      await finish(packId, `random legal (seed ${seed})`, await startedGame(packId), randomLegal(), { seed });
    });

    it('village win', async () => {
      const { results } = await finish(packId, 'village win', await startedGame(packId), villageWin);
      expect(results.winningTeam).toBe('VILLAGE');
    });
  });

  describe('ultimate-20', () => {
    it('village win', async () => {
      const { results, log } = await finish('ultimate-20', 'village win', await startedGame('ultimate-20'), villageWin);
      expect(results.winningTeam).toBe('VILLAGE');
      expect(log.rejections).toEqual([]);
    });

    it('wolf win', async () => {
      const { results } = await finish('ultimate-20', 'wolf win', await startedGame('ultimate-20'), wolfWin);
      expect(results.winningTeam).toBe('WOLF_PACK');
    });

    it.each([1, 2, 3])('random legal play finishes (seed %i)', async (seed) => {
      await finish('ultimate-20', `random legal (seed ${seed})`, await startedGame('ultimate-20'), randomLegal(), { seed });
    });

    it('the Vampire marks a player, who joins the Vampire team at dawn after night 2', async () => {
      const game = await startedGame('ultimate-20');
      const roster = (await game.roster()).players;
      const marked = byRole(roster, 'normal_villager')[0]!;
      const mark: Policy = {
        name: 'vampire-marks',
        act: (ctx, actor, ability) =>
          actor.currentRoleId === 'vampire' && ability.capability === 'CONVERT' && ctx.state.roundNumber === 1 ? { targetPlayerIds: [marked.playerId] } : null,
        hostKill: () => ({ noKill: true }),
        vote: () => null,
      };
      const log = await run(game, { policy: mark, stopWhen: (s) => s.roundNumber === 2 && s.phase === 'DAY_ANNOUNCE' });
      expect(log.rejections).toEqual([]);
      // The Servant learns of the promotion through ROLE_CONVERTED; the rest of the team through VAMPIRE_TEAM_JOIN.
      const vampire = byRole(roster, 'vampire')[0]!;
      const promoted = (await game.events(game.seat(marked.playerId))).filter((e) => e.type === 'ROLE_CONVERTED');
      const told = (await game.events(game.seat(vampire.playerId))).filter((e) => e.type === 'VAMPIRE_TEAM_JOIN');
      rows.push({ pack: 'ultimate-20', scenario: 'Vampire mark and promotion', winner: null, rounds: 2, phases: log.phases.length, requests: 0, notes: `servant told: ${promoted.length > 0}; vampire told: ${told.length > 0}` });
      expect(promoted).toHaveLength(1);
      expect(told).toHaveLength(1);
      expect((await game.roster()).players.find((p) => p.playerId === marked.playerId)?.currentRoleId).not.toBe('normal_villager');
      await game.cancel();
    });

    it('the Ghost, voted out on day 1, leaves a hint the room sees the next day', async () => {
      const game = await startedGame('ultimate-20');
      const ghostHint: Policy = {
        name: 'ghost-hint',
        act: (_ctx, actor, ability) => (actor.currentRoleId === 'ghost' && ability.capability === 'HINT' ? { targetPlayerIds: [], payload: { hint: 'Look to the quiet corner.' } } : null),
        hostKill: () => ({ noKill: true }),
        vote: (ctx, voter, ballot, candidates) => villageWin.vote(ctx, voter, ballot, candidates),
      };
      const log = await run(game, { policy: voteOutRole('ghost', ghostHint), stopWhen: (s) => s.roundNumber === 2 && s.phase === 'DAY_DISCUSSION' });
      const submittedHint = log.submitted > 0;
      const villager = game.seats.find((s) => !s.isHost)!;
      const hints = (await game.events(villager)).filter((e) => e.audience === 'PUBLIC' && e.type === 'GHOST_HINT');
      rows.push({ pack: 'ultimate-20', scenario: 'Ghost hint', winner: null, rounds: 2, phases: log.phases.length, requests: 0, notes: `${submittedHint ? 'hint submitted' : 'hint NOT submitted'}; ${hints.length ? 'public' : 'NOT delivered'}` });
      expect(submittedHint).toBe(true);
      expect(hints).toHaveLength(1);
      await game.cancel();
    });

    it('a seat the Alchemist silenced cannot post in the next day', async () => {
      const game = await startedGame('ultimate-20');
      const roster = (await game.roster()).players;
      const silenced = byRole(roster, 'normal_villager')[0]!;
      const silence: Policy = {
        name: 'alchemist-silence',
        act: (ctx, actor, ability) => (actor.currentRoleId === 'alchemist' && ability.capability === 'SILENCE' && ctx.state.roundNumber === 1 ? { targetPlayerIds: [silenced.playerId] } : null),
        hostKill: () => ({ noKill: true }),
        vote: () => null,
      };
      const log = await run(game, { policy: silence, stopWhen: (s) => s.phase === 'DAY_DISCUSSION' });
      expect(log.rejections).toEqual([]);
      const posted = await game.chat(game.seat(silenced.playerId), 'Can anyone hear me?');
      const other = await game.chat(game.seats.find((s) => s.playerId !== silenced.playerId && !s.isHost)!, 'Good morning.');
      rows.push({ pack: 'ultimate-20', scenario: 'Alchemist silence', winner: null, rounds: 1, phases: log.phases.length, requests: 0, notes: `silenced seat post -> ${posted.status}` });
      expect(other.status).toBe(201);
      // A silence refuses like a host mute: 403 CHAT_MUTED, and the seat's own chat view says it cannot post.
      expect(posted.status).toBe(403);
      expect((posted.body as { error: { code: string } }).error.code).toBe('CHAT_MUTED');
      const view = await http.ok<{ you: { canPost: boolean } }>('GET', `/games/${game.gameId}/chat`, { token: game.seat(silenced.playerId).token });
      expect(view.you.canPost).toBe(false);
      expect((await game.events(game.seat(silenced.playerId))).map((e) => e.type)).toContain('SILENCED');
      await game.cancel();
    });
  });

  describe('custom', () => {
    it('an invalid setup refuses to start and stays in the lobby', async () => {
      const game = await GameDriver.create(http, { mode: 'CUSTOM' });
      const { draft } = await game.configuration();
      await game.saveConfiguration({ ...draft, roles: [{ roleId: 'normal_villager', count: draft.playerCount }] });
      await game.fill();
      const res = await game.startRaw();
      expect(res.status).toBe(422);
      expect((await game.lobby()).status).toBe('LOBBY');
      rows.push({ pack: 'custom', scenario: 'invalid setup', winner: null, rounds: null, phases: 0, requests: 0, notes: `start -> ${res.status}` });
      await game.cancel();
    });

    it('a custom setup with a Sniper plays to the end', async () => {
      const game = await GameDriver.create(http, { mode: 'CUSTOM' });
      const { draft } = await game.configuration();
      const classic = await game.packConfig('classic-10');
      const saved = await game.saveConfiguration({
        ...classic,
        mode: 'CUSTOM',
        rolePackId: draft.rolePackId,
        pacing: 'HOST',
        timers: null,
        roles: [
          { roleId: 'pack_wolf', count: 2 },
          { roleId: 'seeker', count: 1 },
          { roleId: 'sniper', count: 1 },
          { roleId: 'normal_villager', count: 6 },
        ],
      });
      expect(saved.validation.errors).toEqual([]);
      await game.fill();
      await game.start();
      await finish('custom', 'Sniper setup, random legal (seed 5)', game, randomLegal(), { seed: 5 });
    });
  });
});
