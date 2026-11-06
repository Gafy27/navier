import { sql } from 'kysely';
import type { Kysely } from 'kysely';

/** C2: names and list candidates, one append-only stream per `(org, type, id)`. No grant column. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table api_directory (
      org_id text not null,
      type text not null,
      id text not null,
      seq integer not null check (seq >= 1),
      name text not null,
      at timestamptz not null default now(),
      primary key (org_id, type, id, seq)
    )
  `.execute(db);
  await sql`
    create trigger api_directory_append_only
    before update or delete on api_directory
    for each row execute function forbid_mutation()
  `.execute(db);
}
