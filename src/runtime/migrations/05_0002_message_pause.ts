import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table message_status
      add column expires_at timestamptz
  `.execute(db);
}
