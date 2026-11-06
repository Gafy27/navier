import { appError, err, ErrorCode, ok, requirePageLimit, z } from '../index.ts';
import type { Result } from '../index.ts';
import type { Db, OrgId } from '../db/index.ts';
import { authzObject, DenyReason, ScopeResource } from '../identity/index.ts';
import type { AuthzAdmin, Caller } from '../identity/index.ts';
import { getTool } from './catalog.ts';
import type { ToolEntry } from './catalog.ts';
import { servingStatus } from './serving.ts';
import type { ServingStatus } from './serving.ts';
import { catalogView } from './tables.ts';

/** The one authz-api action a tool list asks for. */
const ToolListAction = z.enum({ can_see: 'can_see' });

/**
 * Up to `limit` entries whose tool the caller may see, in key then version order.
 * Visibility filters before the limit (L1).
 */
export async function listVisibleTools(
  db: Db,
  admin: AuthzAdmin,
  caller: Caller,
  org: OrgId,
  limit: number,
): Promise<Result<readonly ToolEntry[]>> {
  const limitOk = requirePageLimit(limit);
  if (!limitOk.ok) return limitOk;
  const q = catalogView(db);
  const items: ToolEntry[] = [];
  let last: { readonly key: string; readonly version: number } | undefined;
  for (;;) {
    let batch = q
      .selectFrom('tool_entry')
      .select(['key', 'implementation_version'])
      .where('org_id', '=', org)
      .orderBy('key')
      .orderBy('implementation_version')
      .limit(limit);
    if (last !== undefined) {
      const after = last;
      batch = batch.where((w) =>
        w.or([
          w('key', '>', after.key),
          w.and([
            w('key', '=', after.key),
            w('implementation_version', '>', after.version),
          ]),
        ]),
      );
    }
    const candidates = await batch.execute();
    if (candidates.length === 0) return ok(items);
    const decided = await admin.checkObjects(
      caller,
      org,
      candidates.map((c) => ({
        object: authzObject(org, ScopeResource.tool, c.key),
        action: ToolListAction.enum.can_see,
      })),
    );
    if (!decided.ok) return decided;
    for (const [i, candidate] of candidates.entries()) {
      last = { key: candidate.key, version: candidate.implementation_version };
      const decision = decided.value[i];
      if (
        decision === undefined ||
        (!decision.allow && decision.reason === DenyReason.unavailable)
      ) {
        return err(appError(ErrorCode.unavailable, 'authz-api unavailable'));
      }
      if (!decision.allow) continue;
      const entry = await getTool(
        db,
        org,
        candidate.key,
        candidate.implementation_version,
      );
      if (!entry.ok) return entry;
      items.push(entry.value);
      if (items.length === limit) return ok(items);
    }
  }
}

/** One entry and its serving status (null when no worker served it) (C6). */
export async function readToolServing(
  db: Db,
  org: OrgId,
  tool: string,
  implementationVersion: number,
): Promise<
  Result<{ readonly entry: ToolEntry; readonly serving: ServingStatus | null }>
> {
  const entry = await getTool(db, org, tool, implementationVersion);
  if (!entry.ok) return entry;
  const serving = await servingStatus(db, org, tool, implementationVersion);
  return ok({ entry: entry.value, serving });
}
