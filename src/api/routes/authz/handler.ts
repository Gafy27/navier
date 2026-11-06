import { err, ErrorCode, ok, z } from '../../../index.ts';
import type { Result } from '../../../index.ts';
import { parseOrgId } from '../../../db/index.ts';
import type { OrgId } from '../../../db/index.ts';
import type {
  Caller,
  ObjectGrantsInput,
  ObjectRef,
} from '../../../identity/index.ts';
import type { ApiDeps } from '../../adapter/app.ts';
import { apiInternal, apiNotFound } from '../../adapter/errors.ts';
import type { ApiFailure } from '../../adapter/errors.ts';
import { bind } from '../../adapter/route.ts';
import type { BoundRoute, HandlerContext } from '../../adapter/route.ts';
import {
  directoryObject,
  DirectoryType,
  listVisible,
  readName,
  recordCreated,
  rename,
} from './directory.ts';
import { parseObject, refOf, requireSameOrg } from './guard.ts';
import {
  addGroupMember,
  addOrgMember,
  addSpaceEditor,
  addSpaceMember,
  applyMarking,
  assignOrgRole,
  checkObjects,
  createGroup,
  createMarking,
  createMarkingCategory,
  createOrg,
  createSpace,
  getOrg,
  getSpace,
  listAuditEvents,
  listGrantable,
  listGrants,
  listMarkingCategories,
  listMarkings,
  listGroupMembers,
  listGroups,
  listOrgMembers,
  listOrgs,
  listRoles,
  listSpaceMembers,
  listSpaces,
  MemberPrivilege,
  OrgRole,
  removeGroupMember,
  removeMarking,
  removeOrgMember,
  removeSpaceEditor,
  removeSpaceMember,
  renameOrg,
  renameSpace,
  unassignOrgRole,
  writeCategoryRoles,
  writeGrants,
  writeMarkingRoles,
} from './routes.ts';

/** Which side of a `WriteGrants` entry a change lands on. */
const GrantChange = z.enum({ writes: 'writes', deletes: 'deletes' });
type GrantChange = z.infer<typeof GrantChange>;

/** Whether a marking route puts a marking on an object or takes it off. */
const MarkingChange = z.enum({ apply: 'apply', remove: 'remove' });
type MarkingChange = z.infer<typeof MarkingChange>;

const DONE = {} as const;
type Named = { id: string; name: string };

/** The caller and org a protected route under `:org` always has. */
function scoped<P, Q, B, R>(
  run: (
    caller: Caller,
    org: OrgId,
    ctx: HandlerContext<P, Q, B>,
  ) => Promise<Result<R, ApiFailure>>,
) {
  return (ctx: HandlerContext<P, Q, B>): Promise<Result<R, ApiFailure>> =>
    ctx.caller === undefined || ctx.org === undefined
      ? Promise.resolve(err(apiInternal))
      : run(ctx.caller, ctx.org, ctx);
}

/** The caller of a route with no `:org` in its path. */
function unscoped<P, Q, B, R>(
  run: (
    caller: Caller,
    ctx: HandlerContext<P, Q, B>,
  ) => Promise<Result<R, ApiFailure>>,
) {
  return (ctx: HandlerContext<P, Q, B>): Promise<Result<R, ApiFailure>> =>
    ctx.caller === undefined
      ? Promise.resolve(err(apiInternal))
      : run(ctx.caller, ctx);
}

/** The newest name of a row, or the one `not_found` a missing id shares with a hidden one (G4). */
async function named(
  deps: ApiDeps,
  org: OrgId,
  type: DirectoryType,
  id: string,
): Promise<Result<Named, ApiFailure>> {
  const name = await readName(deps.db, org, type, id);
  return name === undefined ? err(apiNotFound) : ok({ id, name });
}

/** One `WriteGrants` of one principal and privilege on one object (G1, L2). */
async function changeGrant(
  deps: ApiDeps,
  caller: Caller,
  org: OrgId,
  object: ObjectRef,
  principal: string,
  privilege: string,
  change: GrantChange,
): Promise<Result<typeof DONE, ApiFailure>> {
  const same = requireSameOrg(org, [refOf(object), principal]);
  if (!same.ok) return same;
  const entry = [{ principal, privilege }];
  const written = await deps.authzAdmin.writeGrants(caller, org, [
    change === GrantChange.enum.writes
      ? { object, writes: entry }
      : { object, deletes: entry },
  ]);
  return written.ok ? ok(DONE) : written;
}

/** Create: one `WriteGrants` that makes the object, then its first name row (D1, D5). */
async function createObject(
  deps: ApiDeps,
  caller: Caller,
  org: OrgId,
  type: DirectoryType,
  body: { id: string; name: string },
  grantee: string,
  privilege: string,
): Promise<Result<Named, ApiFailure>> {
  const object = directoryObject(org, type, body.id);
  const written = await changeGrant(
    deps,
    caller,
    org,
    object,
    grantee,
    privilege,
    GrantChange.enum.writes,
  );
  if (!written.ok) return written;
  const recorded = await recordCreated(deps.db, org, type, body.id, body.name);
  if (!recorded.ok) return recorded;
  return named(deps, org, type, body.id);
}

async function renamed(
  deps: ApiDeps,
  caller: Caller,
  org: OrgId,
  type: DirectoryType,
  id: string,
  name: string,
): Promise<Result<Named, ApiFailure>> {
  const done = await rename(
    deps.authzAdmin,
    deps.db,
    caller,
    org,
    type,
    id,
    name,
  );
  if (!done.ok) return done;
  return named(deps, org, type, id);
}

/** One page of grants on one object: `ListGrants` enforces `can_read_assignments` (C10). */
async function grantsOn(
  deps: ApiDeps,
  caller: Caller,
  org: OrgId,
  object: ObjectRef,
  continuation: string | undefined,
) {
  return deps.authzAdmin.listGrants(caller, org, object, continuation);
}

function orgsSpacesGroups(deps: ApiDeps): BoundRoute[] {
  const { organization, space, group } = DirectoryType.enum;
  const { member, editor } = MemberPrivilege.enum;
  const { writes, deletes } = GrantChange.enum;

  return [
    bind(
      createOrg,
      unscoped(async (caller, { body }) => {
        const org = parseOrgId(body.id);
        if (!org.ok) return org;
        const created = await createObject(
          deps,
          caller,
          org.value,
          organization,
          body,
          body.admin,
          OrgRole.enum.org_admin,
        );
        return created;
      }),
    ),
    bind(
      listOrgs,
      unscoped((caller, { query }) =>
        listVisible(deps.authzAdmin, deps.db, caller, undefined, organization, {
          limit: query.limit,
          ...(query.after === undefined ? {} : { after: query.after }),
        }),
      ),
    ),
    bind(
      getOrg,
      scoped((_caller, org) => named(deps, org, organization, org)),
    ),
    bind(
      renameOrg,
      scoped((caller, org, { body }) =>
        renamed(deps, caller, org, organization, org, body.name),
      ),
    ),
    bind(
      listOrgMembers,
      scoped((caller, org, { query }) =>
        grantsOn(
          deps,
          caller,
          org,
          directoryObject(org, organization, org),
          query.continuation,
        ),
      ),
    ),
    bind(
      addOrgMember,
      scoped((caller, org, { params }) =>
        changeGrant(
          deps,
          caller,
          org,
          directoryObject(org, organization, org),
          params.principal,
          member,
          writes,
        ),
      ),
    ),
    bind(
      removeOrgMember,
      scoped((caller, org, { params }) =>
        changeGrant(
          deps,
          caller,
          org,
          directoryObject(org, organization, org),
          params.principal,
          member,
          deletes,
        ),
      ),
    ),
    bind(
      listRoles,
      scoped(async (caller, org, { query }) =>
        deps.authzAdmin.listGrantable(caller, org, query.type),
      ),
    ),
    bind(
      assignOrgRole,
      scoped((caller, org, { params }) =>
        changeGrant(
          deps,
          caller,
          org,
          directoryObject(org, organization, org),
          params.principal,
          params.role,
          writes,
        ),
      ),
    ),
    bind(
      unassignOrgRole,
      scoped((caller, org, { params }) =>
        changeGrant(
          deps,
          caller,
          org,
          directoryObject(org, organization, org),
          params.principal,
          params.role,
          deletes,
        ),
      ),
    ),
    bind(
      createSpace,
      scoped((caller, org, { body }) =>
        createObject(
          deps,
          caller,
          org,
          space,
          body,
          caller.principal.id,
          editor,
        ),
      ),
    ),
    bind(
      listSpaces,
      scoped((caller, org, { query }) =>
        listVisible(deps.authzAdmin, deps.db, caller, org, space, {
          limit: query.limit,
          ...(query.after === undefined ? {} : { after: query.after }),
        }),
      ),
    ),
    bind(
      getSpace,
      scoped((_caller, org, { params }) =>
        named(deps, org, space, params.space),
      ),
    ),
    bind(
      renameSpace,
      scoped((caller, org, { params, body }) =>
        renamed(deps, caller, org, space, params.space, body.name),
      ),
    ),
    bind(
      listSpaceMembers,
      scoped((caller, org, { params, query }) =>
        grantsOn(
          deps,
          caller,
          org,
          directoryObject(org, space, params.space),
          query.continuation,
        ),
      ),
    ),
    bind(
      addSpaceMember,
      scoped((caller, org, { params }) =>
        changeGrant(
          deps,
          caller,
          org,
          directoryObject(org, space, params.space),
          params.principal,
          member,
          writes,
        ),
      ),
    ),
    bind(
      removeSpaceMember,
      scoped((caller, org, { params }) =>
        changeGrant(
          deps,
          caller,
          org,
          directoryObject(org, space, params.space),
          params.principal,
          member,
          deletes,
        ),
      ),
    ),
    bind(
      addSpaceEditor,
      scoped((caller, org, { params }) =>
        changeGrant(
          deps,
          caller,
          org,
          directoryObject(org, space, params.space),
          params.principal,
          editor,
          writes,
        ),
      ),
    ),
    bind(
      removeSpaceEditor,
      scoped((caller, org, { params }) =>
        changeGrant(
          deps,
          caller,
          org,
          directoryObject(org, space, params.space),
          params.principal,
          editor,
          deletes,
        ),
      ),
    ),
    bind(
      createGroup,
      scoped((caller, org, { body }) =>
        createObject(deps, caller, org, group, body, body.member, member),
      ),
    ),
    bind(
      listGroups,
      scoped((caller, org, { query }) =>
        listVisible(deps.authzAdmin, deps.db, caller, org, group, {
          limit: query.limit,
          ...(query.after === undefined ? {} : { after: query.after }),
        }),
      ),
    ),
    bind(
      listGroupMembers,
      scoped((caller, org, { params, query }) =>
        grantsOn(
          deps,
          caller,
          org,
          directoryObject(org, group, params.group),
          query.continuation,
        ),
      ),
    ),
    bind(
      addGroupMember,
      scoped((caller, org, { params }) =>
        changeGrant(
          deps,
          caller,
          org,
          directoryObject(org, group, params.group),
          params.principal,
          member,
          writes,
        ),
      ),
    ),
    bind(
      removeGroupMember,
      scoped((caller, org, { params }) =>
        changeGrant(
          deps,
          caller,
          org,
          directoryObject(org, group, params.group),
          params.principal,
          member,
          deletes,
        ),
      ),
    ),
  ];
}

interface GrantEntryInput {
  readonly principal: string;
  readonly privilege: string;
}
interface ObjectGrantsText {
  readonly object: string | undefined;
  readonly writes?: readonly GrantEntryInput[] | undefined;
  readonly deletes?: readonly GrantEntryInput[] | undefined;
}

/** Parses every object of a grants body and keeps each ref and grantee for the L2 guard. */
function toInputs(
  items: readonly ObjectGrantsText[],
): Result<{ inputs: ObjectGrantsInput[]; refs: string[] }, ApiFailure> {
  const inputs: ObjectGrantsInput[] = [];
  const refs: string[] = [];
  for (const item of items) {
    const object = parseObject(item.object ?? '');
    if (!object.ok) return object;
    inputs.push({
      object: object.value,
      ...(item.writes === undefined ? {} : { writes: item.writes }),
      ...(item.deletes === undefined ? {} : { deletes: item.deletes }),
    });
    refs.push(
      refOf(object.value),
      ...[...(item.writes ?? []), ...(item.deletes ?? [])].map(
        (entry) => entry.principal,
      ),
    );
  }
  return ok({ inputs, refs });
}

/** The create RPC, then the first name row. A repeat is `already_exists`, which is a no-op (D5). */
async function createMarkingEntry(
  deps: ApiDeps,
  org: OrgId,
  type: DirectoryType,
  body: { id: string; name: string },
  send: () => Promise<Result<void>>,
): Promise<Result<Named, ApiFailure>> {
  const made = await send();
  if (!made.ok && made.error.code !== ErrorCode.already_exists) return made;
  const recorded = await recordCreated(deps.db, org, type, body.id, body.name);
  if (!recorded.ok) return recorded;
  return named(deps, org, type, body.id);
}

interface RoleEntryInput {
  readonly principal: string;
  readonly role: string;
}

async function writeRoles(
  deps: ApiDeps,
  caller: Caller,
  org: OrgId,
  target: { categoryId: string } | { markingId: string },
  body: {
    writes?: readonly RoleEntryInput[] | undefined;
    deletes?: readonly RoleEntryInput[] | undefined;
  },
): Promise<Result<typeof DONE, ApiFailure>> {
  const writes = body.writes ?? [];
  const deletes = body.deletes ?? [];
  const same = requireSameOrg(
    org,
    [...writes, ...deletes].map((entry) => entry.principal),
  );
  if (!same.ok) return same;
  const written = await deps.authzAdmin.writeMarkingRoles(
    caller,
    org,
    target,
    writes,
    deletes,
  );
  return written.ok ? ok(DONE) : written;
}

async function changeMarking(
  deps: ApiDeps,
  caller: Caller,
  org: OrgId,
  params: { type: string; id: string; marking: string },
  change: MarkingChange,
): Promise<Result<typeof DONE, ApiFailure>> {
  const object = { type: params.type, id: params.id };
  const same = requireSameOrg(org, [refOf(object)]);
  if (!same.ok) return same;
  const marking = directoryObject(
    org,
    DirectoryType.enum.marking,
    params.marking,
  );
  const send =
    change === MarkingChange.enum.apply
      ? deps.authzAdmin.applyMarking
      : deps.authzAdmin.removeMarking;
  const done = await send(caller, org, object, marking.id);
  return done.ok ? ok(DONE) : done;
}

function grantsMarkingsAudit(deps: ApiDeps): BoundRoute[] {
  const { marking_category: category, marking } = DirectoryType.enum;
  const idOf = (org: OrgId, type: DirectoryType, id: string): string =>
    directoryObject(org, type, id).id;

  return [
    bind(
      listGrants,
      scoped(async (caller, org, { query }) => {
        const object = parseObject(query.object);
        if (!object.ok) return object;
        const same = requireSameOrg(org, [refOf(object.value)]);
        if (!same.ok) return same;
        return grantsOn(deps, caller, org, object.value, query.continuation);
      }),
    ),
    bind(
      writeGrants,
      scoped(async (caller, org, { body }) => {
        const parsed = toInputs(
          body.objects ?? [
            { object: body.object, writes: body.writes, deletes: body.deletes },
          ],
        );
        if (!parsed.ok) return parsed;
        const same = requireSameOrg(org, parsed.value.refs);
        if (!same.ok) return same;
        const written = await deps.authzAdmin.writeGrants(
          caller,
          org,
          parsed.value.inputs,
        );
        return written.ok ? ok(DONE) : written;
      }),
    ),
    bind(
      listGrantable,
      scoped((caller, org, { params }) =>
        deps.authzAdmin.listGrantable(caller, org, params.type),
      ),
    ),
    bind(
      checkObjects,
      scoped(async (caller, org, { body }) => {
        const items: { object: ObjectRef; action: string }[] = [];
        for (const item of body.items) {
          const object = parseObject(item.object);
          if (!object.ok) return object;
          items.push({ object: object.value, action: item.action });
        }
        const same = requireSameOrg(
          org,
          items.map((item) => refOf(item.object)),
        );
        if (!same.ok) return same;
        const decided = await deps.authzAdmin.checkObjects(caller, org, items);
        if (!decided.ok) return decided;
        return ok({
          decisions: decided.value.map((d) =>
            d.allow ? { allow: true } : { allow: false, reason: d.reason },
          ),
        });
      }),
    ),
    bind(
      createMarkingCategory,
      scoped((caller, org, { body }) =>
        createMarkingEntry(deps, org, category, body, () =>
          deps.authzAdmin.createMarkingCategory(
            caller,
            org,
            idOf(org, category, body.id),
          ),
        ),
      ),
    ),
    bind(
      listMarkingCategories,
      scoped((caller, org, { query }) =>
        listVisible(deps.authzAdmin, deps.db, caller, org, category, {
          limit: query.limit,
          ...(query.after === undefined ? {} : { after: query.after }),
        }),
      ),
    ),
    bind(
      createMarking,
      scoped((caller, org, { params, body }) =>
        createMarkingEntry(deps, org, marking, body, () =>
          deps.authzAdmin.createMarking(
            caller,
            org,
            idOf(org, category, params.category),
            idOf(org, marking, body.id),
          ),
        ),
      ),
    ),
    bind(
      listMarkings,
      scoped((caller, org, { query }) =>
        listVisible(deps.authzAdmin, deps.db, caller, org, marking, {
          limit: query.limit,
          ...(query.after === undefined ? {} : { after: query.after }),
        }),
      ),
    ),
    bind(
      writeCategoryRoles,
      scoped((caller, org, { params, body }) =>
        writeRoles(
          deps,
          caller,
          org,
          { categoryId: idOf(org, category, params.category) },
          body,
        ),
      ),
    ),
    bind(
      writeMarkingRoles,
      scoped((caller, org, { params, body }) =>
        writeRoles(
          deps,
          caller,
          org,
          { markingId: idOf(org, marking, params.marking) },
          body,
        ),
      ),
    ),
    bind(
      applyMarking,
      scoped((caller, org, { params }) =>
        changeMarking(deps, caller, org, params, MarkingChange.enum.apply),
      ),
    ),
    bind(
      removeMarking,
      scoped((caller, org, { params }) =>
        changeMarking(deps, caller, org, params, MarkingChange.enum.remove),
      ),
    ),
    bind(
      listAuditEvents,
      scoped(async (caller, org, { query }) => {
        let object: ObjectRef | undefined;
        if (query.object !== undefined) {
          const parsed = parseObject(query.object);
          if (!parsed.ok) return parsed;
          const same = requireSameOrg(org, [refOf(parsed.value)]);
          if (!same.ok) return same;
          object = parsed.value;
        }
        return deps.authzAdmin.listAuditEvents(caller, org, {
          ...(object === undefined ? {} : { object }),
          ...(query.after === undefined ? {} : { after: query.after }),
        });
      }),
    ),
  ];
}

export function authz(deps: ApiDeps): BoundRoute[] {
  return [...orgsSpacesGroups(deps), ...grantsMarkingsAudit(deps)];
}
