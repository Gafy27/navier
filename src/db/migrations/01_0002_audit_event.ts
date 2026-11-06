import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table audit_event (
      id bigint generated always as identity,
      org_id text not null,
      kind text not null check (kind ~ '^[a-z][a-z_]*[.][a-z][a-z_]*$'),
      actor_kind text not null,
      actor_id text not null,
      target_kind text not null,
      target_id text not null,
      trace_id text,
      at timestamptz not null default now(),
      primary key (org_id, id)
    )
  `.execute(db);
  await sql`
    create trigger audit_event_append_only
    before update or delete on audit_event
    for each row execute function forbid_mutation()
  `.execute(db);
}
