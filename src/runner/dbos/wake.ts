import { sql } from 'kysely';
import { appError, err, ErrorCode, ok, z } from '../../index.ts';
import type { Tx } from '../../db/index.ts';
import { turnWorkflowId } from '../../runtime/workflow-id.ts';
import { StopWake } from '../types.ts';
import type { TurnRunner } from '../types.ts';

/** PD1: the DBOS topic a waiting turn receives on and the NOTIFY channel workers LISTEN on. */
export const WakeConfigSchema = z.object({
  topic: z.string().min(1).default('turn'),
  stopChannel: z.string().min(1).default('navier_turn_stop'),
});

const WAKE = WakeConfigSchema.parse({});

export const STOP_CHANNEL = WAKE.stopChannel;

export const TurnMessageKindSchema = z.enum(['stop', 'resume']);

/** L2: the message is ids-free and text-free; the kind is all it says. */
const TurnMessageSchema = z.object({ kind: TurnMessageKindSchema });

export type TurnMessageKind = z.infer<typeof TurnMessageKindSchema>;

/**
 * D1, PD1: inside the caller's transaction, `dbos.send_message` wakes a turn in
 * `recv`, and for a stop `pg_notify` wakes a worker's hub on commit. A rollback
 * delivers neither. DBOS keeps `message_uuid` unique across workflows, so the
 * workflow id prefixes the caller's key.
 */
export async function sendTurnMessage(
  tx: Tx,
  workflowId: string,
  kind: TurnMessageKind,
  idempotencyKey: string,
): Promise<void> {
  const message = JSON.stringify(TurnMessageSchema.parse({ kind }));
  const messageId = `${workflowId}:${idempotencyKey}`;
  await sql`
    select dbos.send_message(
      ${workflowId}, ${message}::json, ${WAKE.topic}, ${messageId}
    )
  `.execute(tx);
  if (kind === TurnMessageKindSchema.enum.stop) {
    await sql`select pg_notify(${WAKE.stopChannel}, ${workflowId})`.execute(tx);
  }
}

/**
 * The DBOS `TurnRunner.wakeStop` (D1). `graceful` needs no wake: it acts only at
 * a boundary (D3). A failure is `unavailable`, so the caller rolls back the stop row.
 */
export const wakeStop: TurnRunner['wakeStop'] = async (tx, ref, kind) => {
  if (kind === StopWake.graceful) return ok(undefined);
  const workflowId = turnWorkflowId(ref.org, ref.threadId, ref.agentMessageId);
  try {
    await sendTurnMessage(
      tx,
      workflowId,
      TurnMessageKindSchema.enum.stop,
      `${TurnMessageKindSchema.enum.stop}:${kind}`,
    );
    return ok(undefined);
  } catch (e) {
    return err(appError(ErrorCode.unavailable, 'stop signal not sent', e));
  }
};
