import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table action_status (
      org_id text not null,
      action_id text not null,
      seq integer not null check (seq >= 1),
      status text not null,
      reason text,
      attempt integer,
      resume_pointer jsonb,
      at timestamptz not null default now(),
      primary key (org_id, action_id, seq),
      foreign key (org_id, action_id) references action (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'action_status');
}
