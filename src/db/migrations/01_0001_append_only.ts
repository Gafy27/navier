import { sql } from 'kysely';
import type { Kysely } from 'kysely';

// The trigger function every append-only table attaches.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create function forbid_mutation() returns trigger language plpgsql as $$
    begin
      raise exception '% is append-only', tg_table_name;
    end;
    $$
  `.execute(db);
}
