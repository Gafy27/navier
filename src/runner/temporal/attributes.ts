import {
  defineSearchAttributeKey,
  SearchAttributeType,
} from '@temporalio/common';

/** The keyword search attribute that carries the org on every product workflow. */
export const ORG_ID_ATTRIBUTE = defineSearchAttributeKey(
  'OrgId',
  SearchAttributeType.KEYWORD,
);

/** The one header that carries the trace id. */
export const TRACE_HEADER = 'trace-id';

/** Where the workflow interceptors leave the trace id for `workflowTraceId`. */
export const TRACE_STATE = Symbol.for('mastra-agents.trace-id');
