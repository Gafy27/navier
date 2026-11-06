import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { ServingStatus } from '../serving.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  const statuses = sql.join(ServingStatus.options.map((s) => sql.lit(s)));
  await sql`
    create table tool_serving (
      org_id text not null,
      key text not null,
      implementation_version integer not null,
      seq integer not null check (seq >= 1),
      status text not null check (status in (${statuses})),
      by text,
      at timestamptz not null default now(),
      primary key (org_id, key, implementation_version, seq),
      foreign key (org_id, key, implementation_version)
        references tool_entry (org_id, key, implementation_version)
    )
  `.execute(db);
  await sql`
    create trigger tool_serving_append_only
    before update or delete on tool_serving
    for each row execute function forbid_mutation()
  `.execute(db);
}
