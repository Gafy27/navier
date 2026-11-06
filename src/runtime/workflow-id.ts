import type { OrgId } from '../db/index.ts';

/** `turn~<org>~<threadId>~<agentMessageId>` (D1). */
export function turnWorkflowId(
  org: OrgId,
  threadId: string,
  agentMessageId: string,
): string {
  return `turn~${org}~${threadId}~${agentMessageId}`;
}
