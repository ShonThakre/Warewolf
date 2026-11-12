import type { GamePhase, GameStatus, LifeStatus } from '../game.js';

/**
 * Table chat rules (OD-72, accepted 11 November 2026).
 *
 * One public channel per game. Living players post during day discussion and
 * the ballots. Nobody posts at night or on the reveal screen. Dead players
 * read and never post. There is no wolf channel and no dead channel.
 */

/** The phases in which a living, unmuted seat may post. */
export const CHAT_OPEN_PHASES = ['DAY_DISCUSSION', 'VOTING', 'REVOTE'] as const satisfies readonly GamePhase[];

/** Longest message, in Unicode code points (PostgreSQL `char_length`). */
export const CHAT_MAX_LENGTH = 280;

/** Posts one seat may make in one window. One more is refused with 429. */
export const CHAT_RATE_LIMIT = 5;
export const CHAT_RATE_WINDOW_MS = 10_000;

/**
 * Why a seat may not post right now, or null when it may.
 *
 * - `CLOSED`: the game is not running, or the phase is not a chat phase.
 * - `DEAD`: the seat is eliminated. Dead players read only.
 * - `MUTED`: the host muted the seat.
 *
 * Checked in that order, so a dead seat at night is told the chat is closed,
 * which every seat already knows.
 */
export type ChatRefusal = 'CLOSED' | 'DEAD' | 'MUTED';

export interface ChatSeatState {
  readonly status: GameStatus;
  readonly phase: GamePhase;
  readonly lifeStatus: LifeStatus;
  readonly muted: boolean;
}

export function isChatOpen(status: GameStatus, phase: GamePhase): boolean {
  return status === 'ACTIVE' && (CHAT_OPEN_PHASES as readonly GamePhase[]).includes(phase);
}

export function chatRefusal(seat: ChatSeatState): ChatRefusal | null {
  if (!isChatOpen(seat.status, seat.phase)) return 'CLOSED';
  if (seat.lifeStatus !== 'ALIVE') return 'DEAD';
  if (seat.muted) return 'MUTED';
  return null;
}

/** Length in code points, so an emoji counts as one character, matching the database check. */
export function chatLength(body: string): number {
  return [...body].length;
}

/**
 * The text that is stored: trimmed, with Windows line ends folded to `\n`.
 * Returns null when nothing is left, or when it contains a control character
 * other than a line break or a tab.
 */
export function normalizeChatBody(raw: string): string | null {
  const body = raw.replace(/\r\n?/g, '\n').trim();
  if (body.length === 0) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(body)) return null;
  return body;
}
