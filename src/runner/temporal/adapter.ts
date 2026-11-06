import {
  WorkflowExecutionAlreadyStartedError,
  WorkflowNotFoundError,
} from '@temporalio/client';
import type { WorkflowStartOptions } from '@temporalio/client';
import { setTimeout as sleep } from 'node:timers/promises';
import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Result } from '../../index.ts';
import type { OrgId } from '../../db/index.ts';
import { ORG_ID_ATTRIBUTE, temporalProbe, withTraceId } from './index.ts';
import type { TemporalHandle } from './index.ts';
import type { MessageStatus } from '../../runtime/status.ts';
import { turnWorkflowId } from '../../runtime/workflow-id.ts';
import type { TurnWorkflowInput } from '../../runtime/workflow-types.ts';
import type { StopWake, TurnRef, TurnRunner } from '../types.ts';
import { z } from '../../index.ts';
import { CoreConfigSchema } from '../../config.ts';
import { RuntimeConfigSchema } from '../../runtime/config.ts';

export const WORKFLOW_NAME = 'turnWorkflow';

/** The refusal message of a start that finds a live run. The domain names it `already_running`. */
export const ALREADY_RUNNING = 'already_running';

/** The config the Temporal runner reads. A `StartConfig` satisfies this schema. */
export const TemporalRunnerConfigSchema = RuntimeConfigSchema.pick({
  MODEL_CALL_TIMEOUT_MS: true,
  MODEL_ATTEMPTS: true,
  TOOL_CALL_TIMEOUT_MS: true,
  STORE_CALL_TIMEOUT_MS: true,
}).extend({
  TEMPORAL_TASK_QUEUE: z.string().min(1),
  START_GRACE_MS: CoreConfigSchema.shape.START_GRACE_MS,
  MAX_HISTORY_LENGTH: CoreConfigSchema.shape.MAX_HISTORY_LENGTH,
});

export type TemporalRunnerConfig = z.infer<typeof TemporalRunnerConfigSchema>;

const STOP_SIGNAL: Record<StopWake, string> = {
  cancel: 'cancel',
  interrupt: 'interrupt',
  graceful: 'graceful_stop',
};

export interface TemporalRunnerDeps {
  readonly config: TemporalRunnerConfig;
  /** The newest status of the turn's agent message, read from the rows. */
  readonly readStatus: (ref: TurnRef) => Promise<Result<MessageStatus>>;
}

/**
 * The one set of start options (D1, D3). Fails on a running execution, allows
 * reuse after close, and sets the org attribute. Also used by the reaper (P4.5).
 */
export function turnStartOptions(
  org: OrgId,
  ids: { readonly threadId: string; readonly agentMessageId: string },
  config: TemporalRunnerConfig,
): WorkflowStartOptions {
  const input: TurnWorkflowInput = {
    org,
    threadId: ids.threadId,
    agentMessageId: ids.agentMessageId,
    service: {
      modelCallTimeoutMs: config.MODEL_CALL_TIMEOUT_MS,
      modelAttempts: config.MODEL_ATTEMPTS,
      toolCallTimeoutMs: config.TOOL_CALL_TIMEOUT_MS,
      storeCallTimeoutMs: config.STORE_CALL_TIMEOUT_MS,
      ...(config.MAX_HISTORY_LENGTH === undefined
        ? {}
        : { maxHistoryLength: config.MAX_HISTORY_LENGTH }),
    },
  };
  return {
    taskQueue: config.TEMPORAL_TASK_QUEUE,
    workflowId: turnWorkflowId(org, ids.threadId, ids.agentMessageId),
    workflowIdConflictPolicy: 'FAIL',
    workflowIdReusePolicy: 'ALLOW_DUPLICATE',
    typedSearchAttributes: [{ key: ORG_ID_ATTRIBUTE, value: org }],
    args: [input],
  };
}

/** Waits `ms`, or until `cancel` fires. Never rejects. */
const pause = (ms: number, cancel: AbortSignal): Promise<void> =>
  sleep(ms, undefined, { signal: cancel }).catch(() => undefined);

const untilAbort = (signal: AbortSignal): Promise<void> =>
  signal.aborted
    ? Promise.resolve()
    : new Promise((resolve) => {
        signal.addEventListener(
          'abort',
          () => {
            resolve();
          },
          { once: true },
        );
      });

/**
 * Temporal behind `TurnRunner` with the calls the domain made inline before
 * P1.2 (D3). Temporal calls are not transactional, so `tx` is accepted and unused.
 */
export function createTemporalRunner(
  handle: TemporalHandle,
  deps: TemporalRunnerDeps,
): TurnRunner {
  const { config } = deps;
  const workflow = (ref: TurnRef) =>
    handle.client.workflow.getHandle(
      turnWorkflowId(ref.org, ref.threadId, ref.agentMessageId),
    );

  /** `already_exists` on a live run; `unavailable` on any other failure. */
  const startWorkflow = async (ref: TurnRef): Promise<Result<void>> => {
    try {
      const options = turnStartOptions(ref.org, ref, config);
      const start = () => handle.client.workflow.start(WORKFLOW_NAME, options);
      await (ref.traceId === undefined
        ? start()
        : withTraceId(ref.traceId, start));
      return ok(undefined);
    } catch (e) {
      if (e instanceof WorkflowExecutionAlreadyStartedError) {
        return err(appError(ErrorCode.already_exists, ALREADY_RUNNING));
      }
      return err(appError(ErrorCode.unavailable, 'turn start failed', e));
    }
  };

  return {
    name: 'temporal',
    start: (_tx, ref) => startWorkflow(ref),
    wakeStop: async (_tx, ref, kind) => {
      try {
        await workflow(ref).signal(STOP_SIGNAL[kind]);
        return ok(undefined);
      } catch (e) {
        if (e instanceof WorkflowNotFoundError) {
          return err(appError(ErrorCode.not_found, 'workflow not found'));
        }
        return err(appError(ErrorCode.unavailable, 'stop signal not sent', e));
      }
    },
    // A decision restarts the paused turn's workflow; a live run needs nothing.
    wakeDecision: async (_tx, ref) => {
      const started = await startWorkflow(ref);
      return !started.ok && started.error.code === ErrorCode.already_exists
        ? ok(undefined)
        : started;
    },
    awaitEnd: async (ref, signal) => {
      const stopGrace = new AbortController();
      const onAbort = () => {
        stopGrace.abort();
      };
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
      try {
        await Promise.race([
          untilAbort(signal),
          workflow(ref)
            .result()
            .then(
              () => undefined,
              async (e: unknown) => {
                if (e instanceof WorkflowNotFoundError) {
                  await pause(config.START_GRACE_MS, stopGrace.signal);
                }
              },
            ),
        ]);
      } finally {
        signal.removeEventListener('abort', onAbort);
        stopGrace.abort();
      }
      if (signal.aborted) {
        return err(appError(ErrorCode.aborted, 'await aborted'));
      }
      return deps.readStatus(ref);
    },
    probe: () => temporalProbe(handle),
    close: () => handle.close(),
  };
}
