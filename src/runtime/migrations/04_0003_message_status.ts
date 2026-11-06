import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table message_status (
      org_id text not null,
      message_id text not null,
      seq integer not null check (seq >= 1),
      status text not null,
      reason text,
      at timestamptz not null default now(),
      primary key (org_id, message_id, seq),
      foreign key (org_id, message_id) references message (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'message_status');
}
