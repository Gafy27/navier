import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table stop_requested (
      org_id text not null,
      message_id text not null,
      kind text not null check (kind in ('cancel', 'interrupt')),
      by text not null,
      at timestamptz not null default now(),
      primary key (org_id, message_id),
      foreign key (org_id, message_id) references message (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'stop_requested');
}
