import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table api_login_state (
      state text primary key,
      key_id text not null,
      wrapped_key bytea not null,
      wrap_nonce bytea not null,
      data_nonce bytea not null,
      ciphertext bytea not null,
      expires_at timestamptz not null
    )
  `.execute(db);
  await sql`
    create table api_session (
      id_hash text primary key,
      key_id text not null,
      wrapped_key bytea not null,
      wrap_nonce bytea not null,
      data_nonce bytea not null,
      ciphertext bytea not null,
      created_at timestamptz not null default now(),
      refreshed_at timestamptz not null default now()
    )
  `.execute(db);
}
