import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table scope_request (
      org_id text not null,
      id bigint generated always as identity,
      principal_id text not null,
      scope text not null,
      requested_by text not null,
      at timestamptz not null default now(),
      primary key (org_id, id),
      unique (org_id, principal_id, scope)
    )
  `.execute(db);
  await sql`
    create trigger scope_request_append_only
    before update or delete on scope_request
    for each row execute function forbid_mutation()
  `.execute(db);
}
