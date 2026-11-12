import { Controller, Get, Inject, Injectable, Param, UseGuards } from '@nestjs/common';
import { dayTalliesResponseSchema, dayTallySchema, type DayTalliesResponse, type DayTally } from '@warewolf/contracts';
import { asc, eq } from 'drizzle-orm';
import { SeatGuard } from '../auth/seat.js';
import { DATABASE, type Database, type Transaction } from '../db/database.js';
import { dayTallies, type DayTallyRow } from '../db/schema.js';
import { UuidParam } from '../http/api-error.js';

/** The public tally of one closed ballot (OD-85). No voter ids exist on the row. */
export function toDayTally(row: DayTallyRow): DayTally {
  return dayTallySchema.parse({
    roundNumber: row.roundNumber,
    ballot: row.ballot,
    counts: row.counts,
    abstentions: row.abstentions,
    votedOutPlayerId: row.votedOutPlayerId,
    tiedPlayerIds: row.tiedPlayerIds,
  });
}

export async function readTallies(db: Database | Transaction, gameId: string): Promise<DayTally[]> {
  const rows = await db.select().from(dayTallies).where(eq(dayTallies.gameId, gameId)).orderBy(asc(dayTallies.roundNumber), asc(dayTallies.ballot));
  return rows.map(toDayTally);
}

@Injectable()
export class TallyService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(gameId: string): Promise<DayTalliesResponse> {
    return dayTalliesResponseSchema.parse({ tallies: await readTallies(this.db, gameId) });
  }
}

/** GET /games/:gameId/tallies (WW-904). Any seat in the game; closed ballots only. */
@Controller('games/:gameId/tallies')
@UseGuards(SeatGuard)
export class TallyController {
  constructor(@Inject(TallyService) private readonly tallies: TallyService) {}

  @Get()
  list(@Param('gameId', new UuidParam()) gameId: string): Promise<DayTalliesResponse> {
    return this.tallies.list(gameId);
  }
}
