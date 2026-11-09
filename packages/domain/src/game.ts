/**
 * Game-level enumerations. Values match docs/werewolf/data-model.md and
 * docs/werewolf/role-configuration.md.
 */

export const GAME_MODES = ['INFECTION', 'CLASSIC', 'EXPANDED', 'CUSTOM'] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const GAME_STATUSES = ['LOBBY', 'ACTIVE', 'FINISHED', 'CANCELLED'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

/**
 * Phases a client can observe. Resolution is a transaction inside the close
 * of a phase, not a phase of its own.
 */
export const GAME_PHASES = [
  'LOBBY',
  'ROLE_REVEAL',
  'NIGHT_SUBMIT',
  'NIGHT_HOST_CONFIRM',
  'NIGHT_REACTION',
  'DAY_ANNOUNCE',
  'DAY_DISCUSSION',
  'VOTING',
  'REVOTE',
  'FINISHED',
  'CANCELLED',
] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

export const LIFE_STATUSES = ['ALIVE', 'DEAD'] as const;
export type LifeStatus = (typeof LIFE_STATUSES)[number];

export const CONNECTION_STATUSES = ['CONNECTED', 'DISCONNECTED'] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];
