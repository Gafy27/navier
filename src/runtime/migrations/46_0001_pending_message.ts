import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table pending_message (
      org_id text not null,
      user_message_id text not null,
      thread_id text not null,
      agent_id text not null,
      agent_version integer not null,
      tools jsonb not null,
      provider text not null,
      model text not null,
      reasoning_effort text,
      method text not null check (method in ('selection', 'version', 'fallback')),
      request_context jsonb not null,
      max_steps integer check (max_steps >= 1),
      at timestamptz not null default now(),
      primary key (org_id, user_message_id),
      foreign key (org_id, user_message_id) references message (org_id, id),
      foreign key (org_id, agent_id, agent_version)
        references agent_version (org_id, agent_id, version)
    )
  `.execute(db);
  await sql`
    create index pending_message_thread
    on pending_message (org_id, thread_id, user_message_id)
  `.execute(db);
  await appendOnly(db, 'pending_message');
  await sql`
    create table pending_close (
      org_id text not null,
      user_message_id text not null,
      agent_message_id text,
      dropped_reason text,
      at timestamptz not null default now(),
      primary key (org_id, user_message_id),
      foreign key (org_id, user_message_id)
        references pending_message (org_id, user_message_id),
      foreign key (org_id, agent_message_id) references message (org_id, id),
      check ((agent_message_id is null) <> (dropped_reason is null))
    )
  `.execute(db);
  await appendOnly(db, 'pending_close');
}
