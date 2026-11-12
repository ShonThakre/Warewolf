import type { PlayerId } from '../snapshot.js';
import { CHAOS_KINDS, type ChaosDraw, type ChaosKind } from './types.js';

/**
 * Draws one Chaos event. The pool is the six Ultimate 20 events, without
 * replacement. When every event has been used, the pool resets. This is an
 * engineering default, recorded in docs/werewolf/ultimate-20-rules.md.
 *
 * `randomInt(n)` returns an integer in `0 .. n-1`. The API passes a CSPRNG.
 * The night resolver stays deterministic and only applies the draw it is given.
 */
/**
 * How many living players the event names.
 * Nobody-votes, protections-off, and no-kills name nobody.
 * A swapped pair names two. A double vote or a disabled ability names one.
 */
function namedPlayers(kind: ChaosKind): number {
  if (kind === 'SWAP_VOTES') return 2;
  if (kind === 'DOUBLE_VOTE' || kind === 'ABILITY_DISABLED') return 1;
  return 0;
}

export function drawChaos(usedKinds: readonly ChaosKind[], livingIds: readonly PlayerId[], randomInt: (exclusiveMax: number) => number): ChaosDraw {
  const used = new Set(usedKinds);
  const remaining = CHAOS_KINDS.filter((kind) => !used.has(kind));
  const pool = remaining.length > 0 ? remaining : [...CHAOS_KINDS];
  const kind = pool[randomInt(pool.length)]!;
  const bag = [...livingIds];
  const playerIds: PlayerId[] = [];
  for (let i = 0; i < namedPlayers(kind) && bag.length > 0; i++) {
    const index = randomInt(bag.length);
    playerIds.push(bag.splice(index, 1)[0]!);
  }
  return { kind, playerIds };
}

/**
 * The pool after a draw that actually resolved. A blocked or rewound draw
 * is not remembered. When every kind has been used, the next remembered
 * kind starts a fresh pool.
 */
export function rememberChaosKind(usedKinds: readonly ChaosKind[], kind: ChaosKind): ChaosKind[] {
  const remaining = CHAOS_KINDS.filter((item) => !usedKinds.includes(item));
  if (remaining.length === 0) return [kind];
  return usedKinds.includes(kind) ? [...usedKinds] : [...usedKinds, kind];
}

/** One toward the Chaos Demon only when the event changed the game. A pending day event is not a success yet. */
export function chaosSuccessCount(success: boolean | null | undefined): 0 | 1 {
  return success === true ? 1 : 0;
}
