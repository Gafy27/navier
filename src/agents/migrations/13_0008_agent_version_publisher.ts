import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

/** Who first published each version. A row is never updated or deleted (PD1 A). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table agent_version_publisher (
      org_id text not null,
      agent_id text not null,
      version integer not null,
      published_by text not null,
      at timestamptz not null default now(),
      primary key (org_id, agent_id, version),
      foreign key (org_id, agent_id, version)
        references agent_version (org_id, agent_id, version)
    )
  `.execute(db);
  await appendOnly(db, 'agent_version_publisher');
}
