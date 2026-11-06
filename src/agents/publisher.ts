import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { withTables } from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import { parsePrincipalId } from '../identity/index.ts';
import type { PrincipalId } from '../identity/index.ts';
import { agentsView } from './tables.ts';
import type { AgentsTables } from './tables.ts';

/** The first successful publish of a version wins. A repeat changes nothing. */
export async function recordPublisher(
  tx: Tx,
  org: OrgId,
  agentId: string,
  version: number,
  publishedBy: PrincipalId,
): Promise<void> {
  await withTables<AgentsTables>(tx)
    .insertInto('agent_version_publisher')
    .values({
      org_id: org,
      agent_id: agentId,
      version,
      published_by: publishedBy,
    })
    .onConflict((oc) => oc.doNothing())
    .execute();
}

/** The principal that published the version; `ok(undefined)` when no row exists. */
export async function loadPublisher(
  db: Db,
  org: OrgId,
  agentId: string,
  version: number,
): Promise<Result<PrincipalId | undefined>> {
  const row = await agentsView(db)
    .selectFrom('agent_version_publisher')
    .select('published_by')
    .where('org_id', '=', org)
    .where('agent_id', '=', agentId)
    .where('version', '=', version)
    .executeTakeFirst();
  if (row === undefined) return ok(undefined);
  const publisher = parsePrincipalId(row.published_by);
  if (!publisher.ok) {
    return err(appError(ErrorCode.internal, 'stored publisher is invalid'));
  }
  return ok(publisher.value);
}
