import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { withTables, writeAudit } from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import { IDENTITY_AUDIT } from './audit-kinds.ts';
import { parsePrincipalId, PrincipalKind } from './principal.ts';
import type { Principal, PrincipalId } from './principal.ts';
import { formatScope, parseScope } from './scope.ts';
import type { Scope } from './scope.ts';
import { identityView } from './tables.ts';
import type { IdentityTables } from './tables.ts';

export interface ScopeRequest {
  readonly id: string;
  readonly org: OrgId;
  readonly agent: PrincipalId;
  readonly text: string;
  /** `null` exactly when `text` is a retired scope (D2). */
  readonly scope: Scope | null;
  readonly requestedBy: PrincipalId;
  readonly at: Date;
}

const AGENT_PREFIX = `${PrincipalKind.agent}:`;

/** Stored request text that no longer parses on purpose (D2). Nothing checks it. */
const RETIRED_PREFIXES: readonly string[] = Object.freeze(['agent:execute:']);

const isRetired = (text: string): boolean =>
  RETIRED_PREFIXES.some((prefix) => text.startsWith(prefix));

/**
 * Records a request row for each scope not already requested by `agent`, with
 * one audit row each, in `tx`. It grants nothing. Returns the scopes newly recorded.
 */
export async function requestGrant(
  tx: Tx,
  org: OrgId,
  agent: PrincipalId,
  scopes: Scope[],
  requestedBy: Principal,
): Promise<Result<Scope[]>> {
  if (!agent.startsWith(AGENT_PREFIX)) {
    return err(appError(ErrorCode.invalid_argument, 'agent must be an agent'));
  }
  const recorded: Scope[] = [];
  for (const scope of scopes) {
    const text = formatScope(scope);
    const row = await withTables<IdentityTables>(tx)
      .insertInto('scope_request')
      .values({
        org_id: org,
        principal_id: agent,
        scope: text,
        requested_by: requestedBy.id,
      })
      .onConflict((oc) => oc.doNothing())
      .returning('id')
      .executeTakeFirst();
    if (row === undefined) continue;
    const audited = await writeAudit(tx, org, {
      kind: IDENTITY_AUDIT.scopeRequested,
      actor: { kind: requestedBy.kind, id: requestedBy.id },
      target: { kind: 'scope_request', id: `${agent}#${text}` },
    });
    if (!audited.ok) return audited;
    recorded.push(scope);
  }
  return ok(recorded);
}

/** Returns at most `limit` of the agent's requests after the id `after`, in insert order. */
export async function listScopeRequests(
  db: Db,
  org: OrgId,
  agent: PrincipalId,
  limit: number,
  after?: string,
): Promise<Result<ScopeRequest[]>> {
  if (!Number.isInteger(limit) || limit < 1) {
    return err(appError(ErrorCode.invalid_argument, 'invalid limit'));
  }
  if (after !== undefined && !/^\d+$/.test(after)) {
    return err(appError(ErrorCode.invalid_argument, 'invalid after id'));
  }
  let query = identityView(db)
    .selectFrom('scope_request')
    .selectAll()
    .where('org_id', '=', org)
    .where('principal_id', '=', agent)
    .orderBy('id')
    .limit(limit);
  if (after !== undefined) query = query.where('id', '>', after);
  const rows = await query.execute();
  const requests: ScopeRequest[] = [];
  for (const row of rows) {
    const scope = isRetired(row.scope) ? ok(null) : parseScope(row.scope);
    const by = parsePrincipalId(row.requested_by);
    if (!scope.ok || !by.ok) {
      return err(appError(ErrorCode.internal, 'stored request is malformed'));
    }
    requests.push({
      id: row.id,
      org,
      agent,
      text: row.scope,
      scope: scope.value,
      requestedBy: by.value,
      at: row.at,
    });
  }
  return ok(requests);
}
