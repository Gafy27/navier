import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import {
  appendIfNewest,
  withTables,
  withTransaction,
  writeAudit,
} from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import { formatScope, ScopeResource } from '../identity/index.ts';
import type { Authz, Caller } from '../identity/index.ts';
import { CATALOG_AUDIT } from './audit-kinds.ts';
import { catalogView } from './tables.ts';
import type { CatalogTables } from './tables.ts';

/** The one-way stream of a pair: none, `served`, `draining`, `retired`. */
export const ServingStatus = z.enum({
  served: 'served',
  draining: 'draining',
  retired: 'retired',
});

export type ServingStatus = z.infer<typeof ServingStatus>;

/** The refusals a caller can match on. */
export const ServingReason = z.enum({
  notServed: 'not_served',
  notDraining: 'not_draining',
  stillPinned: 'still_pinned',
});

const FIRST_SEQ = 1;
const TOOL_ENABLE_ACTION = 'enable';
const AUDIT_TARGET_KIND = 'tool';

export interface ServingPair {
  readonly key: string;
  readonly implementationVersion: number;
}

export interface ServedRow extends ServingPair {
  readonly org: OrgId;
}

export interface RetireDeps {
  readonly authz: Authz;
  readonly db: Db;
  readonly listPinned: (db: Db, org: OrgId) => Promise<readonly ServingPair[]>;
}

type Query = ReturnType<typeof catalogView>;

function newestStatusQuery(
  q: Query,
  org: OrgId,
  key: string,
  implementationVersion: number,
) {
  return q
    .selectFrom('tool_serving')
    .select('status')
    .where('org_id', '=', org)
    .where('key', '=', key)
    .where('implementation_version', '=', implementationVersion)
    .orderBy('seq', 'desc')
    .limit(1);
}

async function newestStatus(
  q: Query,
  org: OrgId,
  key: string,
  implementationVersion: number,
): Promise<ServingStatus | null> {
  const row = await newestStatusQuery(
    q,
    org,
    key,
    implementationVersion,
  ).executeTakeFirst();
  return row === undefined ? null : ServingStatus.parse(row.status);
}

const targetId = (key: string, implementationVersion: number): string =>
  `${key}@${String(implementationVersion)}`;

async function requireEnable(
  authz: Authz,
  org: OrgId,
  caller: Caller,
  key: string,
): Promise<Result<void>> {
  const scope = formatScope({
    resource: ScopeResource.tool,
    action: TOOL_ENABLE_ACTION,
    id: key,
  });
  const decision = await authz.check(org, caller, scope);
  if (!decision.ok) return decision;
  if (!decision.value.allow) {
    return err(appError(ErrorCode.permission_denied, `missing ${scope}`));
  }
  return ok(undefined);
}

/**
 * The newest status of one pair, or null when no booted worker has served it.
 */
export function servingStatus(
  db: Db,
  org: OrgId,
  key: string,
  implementationVersion: number,
): Promise<ServingStatus | null> {
  return newestStatus(catalogView(db), org, key, implementationVersion);
}

/**
 * D3: `ok`, or `invalid_argument` `<key>: not_served` for the first ref whose
 * newest row is not `served`. Each newest row stays share-locked until the
 * `Tx` ends, so a drain waits for this pin.
 */
export async function checkServed(
  tx: Tx,
  org: OrgId,
  refs: readonly ServingPair[],
): Promise<Result<void>> {
  const q = withTables<CatalogTables>(tx);
  for (const ref of refs) {
    // A lock wait can outlast a drain. The second read sees the row it appended.
    await newestStatusQuery(q, org, ref.key, ref.implementationVersion)
      .forShare()
      .executeTakeFirst();
    const current = await newestStatus(
      q,
      org,
      ref.key,
      ref.implementationVersion,
    );
    if (current !== ServingStatus.enum.served) {
      return err(
        appError(
          ErrorCode.invalid_argument,
          `${ref.key}: ${ServingReason.enum.notServed}`,
        ),
      );
    }
  }
  return ok(undefined);
}

/**
 * Worker boot, D2 and D6: appends `served` for every org that has an entry at
 * a listed pair and no serving row. It writes no audit row, because there is
 * no actor. A lost race counts as done.
 */
export async function serveRegistered(
  db: Db,
  pairs: readonly ServingPair[],
): Promise<readonly ServedRow[]> {
  if (pairs.length === 0) return [];
  const rows = await catalogView(db)
    .insertInto('tool_serving')
    .columns(['org_id', 'key', 'implementation_version', 'seq', 'status'])
    .expression((eb) =>
      eb
        .selectFrom('tool_entry as e')
        .select([
          'e.org_id',
          'e.key',
          'e.implementation_version',
          eb.cast<number>(eb.val(FIRST_SEQ), 'integer').as('seq'),
          eb
            .cast<string>(eb.val(ServingStatus.enum.served), 'text')
            .as('status'),
        ])
        .where((w) =>
          w.or(
            pairs.map((pair) =>
              w.and([
                w('e.key', '=', pair.key),
                w('e.implementation_version', '=', pair.implementationVersion),
              ]),
            ),
          ),
        )
        .where((w) =>
          w.not(
            w.exists(
              w
                .selectFrom('tool_serving as s')
                .select('s.seq')
                .whereRef('s.org_id', '=', 'e.org_id')
                .whereRef('s.key', '=', 'e.key')
                .whereRef(
                  's.implementation_version',
                  '=',
                  'e.implementation_version',
                ),
            ),
          ),
        ),
    )
    .onConflict((oc) => oc.doNothing())
    .returning(['org_id', 'key', 'implementation_version'])
    .execute();
  return rows.map((row) => ({
    org: row.org_id,
    key: row.key,
    implementationVersion: row.implementation_version,
  }));
}

/**
 * D4: locks the newest row, then appends `draining`. Draining or retired
 * writes nothing.
 */
export async function drainTool(
  authz: Authz,
  db: Db,
  caller: Caller,
  org: OrgId,
  key: string,
  implementationVersion: number,
): Promise<Result<void>> {
  const allowed = await requireEnable(authz, org, caller, key);
  if (!allowed.ok) return allowed;
  return withTransaction(db, async (tx) => {
    const q = withTables<CatalogTables>(tx);
    const entry = await q
      .selectFrom('tool_entry')
      .select('key')
      .where('org_id', '=', org)
      .where('key', '=', key)
      .where('implementation_version', '=', implementationVersion)
      .executeTakeFirst();
    if (entry === undefined) {
      return err(appError(ErrorCode.not_found, 'tool entry not found'));
    }
    // The lock waits for open pins. The second read sees what the wait outlasted.
    await newestStatusQuery(q, org, key, implementationVersion)
      .forUpdate()
      .executeTakeFirst();
    const status = await newestStatus(q, org, key, implementationVersion);
    if (status === null) {
      return err(
        appError(ErrorCode.invalid_argument, ServingReason.enum.notServed),
      );
    }
    if (status !== ServingStatus.enum.served) return ok(undefined);
    const appended = await appendIfNewest<CatalogTables, 'tool_serving'>(q, {
      table: 'tool_serving',
      org,
      key: { key, implementation_version: implementationVersion },
      accept: (newest) => newest?.status === ServingStatus.enum.served,
      row: () => ({
        key,
        implementation_version: implementationVersion,
        status: ServingStatus.enum.draining,
        by: caller.principal.id,
      }),
    });
    if (!appended.ok) return appended;
    return writeAudit(tx, org, {
      kind: CATALOG_AUDIT.toolDraining,
      actor: { kind: caller.principal.kind, id: caller.principal.id },
      target: {
        kind: AUDIT_TARGET_KIND,
        id: targetId(key, implementationVersion),
      },
    });
  });
}

/**
 * D5: requires `draining`, reads the pins, then appends `retired`. A pinned
 * pair is `aborted`. Retired writes nothing.
 */
export async function retireTool(
  deps: RetireDeps,
  caller: Caller,
  org: OrgId,
  key: string,
  implementationVersion: number,
): Promise<Result<void>> {
  const allowed = await requireEnable(deps.authz, org, caller, key);
  if (!allowed.ok) return allowed;
  const status = await servingStatus(deps.db, org, key, implementationVersion);
  if (status === ServingStatus.enum.retired) return ok(undefined);
  if (status !== ServingStatus.enum.draining) {
    return err(
      appError(ErrorCode.invalid_argument, ServingReason.enum.notDraining),
    );
  }
  const pinned = await deps.listPinned(deps.db, org);
  if (
    pinned.some(
      (pin) =>
        pin.key === key && pin.implementationVersion === implementationVersion,
    )
  ) {
    return err(appError(ErrorCode.aborted, ServingReason.enum.stillPinned));
  }
  return withTransaction(deps.db, async (tx) => {
    const appended = await appendIfNewest<CatalogTables, 'tool_serving'>(
      withTables<CatalogTables>(tx),
      {
        table: 'tool_serving',
        org,
        key: { key, implementation_version: implementationVersion },
        accept: (newest) => newest?.status === ServingStatus.enum.draining,
        row: () => ({
          key,
          implementation_version: implementationVersion,
          status: ServingStatus.enum.retired,
          by: caller.principal.id,
        }),
      },
    );
    if (!appended.ok) return appended;
    return writeAudit(tx, org, {
      kind: CATALOG_AUDIT.toolRetired,
      actor: { kind: caller.principal.kind, id: caller.principal.id },
      target: {
        kind: AUDIT_TARGET_KIND,
        id: targetId(key, implementationVersion),
      },
    });
  });
}

/**
 * D6: the distinct pairs whose newest row is `served` or `draining`, in any
 * org. It returns no org id.
 */
export async function listServingPairs(db: Db): Promise<ServingPair[]> {
  const rows = await catalogView(db)
    .selectFrom('tool_serving as s')
    .select(['s.key', 's.implementation_version'])
    .distinct()
    .where('s.status', 'in', [
      ServingStatus.enum.served,
      ServingStatus.enum.draining,
    ])
    .where((w) =>
      w.not(
        w.exists(
          w
            .selectFrom('tool_serving as newer')
            .select('newer.seq')
            .whereRef('newer.org_id', '=', 's.org_id')
            .whereRef('newer.key', '=', 's.key')
            .whereRef(
              'newer.implementation_version',
              '=',
              's.implementation_version',
            )
            .whereRef('newer.seq', '>', 's.seq'),
        ),
      ),
    )
    .orderBy('s.key')
    .orderBy('s.implementation_version')
    .execute();
  return rows.map((row) => ({
    key: row.key,
    implementationVersion: row.implementation_version,
  }));
}
