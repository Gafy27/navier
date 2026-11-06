import { sql } from 'kysely';
import type { OrgId, Tx } from '../db/index.ts';

/**
 * PD1: the conversation lock, one per `(org, thread)`. Take it as the first
 * statement of a `Tx`; it is held to commit or rollback. A hash collision of two
 * threads only serializes them.
 */
export async function lockConversation(
  tx: Tx,
  org: OrgId,
  threadId: string,
): Promise<void> {
  await sql`select pg_advisory_xact_lock(
    hashtextextended(${org}::text || chr(31) || ${threadId}::text, 0)
  )`.execute(tx);
}
