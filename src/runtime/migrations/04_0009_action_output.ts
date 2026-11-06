import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table action_output (
      org_id text not null,
      action_id text not null,
      model_text text not null,
      is_error boolean not null,
      truncated boolean not null,
      object_id text,
      at timestamptz not null default now(),
      primary key (org_id, action_id),
      foreign key (org_id, action_id) references action (org_id, id),
      foreign key (org_id, object_id) references stored_object (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'action_output');
}
