import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table model_policy (
      org_id text not null,
      provider text not null,
      model text not null,
      seq integer not null check (seq >= 1),
      enabled boolean not null,
      degraded boolean not null,
      by text not null,
      at timestamptz not null default now(),
      primary key (org_id, provider, model, seq)
    )
  `.execute(db);
  await sql`
    create trigger model_policy_append_only
    before update or delete on model_policy
    for each row execute function forbid_mutation()
  `.execute(db);
}
