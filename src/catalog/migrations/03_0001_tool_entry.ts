import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table tool_entry (
      org_id text not null,
      key text not null,
      implementation_version integer not null check (implementation_version >= 1),
      name text not null,
      description text not null,
      input_schema jsonb not null,
      retry_on_interrupt boolean not null,
      tool_attempts integer not null check (tool_attempts >= 1),
      max_tool_output_bytes integer not null check (max_tool_output_bytes >= 1),
      approval text not null check (approval in ('never_ask', 'low', 'medium', 'high')),
      config_schema jsonb,
      registered_by text not null,
      at timestamptz not null default now(),
      primary key (org_id, key, implementation_version)
    )
  `.execute(db);
  await sql`
    create trigger tool_entry_append_only
    before update or delete on tool_entry
    for each row execute function forbid_mutation()
  `.execute(db);
}
