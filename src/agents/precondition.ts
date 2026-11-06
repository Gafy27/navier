import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { withTables } from '../db/index.ts';
import type { OrgId, Tx } from '../db/index.ts';
import { AgentStatus, newestHead } from './head.ts';
import type { AgentsTables } from './tables.ts';

/**
 * `ok` when the agent is active and `version` is its active version.
 * No authz: the caller runs `useAgent` (CheckAgentUse) first.
 */
export async function assertAcceptsNewMessage(
  tx: Tx,
  org: OrgId,
  id: string,
  version: number,
): Promise<Result<void>> {
  const head = await newestHead(withTables<AgentsTables>(tx), org, id);
  if (head === undefined) {
    return err(appError(ErrorCode.not_found, 'agent not found'));
  }
  if (head.status === AgentStatus.archived) {
    return err(appError(ErrorCode.invalid_argument, 'agent_archived'));
  }
  if (head.activeVersion !== version) {
    return err(appError(ErrorCode.invalid_argument, 'version is not active'));
  }
  return ok(undefined);
}
