import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table model_resolution (
      org_id text not null,
      message_id text not null,
      seq integer not null check (seq >= 1),
      provider text not null,
      model text not null,
      reasoning_effort text,
      method text not null check (method in ('selection', 'version', 'fallback')),
      at timestamptz not null default now(),
      primary key (org_id, message_id, seq),
      foreign key (org_id, message_id) references message (org_id, id)
    )
  `.execute(db);
  await appendOnly(db, 'model_resolution');
}
