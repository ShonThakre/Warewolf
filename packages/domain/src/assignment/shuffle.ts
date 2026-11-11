/**
 * A uniform random integer in `[0, maxExclusive)`. Production passes a CSPRNG
 * (`randomInt` from node:crypto). Tests pass a scripted or seeded source. The
 * domain never picks its own randomness, and a client never supplies it.
 */
export type RandomInt = (maxExclusive: number) => number;

/**
 * Fisher-Yates (Durstenfeld) shuffle. Returns a new array; the input is not
 * changed. Every permutation is equally likely when `randomInt` is uniform.
 *
 * A value outside `[0, i]` would silently bias the deal, so it throws instead.
 */
export function fisherYates<T>(items: readonly T[], randomInt: RandomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) {
      throw new RangeError(`randomInt(${i + 1}) returned ${j}, outside 0 to ${i}`);
    }
    const swap = out[i]!;
    out[i] = out[j]!;
    out[j] = swap;
  }
  return out;
}
