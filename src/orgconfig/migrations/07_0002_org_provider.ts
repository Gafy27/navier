import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table org_provider (
      org_id text not null,
      provider text not null,
      seq integer not null check (seq >= 1),
      adapter text not null,
      base_url text not null,
      by text not null,
      at timestamptz not null default now(),
      primary key (org_id, provider, seq)
    )
  `.execute(db);
  await sql`
    create trigger org_provider_append_only
    before update or delete on org_provider
    for each row execute function forbid_mutation()
  `.execute(db);
}
