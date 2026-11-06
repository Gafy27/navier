import type { Result } from '../index.ts';
import type { OrgId, ReadinessProbe, Tx } from '../db/index.ts';
import type { MessageStatus } from '../runtime/status.ts';

/** Ids only: the same input a runner gives a workflow. No text, context, arguments or outputs. */
export interface TurnRef {
  readonly org: OrgId;
  readonly threadId: string;
  readonly agentMessageId: string;
  readonly traceId?: string;
}

/** The kinds of stop a runner can wake a turn for. */
export const StopWake = {
  cancel: 'cancel',
  interrupt: 'interrupt',
  graceful: 'graceful',
} as const;

export type StopWake = (typeof StopWake)[keyof typeof StopWake];

/**
 * The six things domain code asks of a runner (P1.1 D1). Every write takes the
 * caller's transaction (D3). Every operation is idempotent per workflow id.
 */
export interface TurnRunner {
  readonly name: 'dbos' | 'temporal';
  start(tx: Tx, ref: TurnRef): Promise<Result<void>>;
  wakeStop(tx: Tx, ref: TurnRef, kind: StopWake): Promise<Result<void>>;
  wakeDecision(tx: Tx, ref: TurnRef, key: string): Promise<Result<void>>;
  awaitEnd(ref: TurnRef, signal: AbortSignal): Promise<Result<MessageStatus>>;
  probe(): ReadinessProbe;
  close(): Promise<void>;
}
