import { DBOS } from '@dbos-inc/dbos-sdk';
import type { MessageStatus } from '../../runtime/status.ts';
import { TURN_QUEUE, type TurnQueueOptions } from './queue.ts';

export const TURN_WORKFLOW_NAME = 'navier.turn';

/** The slice of `DBOS` this file touches; tests pass a double. */
export interface DbosRegistry {
  isInitialized(): boolean;
  registerWorkflow<I>(
    fn: TurnWorkflowFn<I>,
    config: { name: string },
  ): TurnWorkflowFn<I>;
  registerQueue(name: string, options: TurnQueueOptions): Promise<unknown>;
}

// Generic over the input: `DbosTurnInput` lands in workflow.ts (ticket 2), outside this fence.
export type TurnWorkflowFn<I = never> = (input: I) => Promise<MessageStatus>;

/** Before `DBOS.launch()` (PD1). Throws when called after launch. */
export function registerTurnWorkflow<I>(
  workflowFn: TurnWorkflowFn<I>,
  dbos: DbosRegistry = DBOS,
): TurnWorkflowFn<I> {
  if (dbos.isInitialized())
    throw new Error('registerTurnWorkflow must run before DBOS.launch()');
  return dbos.registerWorkflow(workflowFn, { name: TURN_WORKFLOW_NAME });
}

/**
 * After `DBOS.launch()` (PD1). SDK 5.4.0 rejects before launch; failure is fatal to
 * resource `open` (gate Q2 → A), never swallowed.
 */
export async function registerTurnQueue(
  opts: { workerConcurrency: number },
  dbos: DbosRegistry = DBOS,
): Promise<void> {
  if (!dbos.isInitialized())
    throw new Error('registerTurnQueue must run after DBOS.launch()');
  await dbos.registerQueue(TURN_QUEUE, {
    workerConcurrency: opts.workerConcurrency,
    partitionConcurrency: 1,
    onConflict: 'update_if_latest_version',
  });
}
