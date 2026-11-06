import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

/** D8: rename and soft delete append here; `thread` stays append-only. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table thread_state (
      id bigint generated always as identity primary key,
      org_id text not null,
      thread_id text not null,
      kind text not null check (kind in ('title', 'deleted')),
      title text check ((kind = 'title') = (title is not null)),
      at timestamptz not null default now(),
      foreign key (org_id, thread_id) references thread (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'thread_state');
}
