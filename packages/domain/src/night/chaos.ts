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
export function drawChaos(usedKinds: readonly ChaosKind[], livingIds: readonly PlayerId[], randomInt: (exclusiveMax: number) => number): ChaosDraw {
  const used = new Set(usedKinds);
  const remaining = CHAOS_KINDS.filter((kind) => !used.has(kind));
  const pool = remaining.length > 0 ? remaining : [...CHAOS_KINDS];
  const kind = pool[randomInt(pool.length)]!;
  const count = kind === 'SWAP_VOTES' ? 2 : kind === 'PROTECTIONS_OFF' || kind === 'NO_KILLS' ? 0 : 1;
  const bag = [...livingIds];
  const playerIds: PlayerId[] = [];
  for (let i = 0; i < count && bag.length > 0; i++) {
    const index = randomInt(bag.length);
    playerIds.push(bag.splice(index, 1)[0]!);
  }
  return { kind, playerIds };
}
