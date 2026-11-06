import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import type { Db, OrgId } from '../db/index.ts';
import type { AgentUse, Authz, Caller } from '../identity/index.ts';
import { loadRecord } from './head.ts';
import type { AgentRecord } from './head.ts';
import { agentsView } from './tables.ts';
import { readVersion } from './version.ts';
import type { VersionRecord } from './version.ts';

function notFound(): Result<never> {
  return err(appError(ErrorCode.not_found, 'agent not found'));
}

/**
 * The one `CheckAgentUse` for one agent. `version` names the pinned version
 * when the message has one; omitted, the answer may name the version `open` pins.
 */
export async function agentUse(
  authz: Authz,
  org: OrgId,
  caller: Caller,
  agentId: string,
  version?: number,
): Promise<Result<AgentUse>> {
  const answered = await authz.checkAgentUse(caller, org, [
    version === undefined ? { agentId } : { agentId, version },
  ]);
  if (!answered.ok) return answered;
  const use = answered.value[0];
  if (use === undefined) {
    return err(appError(ErrorCode.unavailable, 'authz-api unavailable'));
  }
  return ok(use);
}

/**
 * The record and the version a new message pins. `open` pins the version
 * CheckAgentUse named; `direct` pins the active one. Not visible is `not_found`.
 */
export async function useAgent(
  deps: { readonly db: Db; readonly authz: Authz },
  caller: Caller,
  org: OrgId,
  agentId: string,
): Promise<
  Result<{ readonly record: AgentRecord; readonly version: VersionRecord }>
> {
  const q = agentsView(deps.db);
  const record = await loadRecord(q, org, agentId);
  if (!record.ok) return record;
  const use = await agentUse(deps.authz, org, caller, agentId);
  if (!use.ok) return use;
  if (use.value.kind === 'not_visible') return notFound();
  const number =
    use.value.kind === 'open' ? use.value.version : record.value.activeVersion;
  const version = await readVersion(q, org, agentId, number);
  if (!version.ok) return version;
  return ok({ record: record.value, version: version.value });
}

/** `ok` when the caller may use the agent at `pinned`; otherwise `not_found`. */
export async function requireAgentUse(
  authz: Authz,
  org: OrgId,
  caller: Caller,
  agentId: string,
  pinned: number,
): Promise<Result<void>> {
  const use = await agentUse(authz, org, caller, agentId, pinned);
  if (!use.ok) return use;
  if (use.value.kind === 'not_visible') return notFound();
  return ok(undefined);
}

/** The ids the caller may use now (`open` or `direct`). One CheckAgentUse call; identity chunks it. */
export async function usableAgents(
  authz: Authz,
  org: OrgId,
  caller: Caller,
  agentIds: readonly string[],
): Promise<Result<ReadonlySet<string>>> {
  const answered = await authz.checkAgentUse(
    caller,
    org,
    agentIds.map((agentId) => ({ agentId })),
  );
  if (!answered.ok) return answered;
  const usable = new Set<string>();
  for (const [i, agentId] of agentIds.entries()) {
    const kind = answered.value[i]?.kind;
    if (kind === 'open' || kind === 'direct') usable.add(agentId);
  }
  return ok(usable);
}
