import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table action_status
      add column block_kind text,
      add column block_pointer jsonb
  `.execute(db);
}
