import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table org_provider_key (
      org_id text not null,
      provider text not null,
      seq integer not null check (seq >= 1),
      key_id text not null,
      wrapped_key bytea not null,
      wrap_nonce bytea not null,
      data_nonce bytea not null,
      ciphertext bytea not null,
      by text not null,
      at timestamptz not null default now(),
      primary key (org_id, provider, seq)
    )
  `.execute(db);
  await sql`
    create trigger org_provider_key_append_only
    before update or delete on org_provider_key
    for each row execute function forbid_mutation()
  `.execute(db);
}
