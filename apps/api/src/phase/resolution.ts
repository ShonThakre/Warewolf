import type { Ballot, DayResolution, NightResolution } from '@warewolf/domain';
import type { Transaction } from '../db/database.js';
import type { GameRow } from '../db/schema.js';
import type { NightResolutionService } from '../night/night-resolution.service.js';
import type { DayResolutionService } from '../day/day-resolution.service.js';

/**
 * The resolutions a phase close runs. Each runs inside the close
 * transaction, under the game row lock, and reports back only what the phase
 * machine needs: whether the game ended, and whether a ballot tied. Deaths,
 * conversions, and winners are the resolver's own writes.
 *
 * - Night: `NightResolutionService` (WW-802) wraps the pure `resolveNight` (WW-801).
 * - Day: WW-901 tallies the ballot, and WW-902 evaluates victory.
 *
 * A resolver that throws rolls the whole close back, so the phase does not move.
 */
export interface PhaseResolvers {
  resolveNight(tx: Transaction, game: GameRow): Promise<NightResolution>;
  resolveDay(tx: Transaction, game: GameRow, ballot: Ballot): Promise<DayResolution>;
}

export const PHASE_RESOLVERS = Symbol('PHASE_RESOLVERS');

/**
 * Until a test passes its own resolvers, a night kills nobody and a ballot
 * eliminates nobody. Production uses `phaseResolvers`.
 */
export const pendingResolvers: PhaseResolvers = {
  resolveNight: async () => ({ gameOver: false }),
  resolveDay: async () => ({ gameOver: false, tied: false }),
};

/** The production resolvers: night (WW-802) and day (WW-901, WW-902). */
export function phaseResolvers(night: NightResolutionService, day: DayResolutionService): PhaseResolvers {
  return {
    resolveNight: (tx, game) => night.resolve(tx, game),
    resolveDay: (tx, game, ballot) => day.resolve(tx, game, ballot),
  };
}
