import { err, ErrorCode, ok, requirePageLimit, z } from '../../../index.ts';
import type { Result } from '../../../index.ts';
import {
  appendIfNewest,
  withTables,
  withTransaction,
} from '../../../db/index.ts';
import type { Db, OrgId } from '../../../db/index.ts';
import { DenyReason } from '../../../identity/index.ts';
import type {
  AuthzAdmin,
  Caller,
  Decision,
  ObjectRef,
} from '../../../identity/index.ts';
import {
  apiInternal,
  apiUnavailable,
  fromDecision,
} from '../../adapter/errors.ts';
import type { ApiFailure } from '../../adapter/errors.ts';
import {
  AUTHZ_OBJECT_ID_SEP,
  AuthzDirectoryType,
} from '../../adapter/scope-names.ts';
import { ApiTable, apiView } from '../../db/tables.ts';
import type { ApiTables } from '../../db/tables.ts';

/** The objects whose names and list candidates the directory holds (D1). */
export const DirectoryType = AuthzDirectoryType;
export type DirectoryType = AuthzDirectoryType;

/** The authz-api checks the directory asks for (D1, PD4). */
const DirectoryAction = z.enum({
  can_manage_grants: 'can_manage_grants',
  can_administer: 'can_administer',
  can_see: 'can_see',
});
type DirectoryAction = z.infer<typeof DirectoryAction>;

/** D1: the check a rename asks authz-api for, per type. */
const RENAME_ACTION: Readonly<Record<DirectoryType, DirectoryAction>> = {
  [DirectoryType.enum.organization]: DirectoryAction.enum.can_manage_grants,
  [DirectoryType.enum.space]: DirectoryAction.enum.can_manage_grants,
  [DirectoryType.enum.group]: DirectoryAction.enum.can_manage_grants,
  [DirectoryType.enum.marking_category]: DirectoryAction.enum.can_administer,
  [DirectoryType.enum.marking]: DirectoryAction.enum.can_administer,
};
/** PD4: a list keeps the candidates the caller can see. */
const LIST_ACTION = DirectoryAction.enum.can_see;
/** Splits `<org>` from `<id>` in an authz-api object id; `guard.ts` parses the same mark. */
export const ORG_ID_SEPARATOR = AUTHZ_OBJECT_ID_SEP;
const TABLE = ApiTable.enum.api_directory;

/** The authz-api object of a row: `organization:<org>`, or `<type>:<org>~<id>`. */
export function directoryObject(
  org: OrgId,
  type: DirectoryType,
  id: string,
): ObjectRef {
  return type === DirectoryType.enum.organization
    ? { type, id: org }
    : { type, id: `${org}${ORG_ID_SEPARATOR}${id}` };
}

function append(
  db: Db,
  org: OrgId,
  type: DirectoryType,
  id: string,
  name: string,
  accept: (newest: unknown) => boolean,
): Promise<Result<unknown>> {
  return withTransaction(db, (tx) =>
    appendIfNewest(withTables<ApiTables>(tx), {
      table: TABLE,
      org,
      key: { type, id },
      accept,
      row: () => ({ type, id, name }),
    }),
  );
}

/** PD2, C3: the first row only. A repeat or a lost race keeps the first name and is `ok` (D5). */
export async function recordCreated(
  db: Db,
  org: OrgId,
  type: DirectoryType,
  id: string,
  name: string,
): Promise<Result<void>> {
  const appended = await append(
    db,
    org,
    type,
    id,
    name,
    (newest) => newest === undefined,
  );
  if (appended.ok || appended.error.code === ErrorCode.aborted) {
    return ok(undefined);
  }
  return appended;
}

/** The one decision of a one-item check. */
function single(decided: Result<Decision[]>): Result<Decision> {
  if (!decided.ok) return decided;
  const [decision] = decided.value;
  return decision === undefined ? err(apiInternal) : ok(decision);
}

/** D1: authz-api's check for the type, then a new newest row. A missing row gets its first (C3). */
export async function rename(
  admin: AuthzAdmin,
  db: Db,
  caller: Caller,
  org: OrgId,
  type: DirectoryType,
  id: string,
  name: string,
): Promise<Result<void, ApiFailure>> {
  const decided = single(
    await admin.checkObjects(caller, org, [
      { object: directoryObject(org, type, id), action: RENAME_ACTION[type] },
    ]),
  );
  if (!decided.ok) return decided;
  if (!decided.value.allow) return err(fromDecision(decided.value));
  const appended = await append(db, org, type, id, name, () => true);
  return appended.ok ? ok(undefined) : appended;
}

/** The newest name of one row, or `undefined` when there is none. */
export async function readName(
  db: Db,
  org: OrgId,
  type: DirectoryType,
  id: string,
): Promise<string | undefined> {
  const row = await apiView(db)
    .selectFrom(TABLE)
    .select('name')
    .where('org_id', '=', org)
    .where('type', '=', type)
    .where('id', '=', id)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
  return row?.name;
}

export interface DirectoryPage {
  readonly items: { id: string; name: string }[];
  readonly after?: string;
}

/**
 * PD4: up to `limit` rows the caller can see, in id order after `after`. The check
 * filters before the limit. The cursor is the last candidate examined, absent when
 * none was. An `org` of `undefined` reads every `organization` row.
 */
export async function listVisible(
  admin: AuthzAdmin,
  db: Db,
  caller: Caller,
  org: OrgId | undefined,
  type: DirectoryType,
  page: { readonly limit: number; readonly after?: string },
): Promise<Result<DirectoryPage, ApiFailure>> {
  const { limit } = page;
  const limitOk = requirePageLimit(limit);
  if (!limitOk.ok) return limitOk;
  const items: { id: string; name: string }[] = [];
  let cursor = page.after;
  let examined: string | undefined;
  for (;;) {
    let batch = apiView(db)
      .selectFrom(TABLE)
      .distinctOn('id')
      .select(['org_id', 'id', 'name'])
      .where('type', '=', type)
      .orderBy('id')
      .orderBy('seq', 'desc')
      .limit(limit);
    if (org !== undefined) batch = batch.where('org_id', '=', org);
    if (cursor !== undefined) batch = batch.where('id', '>', cursor);
    const candidates = await batch.execute();
    const [first] = candidates;
    if (first === undefined) {
      return ok(
        examined === undefined ? { items } : { items, after: examined },
      );
    }
    const decided = await admin.checkObjects(
      caller,
      // A cross-org list logs under the org of its first candidate.
      org ?? first.org_id,
      candidates.map((c) => ({
        object: directoryObject(c.org_id, type, c.id),
        action: LIST_ACTION,
      })),
    );
    if (!decided.ok) return decided;
    for (const [i, candidate] of candidates.entries()) {
      examined = candidate.id;
      const decision = decided.value[i];
      if (decision === undefined) return err(apiInternal);
      if (!decision.allow) {
        if (decision.reason === DenyReason.unavailable) {
          return err(apiUnavailable);
        }
        continue;
      }
      items.push({ id: candidate.id, name: candidate.name });
      if (items.length === limit) return ok({ items, after: examined });
    }
    cursor = examined;
  }
}
