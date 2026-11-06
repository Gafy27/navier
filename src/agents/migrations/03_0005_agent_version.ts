import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table agent_version (
      org_id text not null,
      agent_id text not null,
      version integer not null check (version >= 1),
      definition jsonb not null,
      definition_hash text not null,
      author_id text not null,
      created_at timestamptz not null default now(),
      primary key (org_id, agent_id, version),
      foreign key (org_id, agent_id) references agent (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'agent_version');
}
