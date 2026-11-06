import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table step (
      org_id text not null,
      message_id text not null,
      step_index integer not null check (step_index >= 0),
      run_key text not null,
      content jsonb not null,
      finish_reason text not null,
      usage jsonb not null,
      trace_object_id text not null,
      trace_truncated boolean not null,
      at timestamptz not null default now(),
      primary key (org_id, message_id, step_index),
      foreign key (org_id, message_id) references message (org_id, id),
      foreign key (org_id, trace_object_id) references stored_object (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'step');
}
