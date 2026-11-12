/**
 * Public morning announcement copy (DAY_ANNOUNCE). Only facts every seat may
 * read: who was eliminated overnight, or that nobody was. Private notes stay
 * off this card.
 */

type Named = {
  readonly playerId: string;
  readonly displayName: string;
  readonly avatarId: number | null;
  readonly lifeStatus: string;
};

/** Living seats shown under Survivors. */
export function morningSurvivors<T extends Named>(players: readonly T[]): readonly T[] {
  return players.filter((player) => player.lifeStatus === 'ALIVE');
}

/**
 * One public headline. Elimination lines come from `useTableNotes` /
 * `PLAYER_ELIMINATED`. Anything else (investigation, infection) is ignored.
 */
export function morningHeadline(notes: readonly string[]): string {
  const eliminated = notes.filter((line) => /\bwas eliminated\b/i.test(line));
  if (eliminated.length === 0) return 'No one was eliminated last night.';
  if (eliminated.length === 1) return eliminated[0]!;
  return eliminated.join(' ');
}
