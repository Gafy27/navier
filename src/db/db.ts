import { Kysely, PostgresDialect } from 'kysely';
import type { Generated, Transaction } from 'kysely';
import pg from 'pg';
import type { Logger, Result } from '../index.ts';
import type { DatabaseConfig } from '../config.ts';
import type { OrgId } from './org.ts';

export interface AuditEventTable {
  id: Generated<string>;
  org_id: OrgId;
  kind: string;
  actor_kind: string;
  actor_id: string;
  target_kind: string;
  target_id: string;
  trace_id: string | null;
  at: Generated<Date>;
}

/** Core's own tables. Each unit adds its tables with `withTables`. */
export interface CoreTables {
  audit_event: AuditEventTable;
}

export type Db = Kysely<CoreTables>;

declare const txBrand: unique symbol;

/** A handle inside a transaction. A `Db` is not a `Tx`. */
export type Tx<DB = CoreTables> = Transaction<DB> & {
  readonly [txBrand]: true;
};

/** Opens a pool and returns the handle with its close function. */
export function createDb(
  config: DatabaseConfig,
  log: Logger,
): { readonly db: Db; readonly close: () => Promise<void> } {
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: config.DATABASE_POOL_MAX,
  });
  pool.on('error', (e: Error & { code?: string }) => {
    log.error({ message: e.message, code: e.code }, 'database pool error');
  });
  const db = new Kysely<CoreTables>({ dialect: new PostgresDialect({ pool }) });
  return {
    db,
    close: async () => {
      await db.destroy();
    },
  };
}

/** Commits on `ok`, rolls back on `err` or a throw. A throw propagates. */
export async function withTransaction<T, E>(
  db: Db,
  fn: (tx: Tx) => Promise<Result<T, E>>,
): Promise<Result<T, E>> {
  const trx = await db.startTransaction().execute();
  try {
    const result = await fn(trx as unknown as Tx);
    if (result.ok) await trx.commit().execute();
    else await trx.rollback().execute();
    return result;
  } catch (e) {
    // Best effort, so the original error propagates.
    await trx
      .rollback()
      .execute()
      .catch(() => undefined);
    throw e;
  }
}

/** True when `e` is a Postgres error with SQLSTATE `code`. */
export function hasPgCode(e: unknown, code: string): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === code;
}
