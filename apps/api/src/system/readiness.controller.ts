import { Controller, Get, Inject, Logger, Res } from '@nestjs/common';
import type { ReadinessResponse } from '@warewolf/contracts';
import { sql } from 'drizzle-orm';
import type { Response } from 'express';
import { DATABASE, type Database } from '../db/database.js';

/** How long the database may take to answer before the API reports itself unavailable. */
export const READINESS_TIMEOUT_MS = 2_000;

/**
 * Readiness (WW-1503): can this API serve a game right now? Registered only
 * when a database is configured. The production Compose health check uses it.
 */
@Controller('health')
export class ReadinessController {
  private readonly logger = new Logger('Readiness');

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessResponse> {
    const reachable = await this.ping();
    if (!reachable) res.status(503);
    return reachable ? { status: 'ok', database: 'ok' } : { status: 'unavailable', database: 'unavailable' };
  }

  private async ping(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timed out')), READINESS_TIMEOUT_MS);
      });
      await Promise.race([this.db.execute(sql`select 1`), timeout]);
      return true;
    } catch (error) {
      this.logger.warn(`database unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
