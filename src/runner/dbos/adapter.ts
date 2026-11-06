import { DBOS } from '@dbos-inc/dbos-sdk';
import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Result } from '../../index.ts';
import { TERMINAL_STATUSES, type MessageStatus } from '../../runtime/status.ts';
import { turnWorkflowId } from '../../runtime/workflow-id.ts';
import type { TurnRef, TurnRunner } from '../types.ts';

/** The slice of `DBOS` the adapter reads; tests pass a double. */
export interface DbosReader {
  isInitialized(): boolean;
  getEvent(
    id: string,
    key: string,
    opts: { timeoutSeconds: number },
  ): Promise<unknown>;
  result(id: string): Promise<unknown>;
  shutdown(): Promise<void>;
}

/** The writes other units own: start (P2.5), stop wake (P2.3), decision wake (P2.4). */
export type DbosRunnerWrites = Pick<
  TurnRunner,
  'start' | 'wakeStop' | 'wakeDecision'
>;

export const EVENT_POLL_SECONDS = 1;

const realReader: DbosReader = {
  isInitialized: () => DBOS.isInitialized(),
  getEvent: (id, key, opts) => DBOS.getEvent(id, key, opts),
  result: (id) => DBOS.retrieveWorkflow(id).getResult(),
  shutdown: () => DBOS.shutdown(),
};

const terminalStatus = new Set<string>(TERMINAL_STATUSES);

const isTerminalStatus = (v: unknown): v is MessageStatus =>
  typeof v === 'string' && terminalStatus.has(v);

const aborted = (signal: AbortSignal): Promise<'aborted'> =>
  new Promise((resolve) => {
    if (signal.aborted) resolve('aborted');
    signal.addEventListener(
      'abort',
      () => {
        resolve('aborted');
      },
      { once: true },
    );
  });

/** PD2: `getEvent(status)` until the turn is neither created nor paused, then the workflow result. */
async function awaitEnd(
  dbos: DbosReader,
  ref: TurnRef,
  signal: AbortSignal,
): Promise<Result<MessageStatus>> {
  const id = turnWorkflowId(ref.org, ref.threadId, ref.agentMessageId);
  try {
    for (;;) {
      if (signal.aborted)
        return err(appError(ErrorCode.aborted, 'await aborted'));
      const seen = await Promise.race([
        dbos.getEvent(id, 'status', { timeoutSeconds: EVENT_POLL_SECONDS }),
        aborted(signal),
      ]);
      if (seen === 'aborted') {
        return err(appError(ErrorCode.aborted, 'await aborted'));
      }
      if (isTerminalStatus(seen)) {
        break;
      }
    }
    const final = await dbos.result(id);
    return isTerminalStatus(final)
      ? ok(final)
      : err(appError(ErrorCode.internal, 'turn result is not a status'));
  } catch (e) {
    return err(appError(ErrorCode.unavailable, 'turn await failed', e));
  }
}

/**
 * DBOS behind `TurnRunner`. Writes are injected: they belong to P2.5, P2.3 and
 * P2.4. `close` shuts DBOS down (P6.1 owns the call order).
 */
export function createDbosRunner(
  writes: DbosRunnerWrites,
  dbos: DbosReader = realReader,
): TurnRunner {
  return {
    name: 'dbos',
    ...writes,
    awaitEnd: (ref, signal) => awaitEnd(dbos, ref, signal),
    probe: () => ({
      name: 'dbos',
      check: (signal) =>
        Promise.resolve(!signal.aborted && dbos.isInitialized()),
    }),
    close: () => dbos.shutdown(),
  };
}
