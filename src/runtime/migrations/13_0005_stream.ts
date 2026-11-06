import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table stream_delta (
      org_id text not null,
      message_id text not null,
      seq integer not null check (seq >= 1),
      kind text not null check (kind in ('text', 'reasoning')),
      trace_id text not null,
      text text not null,
      expires_at timestamptz not null,
      primary key (org_id, message_id, seq),
      foreign key (org_id, message_id) references message (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'stream_delta');
  await sql`
    create table conversation_event (
      org_id text not null,
      thread_id text not null,
      seq integer not null check (seq >= 1),
      kind text not null check (kind in ('message', 'title', 'promoted', 'done')),
      message_id text,
      payload jsonb not null,
      at timestamptz not null default now(),
      primary key (org_id, thread_id, seq),
      foreign key (org_id, thread_id) references thread (org_id, id),
      foreign key (org_id, message_id) references message (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'conversation_event');
  await sql`
    create table stream_counter (
      org_id text not null,
      channel text not null check (channel in ('message', 'conversation')),
      parent_id text not null,
      last_seq integer not null check (last_seq >= 1),
      primary key (org_id, channel, parent_id)
    )
  `.execute(db);
  for (const table of ['step', 'action', 'action_output', 'message_status']) {
    await sql`alter table ${sql.id(table)} add column stream_seq integer`.execute(
      db,
    );
  }
}
