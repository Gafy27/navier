import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table message (
      org_id text not null,
      id text not null,
      thread_id text not null,
      rank integer not null check (rank >= 1),
      role text not null check (role in ('user', 'agent')),
      text text,
      user_message_id text,
      agent_id text,
      agent_version integer,
      trace_id text,
      request_context jsonb,
      max_steps integer check (max_steps >= 1),
      created_by text not null,
      created_at timestamptz not null default now(),
      primary key (org_id, id),
      unique (org_id, thread_id, rank),
      foreign key (org_id, thread_id) references thread (org_id, id),
      foreign key (org_id, user_message_id) references message (org_id, id),
      foreign key (org_id, agent_id, agent_version)
        references agent_version (org_id, agent_id, version)
    )
  `.execute(db);
  await appendOnly(db, 'message');
}
