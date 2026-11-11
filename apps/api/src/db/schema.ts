import {
  ABILITY_SOURCES,
  ACTION_REJECTIONS,
  ACTION_WINDOWS,
  ATTACK_TYPES,
  ABILITY_STATUSES,
  CAPABILITIES,
  CONNECTION_STATUSES,
  CONVERSION_REASONS,
  EFFECT_STATUSES,
  FACTIONS,
  GAME_MODES,
  GAME_PHASES,
  GAME_STATUSES,
  HANDLER_KEYS,
  INDIVIDUAL_VICTORY_STATES,
  INFECTION_FAILURES,
  LIFE_STATUSES,
  NIGHT_ACTION_STATUSES,
  NIGHT_EFFECT_KINDS,
  RESOLUTION_KINDS,
  RESULT_KINDS,
  type AbilityDefinition,
  type ActionRejection,
  type AttackType,
  type ConversionReason,
  type DeathCause,
  type EffectStatus,
  type InfectionFailure,
  type NightEffectKind,
  type ResolutionKind,
  type ResultKind,
  type AbilitySource,
  type AbilityStatus,
  type Capability,
  type ConnectionStatus,
  type Faction,
  type GameMode,
  type GamePhase,
  type GameStatus,
  type HandlerKey,
  type IndividualVictoryState,
  type ActionWindow,
  type LifeStatus,
  type NightActionStatus,
} from '@warewolf/domain';
import { AVATAR_COUNT } from '@warewolf/contracts';
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** `'A', 'B', 'C'` for a CHECK constraint. Values come from domain constants, not user input. */
const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Aggregate root. See docs/werewolf/data-model.md, "games".
 *
 * `host_player_id` references `game_players`. The constraint is written by
 * hand in drizzle/0001_lobby.sql because it must be DEFERRABLE INITIALLY
 * DEFERRED: a game and its host seat are inserted in one transaction, and
 * each row points at the other. Drizzle's schema language cannot express a
 * deferrable key, so it is not declared here.
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
    /** Set when status becomes CANCELLED. */
    cancelReason: text('cancel_reason').$type<'HOST' | 'SURRENDER'>(),
    /** Successful Alpha infections so far (C-04). Written by night resolution (WW-802). */
    infectionSuccesses: integer('infection_successes').notNull().default(0),
    /** True once the Alpha has died: no further infection (C-09). */
    infectionSealed: boolean('infection_sealed').notNull().default(false),
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
    // Boot recovery and the phase timer look up active games by deadline (WW-502).
    index('games_phase_deadline_idx')
      .on(sql.raw('phase_ends_at'))
      .where(sql.raw(`status = 'ACTIVE' and phase_ends_at is not null`)),
    check('games_room_code_length_ck', sql.raw('char_length(room_code) = 6')),
    check('games_status_ck', sql`status in (${inList(GAME_STATUSES)})`),
    check('games_phase_ck', sql`phase in (${inList(GAME_PHASES)})`),
    check('games_mode_ck', sql`mode in (${inList(GAME_MODES)})`),
    check('games_round_number_ck', sql.raw('round_number >= 0')),
    check('games_state_version_ck', sql.raw('state_version >= 0')),
    check('games_cancel_reason_ck', sql.raw(`cancel_reason in ('HOST', 'SURRENDER')`)),
    // WW-501: status and phase never disagree. The three end phases match their status; every other phase is ACTIVE.
    check(
      'games_phase_status_ck',
      sql.raw(
        `(status = 'LOBBY' and phase = 'LOBBY') or (status = 'FINISHED' and phase = 'FINISHED') or (status = 'CANCELLED' and phase = 'CANCELLED') or (status = 'ACTIVE' and phase not in ('LOBBY', 'FINISHED', 'CANCELLED'))`,
      ),
    ),
    // Round 0 is the lobby. A started game is in round 1 or later.
    check('games_round_status_ck', sql.raw(`(status = 'LOBBY' and round_number = 0) or (status = 'ACTIVE' and round_number >= 1) or status in ('FINISHED', 'CANCELLED')`)),
    // Only a running game has a deadline.
    check('games_deadline_ck', sql.raw(`phase_ends_at is null or status = 'ACTIVE'`)),
    check('games_infection_successes_ck', sql.raw('infection_successes >= 0')),
  ],
);

export type GameRow = typeof games.$inferSelect;
export type NewGameRow = typeof games.$inferInsert;

/**
 * One seat in one game. See docs/werewolf/data-model.md, "game_players".
 * Lobby seats are deleted when a player leaves or is kicked before start
 * (OD-65). After start a seat is never deleted or reassigned.
 */
export const gamePlayers = pgTable(
  'game_players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    seatNumber: integer('seat_number').notNull(),
    /** 1 to 36, unique within a game. The art file is art/avatars/avatar_NN.png. */
    avatarId: integer('avatar_id').notNull(),
    isHost: boolean('is_host').notNull().default(false),
    lifeStatus: text('life_status').$type<LifeStatus>().notNull().default('ALIVE'),
    connectionStatus: text('connection_status').$type<ConnectionStatus>().notNull().default('DISCONNECTED'),
    /** SHA-256 of the bearer token. The raw token is returned once and never stored. */
    tokenHash: text('token_hash').notNull(),
    diedRound: integer('died_round'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('game_players_token_hash_uq').on(t.tokenHash),
    // OD-66: names are unique per game, ignoring case.
    uniqueIndex('game_players_name_uq').on(t.gameId, sql.raw('lower(display_name)')),
    uniqueIndex('game_players_seat_uq').on(t.gameId, t.seatNumber),
    uniqueIndex('game_players_one_host_uq').on(t.gameId).where(sql.raw('is_host')),
    uniqueIndex('game_players_avatar_uq').on(t.gameId, t.avatarId),
    check('game_players_seat_ck', sql.raw('seat_number >= 1')),
    check('game_players_avatar_ck', sql.raw(`avatar_id between 1 and ${AVATAR_COUNT}`)),
    check('game_players_life_ck', sql`life_status in (${inList(LIFE_STATUSES)})`),
    check('game_players_connection_ck', sql`connection_status in (${inList(CONNECTION_STATUSES)})`),
    check('game_players_name_length_ck', sql.raw('char_length(display_name) between 2 and 24')),
  ],
);

export type GamePlayerRow = typeof gamePlayers.$inferSelect;
export type NewGamePlayerRow = typeof gamePlayers.$inferInsert;

/**
 * One dealt role per player, written in the start transaction (WW-402). See
 * docs/werewolf/data-model.md, "role_assignments".
 *
 * The `original_*` columns record what was dealt and never change. Two things
 * enforce that: the repository (src/assignment/assignment.repository.ts) has
 * no update that names them, and a trigger written by hand in
 * drizzle/0003_assignments.sql rejects any UPDATE that would change them.
 * Conversions such as infection change only the `current_*` columns.
 */
export const roleAssignments = pgTable(
  'role_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    originalRoleId: text('original_role_id').notNull(),
    /** The dealt ability profile, such as `doctor_infection`. Single-profile roles use the role id. */
    originalProfileId: text('original_profile_id').notNull(),
    originalFaction: text('original_faction').$type<Faction>().notNull(),
    currentRoleId: text('current_role_id').notNull(),
    currentProfileId: text('current_profile_id').notNull(),
    currentFaction: text('current_faction').$type<Faction>().notNull(),
    wolfAligned: boolean('wolf_aligned').notNull(),
    individualVictory: text('individual_victory').$type<IndividualVictoryState>().notNull().default('NONE'),
    publicReveal: boolean('public_reveal').notNull().default(false),
    /** Assassin mark. */
    markTargetPlayerId: uuid('mark_target_player_id').references(() => gamePlayers.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('role_assignments_player_uq').on(t.playerId),
    index('role_assignments_game_idx').on(t.gameId),
    check('role_assignments_original_faction_ck', sql`original_faction in (${inList(FACTIONS)})`),
    check('role_assignments_current_faction_ck', sql`current_faction in (${inList(FACTIONS)})`),
    check('role_assignments_individual_victory_ck', sql`individual_victory in (${inList(INDIVIDUAL_VICTORY_STATES)})`),
  ],
);

export type RoleAssignmentRow = typeof roleAssignments.$inferSelect;
export type NewRoleAssignmentRow = typeof roleAssignments.$inferInsert;

/**
 * One usable ability on one assignment. See docs/werewolf/data-model.md,
 * "ability_instances". Dealt abilities are `NATIVE`; copies and inherited
 * abilities arrive in later phases.
 */
export const abilityInstances = pgTable(
  'ability_instances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => roleAssignments.id, { onDelete: 'cascade' }),
    abilityId: text('ability_id').notNull(),
    /** Null when the handler carries the whole mechanic, such as the Assassin's mark. */
    capability: text('capability').$type<Capability>(),
    handlerKey: text('handler_key').$type<HandlerKey>(),
    status: text('status').$type<AbilityStatus>().notNull().default('ACTIVE'),
    /** Null is unlimited. */
    chargesRemaining: integer('charges_remaining'),
    usesConsumed: integer('uses_consumed').notNull().default(0),
    lastUsedRound: integer('last_used_round'),
    /** Guard's no-repeat rule reads this. */
    lastTargetPlayerId: uuid('last_target_player_id').references(() => gamePlayers.id),
    availableFromRound: integer('available_from_round').notNull(),
    /** Shapeshifter copies expire. Null for dealt abilities. */
    expiresRound: integer('expires_round'),
    source: text('source').$type<AbilitySource>().notNull().default('NATIVE'),
    sourcePlayerId: uuid('source_player_id').references(() => gamePlayers.id),
    /** The ability definition with this game's overrides, frozen at grant time. */
    config: jsonb('config').$type<AbilityDefinition>().notNull(),
    revokedReason: text('revoked_reason'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ability_instances_native_uq').on(t.assignmentId, t.abilityId).where(sql.raw(`source = 'NATIVE'`)),
    index('ability_instances_game_player_idx').on(t.gameId, t.playerId),
    check('ability_instances_capability_ck', sql`capability in (${inList(CAPABILITIES)})`),
    check('ability_instances_handler_key_ck', sql`handler_key in (${inList(HANDLER_KEYS)})`),
    check('ability_instances_status_ck', sql`status in (${inList(ABILITY_STATUSES)})`),
    check('ability_instances_source_ck', sql`source in (${inList(ABILITY_SOURCES)})`),
    check('ability_instances_charges_ck', sql.raw('charges_remaining >= 0')),
    check('ability_instances_uses_ck', sql.raw('uses_consumed >= 0')),
    check('ability_instances_available_ck', sql.raw('available_from_round >= 1')),
  ],
);

export type AbilityInstanceRow = typeof abilityInstances.$inferSelect;
export type NewAbilityInstanceRow = typeof abilityInstances.$inferInsert;

/**
 * One submitted ability use (WW-601). See docs/werewolf/data-model.md,
 * "night_actions". Day abilities use the same table; `phase` says which
 * window the action belongs to.
 *
 * A pending action is replaced by cancelling it and inserting the new one,
 * so every choice stays on record. Closing the window moves PENDING to
 * LOCKED; resolution moves LOCKED to RESOLVED or REJECTED. At most one
 * pending or locked action exists per ability per round.
 */
export const nightActions = pgTable(
  'night_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    phase: text('phase').$type<ActionWindow>().notNull(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    abilityInstanceId: uuid('ability_instance_id')
      .notNull()
      .references(() => abilityInstances.id, { onDelete: 'cascade' }),
    targetPlayerIds: uuid('target_player_ids').array().notNull().default(sql`'{}'::uuid[]`),
    payload: jsonb('payload').$type<Record<string, string | number | boolean>>().notNull().default(sql`'{}'::jsonb`),
    status: text('status').$type<NightActionStatus>().notNull().default('PENDING'),
    /** Set with status REJECTED by resolution (WW-802). */
    rejectedReason: text('rejected_reason').$type<ActionRejection>(),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('night_actions_open_uq')
      .on(t.gameId, t.roundNumber, t.abilityInstanceId)
      .where(sql.raw(`status in ('PENDING', 'LOCKED')`)),
    index('night_actions_game_round_idx').on(t.gameId, t.roundNumber, t.status),
    check('night_actions_status_ck', sql`status in (${inList(NIGHT_ACTION_STATUSES)})`),
    check('night_actions_phase_ck', sql`phase in (${inList(ACTION_WINDOWS)})`),
    check('night_actions_round_ck', sql.raw('round_number >= 1')),
    check('night_actions_rejected_reason_ck', sql`rejected_reason in (${inList(ACTION_REJECTIONS)})`),
    check('night_actions_rejected_status_ck', sql.raw(`rejected_reason is null or status = 'REJECTED'`)),
  ],
);

export type NightActionRow = typeof nightActions.$inferSelect;
export type NewNightActionRow = typeof nightActions.$inferInsert;

/**
 * Stored responses for `Idempotency-Key` (WW-601). See
 * docs/werewolf/data-model.md, "idempotency_keys". Keys are scoped to the
 * seat as well as the game, so one player can never replay, or block,
 * another player's request by reusing their key.
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    /** SHA-256 of the route and body. The same key with a different hash is a 409. */
    requestHash: text('request_hash').notNull(),
    response: jsonb('response').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'idempotency_keys_pk', columns: [t.gameId, t.playerId, t.key] })],
);

export type IdempotencyKeyRow = typeof idempotencyKeys.$inferSelect;

/**
 * One committed resolution (WW-802). See docs/werewolf/data-model.md,
 * "resolution_runs". The unique key is what makes a second resolve of the
 * same night fail: a retry rolls back instead of committing twice.
 */
export const resolutionRuns = pgTable(
  'resolution_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    phaseKind: text('phase_kind').$type<ResolutionKind>().notNull(),
    /** SHA-256 of the canonical resolver input. */
    inputHash: text('input_hash').notNull(),
    /** The resolver's whole result. Host and audit only. */
    result: jsonb('result').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('resolution_runs_round_uq').on(t.gameId, t.roundNumber, t.phaseKind),
    check('resolution_runs_phase_kind_ck', sql`phase_kind in (${inList(RESOLUTION_KINDS)})`),
    check('resolution_runs_round_ck', sql.raw('round_number >= 1')),
  ],
);

export type ResolutionRunRow = typeof resolutionRuns.$inferSelect;

/** One player's death. A player dies once, so `(game_id, player_id)` is unique. */
export const eliminationRecords = pgTable(
  'elimination_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    phaseKind: text('phase_kind').$type<ResolutionKind>().notNull(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    roleAtDeath: text('role_at_death').notNull(),
    originalRoleId: text('original_role_id').notNull(),
    factionAtDeath: text('faction_at_death').$type<Faction>().notNull(),
    /** Ordered cause objects with every contributor (OD-13). Host and audit only. */
    causes: jsonb('causes').$type<DeathCause[]>().notNull(),
    revealedPublicly: boolean('revealed_publicly').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('elimination_records_player_uq').on(t.gameId, t.playerId),
    check('elimination_records_phase_kind_ck', sql`phase_kind in (${inList(RESOLUTION_KINDS)})`),
    check('elimination_records_faction_ck', sql`faction_at_death in (${inList(FACTIONS)})`),
  ],
);

export type EliminationRecordRow = typeof eliminationRecords.$inferSelect;

/** One Alpha infection attempt and its outcome (night-resolution.md, section 6). */
export const infectionRecords = pgTable(
  'infection_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    actionId: uuid('action_id').references(() => nightActions.id, { onDelete: 'cascade' }),
    sourcePlayerId: uuid('source_player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    targetPlayerId: uuid('target_player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    previousRoleId: text('previous_role_id').notNull(),
    outcome: text('outcome').$type<'SUCCESS' | 'FAILED'>().notNull(),
    failureReason: text('failure_reason').$type<InfectionFailure>(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('infection_records_game_idx').on(t.gameId, t.roundNumber),
    check('infection_records_outcome_ck', sql.raw(`outcome in ('SUCCESS', 'FAILED')`)),
    check('infection_records_failure_reason_ck', sql`failure_reason in (${inList(INFECTION_FAILURES)})`),
    check('infection_records_reason_ck', sql.raw(`(outcome = 'SUCCESS') = (failure_reason is null)`)),
  ],
);

export type InfectionRecordRow = typeof infectionRecords.$inferSelect;

/**
 * One private fact for one investigator and the host. `result` is the fact
 * itself; publishing it (the Seeker's reveal) copies it into a public event
 * and leaves this row private.
 */
export const investigationRecords = pgTable(
  'investigation_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    actionId: uuid('action_id')
      .notNull()
      .references(() => nightActions.id, { onDelete: 'cascade' }),
    actorPlayerId: uuid('actor_player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    abilityInstanceId: uuid('ability_instance_id')
      .notNull()
      .references(() => abilityInstances.id, { onDelete: 'cascade' }),
    abilityId: text('ability_id').notNull(),
    kind: text('kind').$type<ResultKind>().notNull(),
    targetPlayerIds: uuid('target_player_ids').array().notNull(),
    result: jsonb('result').$type<Record<string, unknown>>().notNull(),
    published: boolean('published').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('investigation_records_action_uq').on(t.actionId),
    index('investigation_records_actor_idx').on(t.gameId, t.actorPlayerId),
    check('investigation_records_kind_ck', sql`kind in (${inList(RESULT_KINDS)})`),
  ],
);

export type InvestigationRecordRow = typeof investigationRecords.$inferSelect;

/** A change of current role. The assignment row holds the current state; this is the history. */
export const roleConversionRecords = pgTable(
  'role_conversion_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    fromRoleId: text('from_role_id').notNull(),
    toRoleId: text('to_role_id').notNull(),
    fromFaction: text('from_faction').$type<Faction>().notNull(),
    toFaction: text('to_faction').$type<Faction>().notNull(),
    reason: text('reason').$type<ConversionReason>().notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('role_conversion_records_game_idx').on(t.gameId, t.roundNumber),
    check('role_conversion_records_reason_ck', sql`reason in (${inList(CONVERSION_REASONS)})`),
    check('role_conversion_records_from_faction_ck', sql`from_faction in (${inList(FACTIONS)})`),
    check('role_conversion_records_to_faction_ck', sql`to_faction in (${inList(FACTIONS)})`),
  ],
);

export type RoleConversionRecordRow = typeof roleConversionRecords.$inferSelect;

/**
 * Something a resolution leaves for a later one (WW-801): a Blacksmith item
 * on its holder, a Poisoner's delayed poison, or an Avenger's queued revenge.
 * Open while ACTIVE; a resolution closes it as SPENT or EXPIRED.
 */
export const scheduledEffects = pgTable(
  'scheduled_effects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<NightEffectKind>().notNull(),
    sourcePlayerId: uuid('source_player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    sourceAbilityInstanceId: uuid('source_ability_instance_id')
      .notNull()
      .references(() => abilityInstances.id, { onDelete: 'cascade' }),
    targetPlayerId: uuid('target_player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    createdRound: integer('created_round').notNull(),
    /** Null for a shield, which has no due time. */
    dueRound: integer('due_round'),
    duePhase: text('due_phase').$type<ResolutionKind>(),
    attackTypes: text('attack_types').array().$type<AttackType[]>().notNull(),
    status: text('status').$type<EffectStatus>().notNull().default('ACTIVE'),
    closedRound: integer('closed_round'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('scheduled_effects_open_idx').on(t.gameId).where(sql.raw(`status = 'ACTIVE'`)),
    check('scheduled_effects_kind_ck', sql`kind in (${inList(NIGHT_EFFECT_KINDS)})`),
    check('scheduled_effects_status_ck', sql`status in (${inList(EFFECT_STATUSES)})`),
    check('scheduled_effects_due_phase_ck', sql`due_phase in (${inList(RESOLUTION_KINDS)})`),
    check('scheduled_effects_attack_types_ck', sql`attack_types <@ array[${inList(ATTACK_TYPES)}]::text[]`),
    check('scheduled_effects_due_ck', sql.raw(`(due_round is null) = (due_phase is null)`)),
    check('scheduled_effects_closed_ck', sql.raw(`(status = 'ACTIVE') = (closed_round is null)`)),
  ],
);

export type ScheduledEffectRow = typeof scheduledEffects.$inferSelect;

/**
 * The host's kill confirmation for one night (WW-803, OD-01). One row per
 * round, replaced until host confirm closes. The night resolver reads it as
 * `hostDecision`. A target is always one a pack wolf named; the service
 * checks that before writing.
 */
export const nightKillDecisions = pgTable(
  'night_kill_decisions',
  {
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    /** Null exactly when the host chose no kill. */
    targetPlayerId: uuid('target_player_id').references(() => gamePlayers.id, { onDelete: 'cascade' }),
    noKill: boolean('no_kill').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ name: 'night_kill_decisions_pk', columns: [t.gameId, t.roundNumber] }),
    check('night_kill_decisions_choice_ck', sql.raw('no_kill = (target_player_id is null)')),
    check('night_kill_decisions_round_ck', sql.raw('round_number >= 1')),
  ],
);

export type NightKillDecisionRow = typeof nightKillDecisions.$inferSelect;

/**
 * One cast ballot (WW-901). Replacing a vote marks the old row superseded
 * and inserts a new one, so the history stays. `weight` is copied at close.
 * Abstain is a null target.
 */
export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    /** 1 is the first ballot. 2 is the revote. */
    ballot: integer('ballot').notNull(),
    voterPlayerId: uuid('voter_player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    targetPlayerId: uuid('target_player_id').references(() => gamePlayers.id, { onDelete: 'cascade' }),
    weight: integer('weight').notNull().default(1),
    superseded: boolean('superseded').notNull().default(false),
    submittedAt: timestamptz('submitted_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('votes_active_uq').on(t.gameId, t.roundNumber, t.ballot, t.voterPlayerId).where(sql.raw('superseded = false')),
    index('votes_ballot_idx').on(t.gameId, t.roundNumber, t.ballot),
    check('votes_ballot_ck', sql.raw('ballot in (1, 2)')),
    check('votes_round_ck', sql.raw('round_number >= 1')),
    check('votes_weight_ck', sql.raw('weight >= 0')),
  ],
);

export type VoteRow = typeof votes.$inferSelect;

/** A team or individual outcome (WW-902). A draw has a null faction and a null player. */
export const victoryRecords = pgTable(
  'victory_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    faction: text('faction').$type<Faction>(),
    playerId: uuid('player_id').references(() => gamePlayers.id, { onDelete: 'cascade' }),
    roleId: text('role_id'),
    outcome: text('outcome').notNull(),
    terminal: boolean('terminal').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('victory_records_game_idx').on(t.gameId),
    check('victory_records_scope_ck', sql.raw(`scope in ('TEAM', 'INDIVIDUAL')`)),
    check('victory_records_outcome_ck', sql.raw(`outcome in ('WIN', 'DRAW')`)),
    check('victory_records_faction_ck', sql`faction is null or faction in (${inList(FACTIONS)})`),
  ],
);

export type VictoryRecordRow = typeof victoryRecords.$inferSelect;
