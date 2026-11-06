import { pathToFileURL } from 'node:url';
import { createLogger, loadConfig } from './index.ts';
import { createDb, DatabaseConfigSchema, migrate } from './db/index.ts';
import { listPendingMigrationNames } from './db/migrate.ts';
import { migrations } from './migrations.ts';

/**
 * No args applies the pending migrations (0 ok, 1 failed). `--check` applies
 * nothing (0 current, 1 pending, 2 error). Any other argument is a usage
 * error (2) and applies nothing.
 */
export async function runMigrateCli(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): Promise<number> {
  const check = argv.length === 1 && argv[0] === '--check';
  const log = createLogger('info');
  if (argv.length > 0 && !check) {
    log.error('unknown migrate argument');
    return 2;
  }

  const loaded = loadConfig(DatabaseConfigSchema, env);
  if (!loaded.ok) {
    log.error(loaded.error.message);
    return check ? 2 : 1;
  }

  const database = createDb(loaded.value, log);
  try {
    if (check) {
      const pending = await listPendingMigrationNames(
        database.db,
        migrations,
        log,
      );
      if (!pending.ok) return 2;
      if (pending.value.length === 0) return 0;
      log.info({ pending: pending.value }, 'migrations pending');
      return 1;
    }
    const result = await migrate(database.db, migrations, log);
    if (!result.ok) {
      log.error({ err: result.error }, 'migrate failed');
      return 1;
    }
    log.info({ applied: result.value }, 'migrate done');
    return 0;
  } finally {
    await database.close();
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exit(await runMigrateCli(process.argv.slice(2), process.env));
}
