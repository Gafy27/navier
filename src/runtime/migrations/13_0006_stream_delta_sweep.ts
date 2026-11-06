import { sql } from 'kysely';
import type { Kysely } from 'kysely';

/** D3: `stream_delta` stays append-only for UPDATE; DELETE only when expired. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`drop trigger if exists stream_delta_append_only on stream_delta`.execute(
    db,
  );
  await sql`
    create function forbid_stream_delta_mutation() returns trigger language plpgsql as $$
    begin
      if tg_op = 'UPDATE' then
        raise exception '% is append-only', tg_table_name;
      end if;
      if old.expires_at >= now() then
        raise exception '% is append-only', tg_table_name;
      end if;
      return old;
    end;
    $$
  `.execute(db);
  await sql`
    create trigger stream_delta_append_only
    before update or delete on stream_delta
    for each row execute function forbid_stream_delta_mutation()
  `.execute(db);
}
