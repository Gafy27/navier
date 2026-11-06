import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table approval_memory (
      org_id text not null,
      agent_id text not null,
      tool_key text not null,
      args_hash text not null,
      action_id text not null,
      decided_by text not null,
      at timestamptz not null default now(),
      primary key (org_id, agent_id, tool_key, args_hash)
    )
  `.execute(db);
  await appendOnly(db, 'approval_memory');
}
