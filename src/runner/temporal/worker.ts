import { fileURLToPath } from 'node:url';
import { NativeConnection, Runtime, Worker } from '@temporalio/worker';
import type { Logger as TemporalLogger } from '@temporalio/common';
import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Logger, Result } from '../../index.ts';
import type { TemporalConfig } from '../../config.ts';
import { activityInterceptors } from './trace.ts';

/** A running worker. `done` settles when it stops; `shutdown` drains and waits for `done`. */
export interface WorkerHandle {
  readonly done: Promise<void>;
  readonly shutdown: () => Promise<void>;
}

export const workflowInterceptorsPath = fileURLToPath(
  new URL('./workflow-interceptors.ts', import.meta.url),
);

function sdkLogger(log: Logger): TemporalLogger {
  const at =
    (level: 'trace' | 'debug' | 'info' | 'warn' | 'error') =>
    (message: string, meta?: Record<string | symbol, unknown>) => {
      log[level]({ ...meta }, message);
    };
  return {
    log: (level, message, meta) => {
      log[level.toLowerCase() as 'info']({ ...meta }, message);
    },
    trace: at('trace'),
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
  };
}

/** Routes Temporal SDK logs through the P1.1 logger. Installed once per process. */
function installRuntime(log: Logger): void {
  try {
    Runtime.instance();
  } catch {
    Runtime.install({ logger: sdkLogger(log) });
  }
}

/**
 * Runs one worker on `TEMPORAL_TASK_QUEUE`. An unreachable server is
 * `unavailable`, never a throw.
 */
export async function startWorker(
  config: TemporalConfig,
  log: Logger,
  workflowsPath: string,
  activities: object,
): Promise<Result<WorkerHandle>> {
  installRuntime(log);
  let connection: NativeConnection;
  try {
    connection = await NativeConnection.connect({
      address: config.TEMPORAL_ADDRESS,
    });
  } catch (cause) {
    log.warn({ err: cause }, 'temporal unreachable');
    return err(
      appError(ErrorCode.unavailable, 'temporal is unreachable', cause),
    );
  }
  const worker = await Worker.create({
    connection,
    namespace: config.TEMPORAL_NAMESPACE,
    taskQueue: config.TEMPORAL_TASK_QUEUE,
    workflowsPath,
    activities,
    interceptors: {
      workflowModules: [workflowInterceptorsPath],
      activity: [activityInterceptors(log)],
    },
  });
  const done = worker
    .run()
    .catch((cause: unknown) => {
      log.error({ err: cause }, 'worker stopped on error');
    })
    .finally(() => connection.close());
  return ok({
    done,
    shutdown: async () => {
      if (worker.getState() === 'RUNNING') worker.shutdown();
      await done;
    },
  });
}
