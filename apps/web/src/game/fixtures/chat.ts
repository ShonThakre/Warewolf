import type { ChatMessage, ChatView } from '@warewolf/contracts';
import { fixtureId, fixturePlayerId } from './role';

/**
 * Chat views for screens, stories, and tests (WW-1104, for WW-1206). Ids are
 * fixed so snapshots stay stable. Text is plain table talk: it never names a
 * role, because nothing in the chat contract can carry one.
 */

const LINES: readonly [seat: number, body: string][] = [
  [2, 'Morning, everyone. Quiet night for me.'],
  [5, 'Seat 7 was very sure of themselves yesterday.'],
  [7, 'Because I was right! Ask seat 3.'],
  [3, 'I am staying out of this one.'],
  [1, 'Two minutes left, then we vote.'],
];

export function chatMessageFixture(n: number, overrides: Partial<ChatMessage> = {}): ChatMessage {
  const [seat, body] = LINES[(n - 1) % LINES.length]!;
  return {
    messageId: fixtureId(9000 + n),
    seq: n,
    playerId: fixturePlayerId(seat),
    body,
    roundNumber: 2,
    phase: 'DAY_DISCUSSION',
    createdAt: new Date(Date.UTC(2026, 10, 11, 10, 0, n * 7)).toISOString(),
    ...overrides,
  };
}

export function chatViewFixture(overrides: Partial<ChatView> & { count?: number } = {}): ChatView {
  const { count = LINES.length, ...rest } = overrides;
  return {
    messages: Array.from({ length: count }, (_, i) => chatMessageFixture(i + 1)),
    mutedPlayerIds: [],
    you: { canPost: true, refusal: null },
    ...rest,
  };
}
