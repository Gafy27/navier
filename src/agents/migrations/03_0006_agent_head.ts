import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { AgentStatus } from '../head.ts';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table agent_head (
      org_id text not null,
      agent_id text not null,
      seq integer not null check (seq >= 1),
      active_version integer not null,
      status text not null check (status in (${sql.lit(AgentStatus.active)}, ${sql.lit(AgentStatus.archived)})),
      by text not null,
      at timestamptz not null default now(),
      primary key (org_id, agent_id, seq),
      foreign key (org_id, agent_id, active_version)
        references agent_version (org_id, agent_id, version)
    )
  `.execute(db);
  await appendOnly(db, 'agent_head');
}
