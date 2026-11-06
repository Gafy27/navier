import { createHash, randomUUID } from 'node:crypto';
import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { withTables } from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import { runtimeView } from './tables.ts';
import type { RuntimeTables } from './tables.ts';

/** Stores `bytes` and returns the object id. The same bytes in one org return the same id. */
export async function writeObject(
  tx: Tx,
  org: OrgId,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const q = withTables<RuntimeTables>(tx);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const inserted = await q
    .insertInto('stored_object')
    .values({
      org_id: org,
      id: randomUUID(),
      sha256,
      bytes: Buffer.from(bytes),
      size: bytes.byteLength,
      content_type: contentType,
    })
    .onConflict((oc) => oc.columns(['org_id', 'sha256']).doNothing())
    .returning('id')
    .executeTakeFirst();
  if (inserted !== undefined) return inserted.id;
  const existing = await q
    .selectFrom('stored_object')
    .select('id')
    .where('org_id', '=', org)
    .where('sha256', '=', sha256)
    .executeTakeFirstOrThrow();
  return existing.id;
}

/** The bytes of object `id`, or `not_found` (another org's id reads the same). */
export async function readObject(
  db: Db,
  org: OrgId,
  id: string,
): Promise<Result<Buffer>> {
  const row = await runtimeView(db)
    .selectFrom('stored_object')
    .select('bytes')
    .where('org_id', '=', org)
    .where('id', '=', id)
    .executeTakeFirst();
  return row === undefined
    ? err(appError(ErrorCode.not_found, 'object not found'))
    : ok(row.bytes);
}
