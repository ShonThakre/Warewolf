/** A small seeded generator (mulberry32), so a failing random game can be replayed from its seed. */
export interface Rng {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T | undefined;
  sample<T>(items: readonly T[], count: number): T[];
  chance(probability: number): boolean;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (maxExclusive: number) => Math.floor(next() * maxExclusive);
  return {
    next,
    int,
    pick: (items) => (items.length === 0 ? undefined : items[int(items.length)]),
    sample(items, count) {
      const pool = [...items];
      const out = [];
      while (out.length < count && pool.length > 0) out.push(pool.splice(int(pool.length), 1)[0]!);
      return out;
    },
    chance: (probability) => next() < probability,
  };
}
