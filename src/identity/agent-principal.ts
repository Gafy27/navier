import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { withTables, writeAudit } from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import { IDENTITY_AUDIT } from './audit-kinds.ts';
import { agentPrincipalId } from './principal.ts';
import type { Principal, PrincipalId } from './principal.ts';
import { identityView } from './tables.ts';
import type { IdentityTables } from './tables.ts';

export interface AgentPrincipal {
  readonly org: OrgId;
  readonly id: PrincipalId;
  readonly agentId: string;
  readonly createdAt: Date;
}

/**
 * Inserts the agent's own principal row and its audit row in `tx`.
 * `actor` is recorded and granted nothing. A second create is `already_exists`.
 */
export async function createAgentPrincipal(
  tx: Tx,
  org: OrgId,
  agentId: string,
  actor: Principal,
): Promise<Result<AgentPrincipal>> {
  const id = agentPrincipalId(org, agentId);
  if (!id.ok) return id;
  const row = await withTables<IdentityTables>(tx)
    .insertInto('agent_principal')
    .values({
      org_id: org,
      agent_id: agentId,
      principal_id: id.value,
      created_by: actor.id,
    })
    .onConflict((oc) => oc.doNothing())
    .returning('created_at')
    .executeTakeFirst();
  if (row === undefined) {
    return err(appError(ErrorCode.already_exists, 'agent principal exists'));
  }
  const audited = await writeAudit(tx, org, {
    kind: IDENTITY_AUDIT.agentPrincipalCreated,
    actor: { kind: actor.kind, id: actor.id },
    target: { kind: 'agent_principal', id: id.value },
  });
  if (!audited.ok) return audited;
  return ok({ org, id: id.value, agentId, createdAt: row.created_at });
}

/** Reads one agent principal. Another org's agent is `not_found`. */
export async function getAgentPrincipal(
  db: Db,
  org: OrgId,
  agentId: string,
): Promise<Result<AgentPrincipal>> {
  const id = agentPrincipalId(org, agentId);
  if (!id.ok) return id;
  const row = await identityView(db)
    .selectFrom('agent_principal')
    .select('created_at')
    .where('org_id', '=', org)
    .where('agent_id', '=', agentId)
    .executeTakeFirst();
  if (row === undefined) {
    return err(appError(ErrorCode.not_found, 'agent principal not found'));
  }
  return ok({ org, id: id.value, agentId, createdAt: row.created_at });
}
