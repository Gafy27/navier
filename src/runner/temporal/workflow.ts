import {
  defineSignal,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';
import { newStop, recordStop, runTurn } from './turn-loop.ts';
import type {
  ReaperActivities,
  ReaperWorkflowInput,
  StreamSweepActivities,
  StreamSweepWorkflowInput,
  TurnWorkflowInput,
} from '../../runtime/workflow-types.ts';

export type {
  ReaperWorkflowInput,
  TurnWorkflowInput,
} from '../../runtime/workflow-types.ts';

export const cancelSignal = defineSignal('cancel');
export const gracefulStopSignal = defineSignal('graceful_stop');
export const interruptSignal = defineSignal('interrupt');

/** One agent message as one workflow (D4). */
export async function turnWorkflow(input: TurnWorkflowInput): Promise<void> {
  const stop = newStop();
  setHandler(cancelSignal, () => {
    recordStop(stop, 'cancel');
  });
  setHandler(gracefulStopSignal, () => {
    recordStop(stop, 'graceful_stop');
  });
  setHandler(interruptSignal, () => {
    recordStop(stop, 'interrupt');
  });
  await runTurn(input, stop);
}

/** One reaper sweep (P4.5 D1). Both bounds come from the schedule's argument. */
export async function reaperWorkflow(
  input: ReaperWorkflowInput,
): Promise<void> {
  const { sweep } = proxyActivities<ReaperActivities>({
    startToCloseTimeout: input.sweepTimeoutMs,
    scheduleToCloseTimeout: input.sweepTimeoutMs,
  });
  await sweep({ storeCallTimeoutMs: input.storeCallTimeoutMs });
}

/** One stream-delta TTL sweep (D3). The timeout comes from the schedule argument. */
export async function streamSweepWorkflow(
  input: StreamSweepWorkflowInput,
): Promise<void> {
  const { sweepStreamDeltas } = proxyActivities<StreamSweepActivities>({
    startToCloseTimeout: input.sweepTimeoutMs,
    scheduleToCloseTimeout: input.sweepTimeoutMs,
  });
  await sweepStreamDeltas();
}
