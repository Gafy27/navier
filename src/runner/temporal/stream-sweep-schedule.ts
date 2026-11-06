import {
  ScheduleAlreadyRunning,
  ScheduleOverlapPolicy,
} from '@temporalio/client';
import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Result } from '../../index.ts';
import type { RuntimeConfig } from '../../runtime/config.ts';
import type { StreamSweepWorkflowInput } from '../../runtime/workflow-types.ts';
import type { TemporalConfig, TemporalHandle } from './index.ts';

export const STREAM_SWEEP_SCHEDULE_ID = 'stream-sweep';
const STREAM_SWEEP_WORKFLOW_NAME = 'streamSweepWorkflow';

export async function ensureStreamSweepSchedule(
  temporal: TemporalHandle,
  config: TemporalConfig & RuntimeConfig,
): Promise<Result<void>> {
  const input: StreamSweepWorkflowInput = {
    sweepTimeoutMs: config.STREAM_SWEEP_INTERVAL_MS,
  };
  const spec = { intervals: [{ every: config.STREAM_SWEEP_INTERVAL_MS }] };
  const action = {
    type: 'startWorkflow',
    workflowType: STREAM_SWEEP_WORKFLOW_NAME,
    taskQueue: config.TEMPORAL_TASK_QUEUE,
    args: [input],
  } as const;
  const policies = { overlap: ScheduleOverlapPolicy.SKIP };

  try {
    await temporal.client.schedule.create({
      scheduleId: STREAM_SWEEP_SCHEDULE_ID,
      spec,
      action,
      policies,
    });
  } catch (e) {
    if (!(e instanceof ScheduleAlreadyRunning)) {
      return err(appError(ErrorCode.unavailable, 'stream sweep schedule', e));
    }
    try {
      await temporal.client.schedule
        .getHandle(STREAM_SWEEP_SCHEDULE_ID)
        .update((previous) => ({ ...previous, spec, action, policies }));
    } catch (cause) {
      return err(
        appError(ErrorCode.unavailable, 'stream sweep schedule', cause),
      );
    }
  }
  return ok(undefined);
}
