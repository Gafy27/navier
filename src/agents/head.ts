import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import type { OrgId } from '../db/index.ts';
import { agentPrincipalId, DenyReason } from '../identity/index.ts';
import type { Authz, Caller, PrincipalId } from '../identity/index.ts';
import { agentsView } from './tables.ts';

/** The closed set of agent statuses. */
export const AgentStatus = {
  active: 'active',
  archived: 'archived',
} as const;

export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export interface AgentRecord {
  readonly org: OrgId;
  readonly id: string;
  readonly principal: PrincipalId;
  readonly status: AgentStatus;
  readonly activeVersion: number;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export type Reader = ReturnType<typeof agentsView>;

export interface Head {
  readonly seq: number;
  readonly activeVersion: number;
  readonly status: AgentStatus;
}

/** The newest head row, or `undefined` when the org has no such agent. */
export async function newestHead(
  q: Reader,
  org: OrgId,
  id: string,
): Promise<Head | undefined> {
  const row = await q
    .selectFrom('agent_head')
    .select(['seq', 'active_version', 'status'])
    .where('org_id', '=', org)
    .where('agent_id', '=', id)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (row === undefined) return undefined;
  return {
    seq: row.seq,
    activeVersion: row.active_version,
    status: row.status as AgentStatus,
  };
}

/** The agent row plus its newest head. */
export async function loadRecord(
  q: Reader,
  org: OrgId,
  id: string,
): Promise<Result<AgentRecord>> {
  const head = await newestHead(q, org, id);
  const row = await q
    .selectFrom('agent')
    .select(['created_by', 'created_at'])
    .where('org_id', '=', org)
    .where('id', '=', id)
    .executeTakeFirst();
  if (head === undefined || row === undefined) {
    return err(appError(ErrorCode.not_found, 'agent not found'));
  }
  const principal = agentPrincipalId(org, id);
  if (!principal.ok) return principal;
  return ok({
    org,
    id,
    principal: principal.value,
    status: head.status,
    activeVersion: head.activeVersion,
    createdBy: row.created_by,
    createdAt: row.created_at,
  });
}

/**
 * `ok(true)` on allow, `ok(false)` on a deny, `err` when the caller token is
 * rejected or authz-api cannot answer. Fails closed.
 */
export async function holds(
  authz: Authz,
  org: OrgId,
  caller: Caller,
  scope: string,
): Promise<Result<boolean>> {
  const decision = await authz.check(org, caller, scope);
  if (!decision.ok) return decision;
  if (decision.value.allow) return ok(true);
  if (decision.value.reason === DenyReason.unavailable) {
    return err(appError(ErrorCode.unavailable, 'authz-api unavailable'));
  }
  return ok(false);
}

/** `ok` when `scope` is held, else `permission_denied` naming it. */
export async function requireScope(
  authz: Authz,
  org: OrgId,
  caller: Caller,
  scope: string,
): Promise<Result<void>> {
  const held = await holds(authz, org, caller, scope);
  if (!held.ok) return held;
  if (held.value) return ok(undefined);
  return err(appError(ErrorCode.permission_denied, `missing ${scope}`));
}
