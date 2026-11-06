import { sql } from 'kysely';
import {
  DEFAULT_MIGRATION_LOCK_TABLE,
  DEFAULT_MIGRATION_TABLE,
} from 'kysely/migration';
import type { Db } from './db.ts';

/** Lists `table.index` for each unique index or primary key without `org_id`. Empty is the pass. */
export async function findUnscopedUniqueIndexes(db: Db): Promise<string[]> {
  // The migrator's own tables hold no org data. Login state and sessions
  // exist before an org is known and span orgs (P13.2 D4, PD8).
  const skipped = [
    DEFAULT_MIGRATION_TABLE,
    DEFAULT_MIGRATION_LOCK_TABLE,
    'api_login_state',
    'api_session',
    'api_login_handoff',
  ];
  const result = await sql<{ name: string }>`
    select c.relname || '.' || i.relname as name
    from pg_index x
    join pg_class c on c.oid = x.indrelid
    join pg_class i on i.oid = x.indexrelid
    join pg_namespace n on n.oid = c.relnamespace
    where x.indisunique
      and n.nspname = current_schema()
      and c.relname <> all(${skipped})
      and not exists (
        select 1
        from generate_series(0, x.indnkeyatts - 1) k
        join pg_attribute a on a.attrelid = c.oid and a.attnum = x.indkey[k]
        where a.attname = 'org_id'
      )
    order by name
  `.execute(db);
  return result.rows.map((r) => r.name);
}
