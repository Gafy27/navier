import { sql } from 'kysely';
import type { Kysely } from 'kysely';

/** `before update or delete` trigger calling `forbid_mutation` on `table`. */
export async function appendOnly(
  db: Kysely<unknown>,
  table: string,
): Promise<void> {
  await sql`
    create trigger ${sql.id(`${table}_append_only`)}
    before update or delete on ${sql.id(table)}
    for each row execute function forbid_mutation()
  `.execute(db);
}
