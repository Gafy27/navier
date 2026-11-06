import { sql } from 'kysely';
import type { Tx } from '../db/index.ts';
import { turnWorkflowId } from '../runtime/workflow-id.ts';
import type { TurnRef, TurnRunner } from './types.ts';

/**
 * Which runner owns a turn (P1.1 D4): DBOS iff `dbos.workflow_status` has a row
 * with the turn's workflow id, else Temporal. One read on the DBOS primary key,
 * inside the caller's transaction, never cached (PD2). A database failure throws.
 */
export async function ownerOf(
  tx: Tx,
  ref: TurnRef,
): Promise<TurnRunner['name']> {
  const id = turnWorkflowId(ref.org, ref.threadId, ref.agentMessageId);
  const { rows } = await sql`
    select 1 from dbos.workflow_status where workflow_uuid = ${id}
  `.execute(tx);
  return rows.length > 0 ? 'dbos' : 'temporal';
}
