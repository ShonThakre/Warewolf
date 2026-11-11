import type { RandomInt } from '../assignment/shuffle.js';

/** A seeded generator. `next` is in [0, 1). `int(max)` is in [0, max). */
export interface Rng {
  next(): number;
  readonly int: RandomInt;
}

/** mulberry32. The same seed replays the same sequence. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (max) => Math.floor(next() * max) };
}
