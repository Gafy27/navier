import { sql } from 'kysely';
import type { Kysely } from 'kysely';

/** The only place the six stream fallbacks are written (P6.6 D10). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table org_config
      add column stream_replay_ttl text not null default '24h',
      add column stream_access_recheck text not null default '30s',
      add column stream_poll_hold text not null default '20s',
      add column stream_keepalive text not null default '15s',
      add column stream_max_lifetime text not null default '30m',
      add column max_stream_deltas_per_message integer not null default 100000
  `.execute(db);
}
