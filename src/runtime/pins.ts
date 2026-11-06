import { sql } from 'kysely';
import type { Db, OrgId } from '../db/index.ts';
import { z } from '../index.ts';
import { MessageStatus } from './status.ts';

export interface PinnedImplementation {
  readonly key: string;
  readonly implementationVersion: number;
}

export const MessageRole = z.enum({
  user: 'user',
  agent: 'agent',
});

const PinRow = z
  .object({
    key: z.string().min(1),
    implementation_version: z.number().int().min(1),
  })
  .transform((row): PinnedImplementation => ({
    key: row.key,
    implementationVersion: row.implementation_version,
  }));

/**
 * D4: the distinct `(key, implementationVersion)` tool refs of the pinned
 * versions of the org's agent messages whose newest status is `created` or
 * `paused`, ordered by key, then version. A deploy read, not a route: no authz.
 */
export async function listPinnedImplementations(
  db: Db,
  org: OrgId,
): Promise<PinnedImplementation[]> {
  const rows = await sql`
    select distinct
      tool->>'key' as key,
      (tool->>'implementationVersion')::int as implementation_version
    from message m
    join message_status s on s.org_id = m.org_id and s.message_id = m.id
    join agent_version v
      on v.org_id = m.org_id and v.agent_id = m.agent_id and v.version = m.agent_version
    cross join lateral jsonb_array_elements(v.definition->'tools') as tool
    where m.org_id = ${org}
      and m.role = ${MessageRole.enum.agent}
      and s.status in (${MessageStatus.created}, ${MessageStatus.paused})
      and not exists (
        select 1 from message_status newer
        where newer.org_id = s.org_id and newer.message_id = s.message_id
          and newer.seq > s.seq
      )
    order by key, implementation_version`.execute(db);
  return z.array(PinRow).parse(rows.rows);
}
