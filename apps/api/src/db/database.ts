import { type DynamicModule, Global, Inject, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export const DATABASE = Symbol('DATABASE');
export const PG_POOL = Symbol('PG_POOL');

export type Database = NodePgDatabase<typeof schema>;
/** The handle a `db.transaction` callback receives. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

@Global()
@Module({})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  static forUrl(connectionString: string): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: PG_POOL,
          useFactory: () => {
            const pool = new Pool({ connectionString });
            // An idle client can be killed by the server (restart, failover). Without a listener,
            // pg re-emits that as an unhandled error and the process exits.
            pool.on('error', (error) => new Logger('Database').error(`idle client error: ${error.message}`));
            return pool;
          },
        },
        { provide: DATABASE, inject: [PG_POOL], useFactory: (pool: Pool) => drizzle(pool, { schema }) },
      ],
      exports: [DATABASE, PG_POOL],
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

/** The PostgreSQL error behind a Drizzle query error, if there is one. */
export function pgError(error: unknown): { code?: string; constraint?: string } | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === 'object' && 'code' in current && typeof (current as { code: unknown }).code === 'string') {
      return current as { code: string; constraint?: string };
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export const isUniqueViolation = (error: unknown, constraint: string) => {
  const pg = pgError(error);
  return pg?.code === '23505' && pg.constraint === constraint;
};
