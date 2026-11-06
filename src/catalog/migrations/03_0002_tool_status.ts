import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table tool_status (
      org_id text not null,
      key text not null,
      implementation_version integer not null,
      seq integer not null check (seq >= 1),
      enabled boolean not null,
      by text not null,
      at timestamptz not null default now(),
      primary key (org_id, key, implementation_version, seq),
      foreign key (org_id, key, implementation_version)
        references tool_entry (org_id, key, implementation_version)
    )
  `.execute(db);
  await sql`
    create trigger tool_status_append_only
    before update or delete on tool_status
    for each row execute function forbid_mutation()
  `.execute(db);
}
