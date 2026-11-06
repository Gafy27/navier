import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table agent (
      org_id text not null,
      id text not null,
      principal_id text not null,
      created_by text not null,
      created_at timestamptz not null default now(),
      primary key (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'agent');
}
