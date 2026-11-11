import type { Faction } from './factions.js';
import type { ConnectionStatus, GameMode, GamePhase, GameStatus, LifeStatus } from './game.js';
import type { AbilitySource, AbilityStatus, Capability, IndividualVictoryState } from './roles.js';

/** Opaque identifiers. Plain strings at runtime. */
export type GameId = string;
export type PlayerId = string;
export type AssignmentId = string;
export type AbilityInstanceId = string;
export type RoleId = string;
export type AbilityId = string;

/**
 * A role dealt to one player. The original role and faction are written once
 * at start and never change. Conversions change only the current fields.
 */
export interface RoleAssignmentSnapshot {
  readonly id: AssignmentId;
  readonly playerId: PlayerId;
  readonly originalRoleId: RoleId;
  readonly currentRoleId: RoleId;
  /** Which ability profile of the role was dealt, such as `doctor_infection`. */
  readonly originalProfileId: string;
  readonly currentProfileId: string;
  readonly originalFaction: Faction;
  readonly currentFaction: Faction;
  readonly wolfAligned: boolean;
  readonly individualVictory: IndividualVictoryState;
  readonly publicReveal: boolean;
  readonly markTargetPlayerId: PlayerId | null;
}

/** One usable ability on one assignment. `chargesRemaining: null` is unlimited. */
export interface AbilityInstanceSnapshot {
  readonly id: AbilityInstanceId;
  readonly playerId: PlayerId;
  readonly assignmentId: AssignmentId;
  readonly abilityId: AbilityId;
  /** Null when the handler carries the whole mechanic, such as the Assassin's mark. */
  readonly capability: Capability | null;
  readonly handlerKey: string | null;
  readonly status: AbilityStatus;
  readonly chargesRemaining: number | null;
  readonly usesConsumed: number;
  readonly lastUsedRound: number | null;
  readonly lastTargetPlayerId: PlayerId | null;
  readonly availableFromRound: number;
  readonly expiresRound: number | null;
  readonly source: AbilitySource;
  readonly sourcePlayerId: PlayerId | null;
  /** Ability profile frozen from the configuration at grant time. */
  readonly config: Readonly<Record<string, unknown>>;
}

export interface PlayerSnapshot {
  readonly id: PlayerId;
  readonly displayName: string;
  readonly seatNumber: number;
  readonly isHost: boolean;
  readonly lifeStatus: LifeStatus;
  readonly connectionStatus: ConnectionStatus;
  readonly diedRound: number | null;
}

/**
 * Everything the pure rules need to reason about one game at one moment.
 * The API adapter builds it from PostgreSQL rows. Domain functions take it
 * as input and return patches. They never read or write storage.
 *
 * This is the full authoritative state, including every secret. It is never
 * sent to a client. Clients receive projections built from it.
 */
export interface GameSnapshot {
  readonly gameId: GameId;
  readonly status: GameStatus;
  readonly phase: GamePhase;
  readonly mode: GameMode;
  /** 0 in the lobby, 1 once the game starts. */
  readonly roundNumber: number;
  /** Increments on every committed transition. */
  readonly stateVersion: number;
  readonly hostPlayerId: PlayerId;
  /** Hash of the code catalog the game started with. Null before start. */
  readonly catalogHash: string | null;
  readonly players: readonly PlayerSnapshot[];
  /** Empty before start. One per player after start. */
  readonly assignments: readonly RoleAssignmentSnapshot[];
  readonly abilities: readonly AbilityInstanceSnapshot[];
}
