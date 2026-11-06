import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table agent_create_key (
      org_id text not null,
      idempotency_key text not null,
      agent_id text not null,
      definition_hash text not null,
      primary key (org_id, idempotency_key),
      unique (org_id, agent_id),
      foreign key (org_id, agent_id) references agent (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'agent_create_key');
}
