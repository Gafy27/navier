import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Context } from '@temporalio/activity';
import { defaultPayloadConverter } from '@temporalio/common';
import type { Headers } from '@temporalio/common';
import type { WorkflowClientInterceptor } from '@temporalio/client';
import type { ActivityInterceptorsFactory } from '@temporalio/worker';
import type { Logger } from '../../index.ts';
import { TRACE_HEADER } from './attributes.ts';

const scope = new AsyncLocalStorage<string>();
const activityScope = new AsyncLocalStorage<{
  traceId: string;
  logger: Logger;
}>();

/** Runs `fn` with `traceId` in scope. Workflows started inside it carry that id. */
export function withTraceId<T>(traceId: string, fn: () => T): T {
  return scope.run(traceId, fn);
}

function withHeader(headers: Headers): Headers {
  const id = scope.getStore() ?? randomUUID();
  return { ...headers, [TRACE_HEADER]: defaultPayloadConverter.toPayload(id) };
}

/** Client side: writes the scope's trace id, or a fresh one, on every start. */
export const clientInterceptor: WorkflowClientInterceptor = {
  startWithDetails: (input, next) =>
    next({ ...input, headers: withHeader(input.headers) }),
  signalWithStart: (input, next) =>
    next({ ...input, headers: withHeader(input.headers) }),
};

/** Activity side: puts the trace id and a bound logger in scope for the activity. */
export function activityInterceptors(log: Logger): ActivityInterceptorsFactory {
  return () => ({
    inbound: {
      execute: (input, next) => {
        const header = input.headers[TRACE_HEADER];
        const traceId =
          header === undefined
            ? ''
            : defaultPayloadConverter.fromPayload<string>(header);
        return activityScope.run(
          { traceId, logger: log.child({ trace_id: traceId }) },
          () => next(input),
        );
      },
    },
  });
}

/**
 * Inside an activity: the trace id, a logger bound to it, the Temporal attempt
 * (from 1), and the activity's cancellation signal. Elsewhere it throws.
 */
export function activityContext(): {
  readonly traceId: string;
  readonly logger: Logger;
  readonly attempt: number;
  readonly signal: AbortSignal;
} {
  const store = activityScope.getStore();
  if (store === undefined) {
    throw new Error('activityContext called outside an activity');
  }
  const current = Context.current();
  return {
    ...store,
    attempt: current.info.attempt,
    signal: current.cancellationSignal,
  };
}
