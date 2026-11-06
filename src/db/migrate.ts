import { Migrator } from 'kysely/migration';
import type { Kysely } from 'kysely';
import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Logger, Result } from '../index.ts';
import type { Db } from './db.ts';
import { up as appendOnly } from './migrations/01_0001_append_only.ts';
import { up as auditEvent } from './migrations/01_0002_audit_event.ts';

/** A name `<phase>_<sequence>_<topic>` and a forward step. There is no down step. */
export interface Migration {
  readonly name: string;
  readonly up: (db: Kysely<unknown>) => Promise<void>;
}

/** Core's migrations, in name order. */
export const coreMigrations: readonly Migration[] = [
  { name: '01_0001_append_only', up: appendOnly },
  { name: '01_0002_audit_event', up: auditEvent },
];

function migratorFor(db: Db, migrations: readonly Migration[]): Migrator {
  return new Migrator({
    db,
    provider: {
      getMigrations: () =>
        Promise.resolve(
          Object.fromEntries(migrations.map((m) => [m.name, { up: m.up }])),
        ),
    },
  });
}

/** Names of the migrations that have not run, in name order. Runs no `up` step. */
export async function listPendingMigrationNames(
  db: Db,
  migrations: readonly Migration[],
  log: Logger,
): Promise<Result<readonly string[]>> {
  try {
    const infos = await migratorFor(db, migrations).getMigrations();
    return ok(
      infos.filter((i) => i.executedAt === undefined).map((i) => i.name),
    );
  } catch (cause) {
    log.error('migration status failed');
    return err(appError(ErrorCode.internal, 'migration status failed', cause));
  }
}

/** Applies the pending migrations in name order. Returns the names it applied. */
export async function migrate(
  db: Db,
  migrations: readonly Migration[],
  log: Logger,
): Promise<Result<readonly string[]>> {
  const migrator = migratorFor(db, migrations);
  const { error, results = [] } = await migrator.migrateToLatest();
  if (error !== undefined) {
    const failed = results.find((r) => r.status === 'Error')?.migrationName;
    log.error({ migration: failed }, 'migration failed');
    return err(appError(ErrorCode.internal, 'migration failed', error));
  }
  return ok(
    results.filter((r) => r.status === 'Success').map((r) => r.migrationName),
  );
}
