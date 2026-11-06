import { TRACE_STATE } from './runner/temporal/attributes.ts';

export { ORG_ID_ATTRIBUTE } from './runner/temporal/attributes.ts';

/** The current workflow's trace id. Empty if the workflow was started without one. */
export function workflowTraceId(): string {
  const id = (globalThis as { [TRACE_STATE]?: string })[TRACE_STATE];
  return id ?? '';
}

export * from './runner/temporal/workflow.ts';
