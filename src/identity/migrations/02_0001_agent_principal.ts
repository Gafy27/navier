import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table agent_principal (
      org_id text not null,
      agent_id text not null,
      principal_id text not null,
      created_by text not null,
      created_at timestamptz not null default now(),
      primary key (org_id, agent_id),
      unique (org_id, principal_id)
    )
  `.execute(db);
  await sql`
    create trigger agent_principal_append_only
    before update or delete on agent_principal
    for each row execute function forbid_mutation()
  `.execute(db);
}
