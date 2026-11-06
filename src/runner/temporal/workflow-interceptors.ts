import { defaultPayloadConverter } from '@temporalio/common';
import type { Headers } from '@temporalio/common';
import type {
  WorkflowInboundCallsInterceptor,
  WorkflowInterceptors,
  WorkflowOutboundCallsInterceptor,
} from '@temporalio/workflow';
import { TRACE_HEADER, TRACE_STATE } from './attributes.ts';

const state = globalThis as { [TRACE_STATE]?: string };

function withTrace(headers: Headers): Headers {
  const id = state[TRACE_STATE];
  if (id === undefined) return headers;
  return { ...headers, [TRACE_HEADER]: defaultPayloadConverter.toPayload(id) };
}

const inbound: WorkflowInboundCallsInterceptor = {
  execute: (input, next) => {
    const header = input.headers[TRACE_HEADER];
    if (header !== undefined) {
      state[TRACE_STATE] = defaultPayloadConverter.fromPayload<string>(header);
    }
    return next(input);
  },
};

const outbound: WorkflowOutboundCallsInterceptor = {
  scheduleActivity: (input, next) =>
    next({ ...input, headers: withTrace(input.headers) }),
  scheduleLocalActivity: (input, next) =>
    next({ ...input, headers: withTrace(input.headers) }),
  startChildWorkflowExecution: (input, next) =>
    next({ ...input, headers: withTrace(input.headers) }),
  continueAsNew: (input, next) =>
    next({ ...input, headers: withTrace(input.headers) }),
};

/** Copies the trace id from the workflow's start onto every call it makes. */
export function interceptors(): WorkflowInterceptors {
  return { inbound: [inbound], outbound: [outbound] };
}
