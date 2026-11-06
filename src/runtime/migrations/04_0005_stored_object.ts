import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table stored_object (
      org_id text not null,
      id text not null,
      sha256 text not null,
      bytes bytea not null,
      size integer not null check (size >= 0),
      content_type text not null,
      created_at timestamptz not null default now(),
      primary key (org_id, id),
      unique (org_id, sha256)
    )
  `.execute(db);
  await appendOnly(db, 'stored_object');
}
