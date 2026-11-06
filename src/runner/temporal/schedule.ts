import {
  ScheduleAlreadyRunning,
  ScheduleOverlapPolicy,
} from '@temporalio/client';
import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Result } from '../../index.ts';
import type { TemporalConfig, TemporalHandle } from './index.ts';
import type { RuntimeConfig } from '../../runtime/config.ts';
import type { ReaperWorkflowInput } from '../../runtime/workflow-types.ts';

export const REAPER_SCHEDULE_ID = 'reaper';
const REAPER_WORKFLOW_NAME = 'reaperWorkflow';

/**
 * D1: creates the schedule `reaper` on the configured task queue, or rewrites
 * its interval and argument when it exists. Overlap SKIP. The argument carries
 * the timeouts, so the workflow holds no literal.
 */
export async function ensureReaperSchedule(
  temporal: TemporalHandle,
  config: TemporalConfig & RuntimeConfig,
): Promise<Result<void>> {
  const input: ReaperWorkflowInput = {
    storeCallTimeoutMs: config.STORE_CALL_TIMEOUT_MS,
    sweepTimeoutMs: config.REAPER_INTERVAL_MS,
  };
  const spec = { intervals: [{ every: config.REAPER_INTERVAL_MS }] };
  const action = {
    type: 'startWorkflow',
    workflowType: REAPER_WORKFLOW_NAME,
    taskQueue: config.TEMPORAL_TASK_QUEUE,
    args: [input],
  } as const;
  const policies = { overlap: ScheduleOverlapPolicy.SKIP };

  try {
    await temporal.client.schedule.create({
      scheduleId: REAPER_SCHEDULE_ID,
      spec,
      action,
      policies,
    });
  } catch (e) {
    if (!(e instanceof ScheduleAlreadyRunning)) {
      return err(appError(ErrorCode.unavailable, 'reaper schedule', e));
    }
    try {
      await temporal.client.schedule
        .getHandle(REAPER_SCHEDULE_ID)
        .update((previous) => ({ ...previous, spec, action, policies }));
    } catch (cause) {
      return err(appError(ErrorCode.unavailable, 'reaper schedule', cause));
    }
  }
  return ok(undefined);
}
