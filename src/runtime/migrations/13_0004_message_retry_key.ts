import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table message
      add column retry_key text,
      add constraint message_retry_key_unique
        unique (org_id, thread_id, retry_key)
  `.execute(db);
}
