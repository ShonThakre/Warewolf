import { GAME_MODES, GAME_PHASES, GAME_STATUSES, type GameMode, type GamePhase, type GameStatus } from '@warewolf/domain';
import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** `'A', 'B', 'C'` for a CHECK constraint. Values come from domain constants, not user input. */
const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Aggregate root. See docs/werewolf/data-model.md, "games".
 *
 * `host_player_id` gets its foreign key to `game_players` in WW-301, when
 * that table exists.
 */
export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomCode: text('room_code').notNull(),
    status: text('status').$type<GameStatus>().notNull().default('LOBBY'),
    phase: text('phase').$type<GamePhase>().notNull().default('LOBBY'),
    /** 0 in the lobby. 1 once the game starts. */
    roundNumber: integer('round_number').notNull().default(0),
    stateVersion: integer('state_version').notNull().default(0),
    hostPlayerId: uuid('host_player_id').notNull(),
    mode: text('mode').$type<GameMode>().notNull(),
    /** Frozen at start. Null in the lobby. */
    configSnapshot: jsonb('config_snapshot'),
    /** Editable only in the lobby. */
    configDraft: jsonb('config_draft').notNull().default(sql`'{}'::jsonb`),
    /** Set with the snapshot at start. */
    catalogHash: text('catalog_hash'),
    phaseStartedAt: timestamptz('phase_started_at').notNull().defaultNow(),
    /** Null when host-paced. */
    phaseEndsAt: timestamptz('phase_ends_at'),
    winnerSummary: jsonb('winner_summary'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [
    uniqueIndex('games_room_code_open_uq')
      .on(sql.raw('room_code'))
      .where(sql.raw(`status in ('LOBBY', 'ACTIVE')`)),
    index('games_status_phase_idx').on(sql.raw('status'), sql.raw('phase')),
    check('games_room_code_length_ck', sql.raw('char_length(room_code) = 6')),
    check('games_status_ck', sql`status in (${inList(GAME_STATUSES)})`),
    check('games_phase_ck', sql`phase in (${inList(GAME_PHASES)})`),
    check('games_mode_ck', sql`mode in (${inList(GAME_MODES)})`),
    check('games_round_number_ck', sql.raw('round_number >= 0')),
    check('games_state_version_ck', sql.raw('state_version >= 0')),
  ],
);

export type GameRow = typeof games.$inferSelect;
export type NewGameRow = typeof games.$inferInsert;
