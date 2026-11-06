import { sql } from 'kysely';
import type { Kysely } from 'kysely';

/**
 * The snapshot row a reused create key fills from. Not the newest row.
 * A constant default fills rows that already exist: the append-only trigger
 * rejects an UPDATE. New inserts must set the column.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table agent_create_key
      add column snapshot_seq integer not null default 1
  `.execute(db);
  await sql`
    alter table agent_create_key
      alter column snapshot_seq drop default
  `.execute(db);
}
