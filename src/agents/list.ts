import { ok, requirePageLimit } from '../index.ts';
import type { Result } from '../index.ts';
import type { Db, OrgId } from '../db/index.ts';
import { formatScope } from '../identity/index.ts';
import type { Authz, Caller } from '../identity/index.ts';
import { AgentStatus, holds, loadRecord } from './head.ts';
import type { AgentRecord } from './head.ts';
import { usableAgents } from './use.ts';
import { agentsView } from './tables.ts';

export interface AgentPage {
  readonly items: readonly AgentRecord[];
  /** The last candidate examined; pass it as `after`. Absent when none was. */
  readonly cursor: string | undefined;
}

interface Candidate {
  readonly agent_id: string;
  readonly status: string;
}

/**
 * The candidates of one page the caller may `view`. `use` is one CheckAgentUse
 * call and skips archived agents; `write` is one `agent:write` check each.
 */
async function admitted(
  authz: Authz,
  org: OrgId,
  caller: Caller,
  view: 'use' | 'write',
  candidates: readonly Candidate[],
): Promise<Result<ReadonlySet<string>>> {
  if (view === 'use') {
    return usableAgents(
      authz,
      org,
      caller,
      candidates
        .filter((c) => c.status !== AgentStatus.archived)
        .map((c) => c.agent_id),
    );
  }
  const ids = new Set<string>();
  for (const candidate of candidates) {
    const held = await holds(
      authz,
      org,
      caller,
      formatScope({
        resource: 'agent',
        action: 'write',
        id: candidate.agent_id,
      }),
    );
    if (!held.ok) return held;
    if (held.value) ids.add(candidate.agent_id);
  }
  return ok(ids);
}

/**
 * Up to `limit` agents the caller may `view`, in id order after `after`.
 * Permission filters before the limit. The cursor is the last candidate examined.
 */
export async function listAgents(
  deps: { readonly db: Db; readonly authz: Authz },
  caller: Caller,
  org: OrgId,
  query: {
    readonly view: 'use' | 'write';
    readonly limit: number;
    readonly after?: string;
  },
): Promise<Result<AgentPage>> {
  const { limit } = query;
  const limitOk = requirePageLimit(limit);
  if (!limitOk.ok) return limitOk;
  const q = agentsView(deps.db);
  const items: AgentRecord[] = [];
  let cursor = query.after;
  for (;;) {
    let batch = q
      .selectFrom('agent_head')
      .distinctOn('agent_id')
      .select(['agent_id', 'status'])
      .where('org_id', '=', org)
      .orderBy('agent_id')
      .orderBy('seq', 'desc')
      .limit(limit);
    if (cursor !== undefined) batch = batch.where('agent_id', '>', cursor);
    const candidates = await batch.execute();
    if (candidates.length === 0) return ok({ items, cursor });
    const allowed = await admitted(
      deps.authz,
      org,
      caller,
      query.view,
      candidates,
    );
    if (!allowed.ok) return allowed;
    for (const candidate of candidates) {
      cursor = candidate.agent_id;
      if (!allowed.value.has(candidate.agent_id)) continue;
      const record = await loadRecord(q, org, candidate.agent_id);
      if (!record.ok) return record;
      items.push(record.value);
      if (items.length === limit) return ok({ items, cursor });
    }
  }
}
