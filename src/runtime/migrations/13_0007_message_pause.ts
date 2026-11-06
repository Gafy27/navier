import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table message_pause (
      org_id text not null,
      message_id text not null,
      stream_seq integer not null,
      blocked jsonb not null,
      primary key (org_id, message_id, stream_seq)
    )
  `.execute(db);
  await appendOnly(db, 'message_pause');
}
