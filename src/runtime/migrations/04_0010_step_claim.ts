import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table step_claim (
      org_id text not null,
      message_id text not null,
      step_index integer not null check (step_index >= 0),
      attempt integer not null check (attempt >= 1),
      at timestamptz not null default now(),
      primary key (org_id, message_id, step_index, attempt),
      foreign key (org_id, message_id) references message (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'step_claim');
}
