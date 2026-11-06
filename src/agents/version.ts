import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import type { Db, OrgId } from '../db/index.ts';
import { agentPrincipalId } from '../identity/index.ts';
import type { PrincipalId } from '../identity/index.ts';
import { parseStoredDefinition } from './document.ts';
import type { AgentDefinition } from './document.ts';
import type { Reader } from './head.ts';
import { agentsView } from './tables.ts';

export interface VersionRecord {
  readonly number: number;
  readonly definition: Record<string, unknown>;
  readonly hash: string;
  readonly authorId: string;
  readonly createdAt: Date;
}

export function toVersion(row: {
  version: number;
  definition: Record<string, unknown>;
  definition_hash: string;
  author_id: string;
  created_at: Date;
}): VersionRecord {
  return {
    number: row.version,
    definition: row.definition,
    hash: row.definition_hash,
    authorId: row.author_id,
    createdAt: row.created_at,
  };
}

/** One version row, with no authz. `not_found` `version not found` when absent. */
export async function readVersion(
  q: Reader,
  org: OrgId,
  agentId: string,
  version: number,
): Promise<Result<VersionRecord>> {
  const row = await q
    .selectFrom('agent_version')
    .selectAll()
    .where('org_id', '=', org)
    .where('agent_id', '=', agentId)
    .where('version', '=', version)
    .executeTakeFirst();
  if (row === undefined) {
    return err(appError(ErrorCode.not_found, 'version not found'));
  }
  return ok(toVersion(row));
}

/**
 * One stored version and the agent's principal. No authz: the runtime loads
 * only a version a message pinned after `CheckAgentUse` passed at post (see
 * `useAgent`). A version is immutable, so an archived agent's version still loads.
 */
export async function loadVersion(
  db: Db,
  org: OrgId,
  agentId: string,
  version: number,
): Promise<
  Result<{
    readonly definition: AgentDefinition;
    readonly principal: PrincipalId;
  }>
> {
  const row = await agentsView(db)
    .selectFrom('agent_version')
    .select('definition')
    .where('org_id', '=', org)
    .where('agent_id', '=', agentId)
    .where('version', '=', version)
    .executeTakeFirst();
  if (row === undefined) {
    return err(appError(ErrorCode.not_found, 'version not found'));
  }
  const definition = parseStoredDefinition(row.definition);
  if (!definition.ok) {
    return err(appError(ErrorCode.internal, 'stored version is invalid'));
  }
  const principal = agentPrincipalId(org, agentId);
  if (!principal.ok) return principal;
  return ok({ definition: definition.value, principal: principal.value });
}
