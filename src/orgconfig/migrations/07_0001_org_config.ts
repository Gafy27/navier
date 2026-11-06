import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table org_config (
      org_id text not null,
      seq integer not null check (seq >= 1),
      max_tools_per_version integer not null,
      max_fallbacks integer not null,
      max_steps integer not null,
      pause_timeout text not null,
      max_trace_output_bytes integer not null,
      max_tool_output_bytes integer not null,
      max_tool_attempts integer not null,
      by text not null,
      at timestamptz not null default now(),
      primary key (org_id, seq)
    )
  `.execute(db);
  await sql`
    create trigger org_config_append_only
    before update or delete on org_config
    for each row execute function forbid_mutation()
  `.execute(db);
}
