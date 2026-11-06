import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { appendOnly } from './append-only.ts';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table action_decision (
      org_id text not null,
      action_id text not null,
      blocked_seq integer not null,
      verdict text not null check (verdict in ('approve', 'deny')),
      remember boolean not null,
      decided_by text not null,
      at timestamptz not null default now(),
      primary key (org_id, action_id, blocked_seq)
    )
  `.execute(db);
  await appendOnly(db, 'action_decision');
}
