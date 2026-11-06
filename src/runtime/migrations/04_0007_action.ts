import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table action (
      org_id text not null,
      id text not null,
      message_id text not null,
      step_index integer not null,
      call_index integer not null check (call_index >= 0),
      tool_call_id text not null,
      tool_key text not null,
      implementation_version integer,
      arguments jsonb not null,
      config_snapshot jsonb not null,
      at timestamptz not null default now(),
      primary key (org_id, id),
      unique (org_id, message_id, step_index, call_index),
      foreign key (org_id, message_id, step_index)
        references step (org_id, message_id, step_index)
    )
  `.execute(db);
  await appendOnly(db, 'action');
}
