import { z } from '../../../index.ts';
import {
  CheckKind,
  defineRoute,
  Method,
  RouteTag,
  WireType,
} from '../../adapter/route-types.ts';
import { AuthzDirectoryType } from '../../adapter/scope-names.ts';

/** An id a caller names: no separator, relation mark, type mark, or whitespace (authz-api's id rule). */
const ID_PATTERN = /^[^\s:#~*]+$/u;
const Id = z.string().regex(ID_PATTERN);
const Name = z.string().min(1);
/** A principal or object string in authz-api form, such as `user:ns~sub` or `group:A~g#member`. */
const PrincipalRef = z.string().min(1);

/** The org roles a route assigns (D3). authz-api defines them; no route creates one. */
export const OrgRole = z.enum({
  org_admin: 'org_admin',
  security_admin: 'security_admin',
  data_admin: 'data_admin',
  audit_reader: 'audit_reader',
});
export type OrgRole = z.infer<typeof OrgRole>;

/** The privileges the group, space, and organization member routes write. */
export const MemberPrivilege = z.enum({
  member: 'member',
  editor: 'editor',
});
export type MemberPrivilege = z.infer<typeof MemberPrivilege>;

const ORG = 'org';
const SPACE = 'space';
const GROUP = 'group';
const PRINCIPAL = 'principal';

const orgParam = { [ORG]: Id };
const orgShape = orgParam;
const spaceShape = { ...orgParam, [SPACE]: Id };
const groupShape = { ...orgParam, [GROUP]: Id };
const orgParams = z.strictObject(orgShape);
const spaceParams = z.strictObject(spaceShape);

const Named = z.strictObject({ id: z.string(), name: z.string() });
export const NamedPage = z.strictObject({
  items: z.array(Named),
  after: z.string().optional(),
});
export const GrantsPage = z.strictObject({
  grants: z.array(
    z.strictObject({ principal: z.string(), privilege: z.string() }),
  ),
  continuation: z.string().optional(),
});
const Empty = z.strictObject({});
const RenameBody = z.strictObject({ name: Name });

/** C12: the caller owns the page size. A missing `limit` is `invalid_request`. */
export const DirectoryQuery = z.object({
  limit: z.coerce.number().int(),
  after: z.string().min(1).optional(),
});
const GrantsQuery = z.object({ continuation: z.string().min(1).optional() });

const ERRORS = [
  WireType.enum.unauthenticated,
  WireType.enum.forbidden,
  WireType.enum.not_found,
  WireType.enum.invalid_request,
  WireType.enum.conflict,
  WireType.enum.unavailable,
  WireType.enum.internal,
];
const base = { tag: RouteTag.enum.authz, errors: ERRORS } as const;
const store = { kind: CheckKind.enum.store } as const;
const caller = { kind: CheckKind.enum.caller } as const;

type ChangeMethod = typeof Method.enum.PUT | typeof Method.enum.DELETE;

/** A `PUT` or `DELETE` of one principal on one object: a single `WriteGrants` (G1, C10). */
function changeRoute<S extends z.ZodRawShape>(
  operationId: string,
  summary: string,
  method: ChangeMethod,
  path: `/${string}`,
  shape: S,
) {
  return defineRoute({
    ...base,
    operationId,
    summary,
    method,
    path,
    check: store,
    params: z.strictObject({ ...shape, [PRINCIPAL]: PrincipalRef }),
    response: Empty,
  });
}

function membersRoute<S extends z.ZodRawShape>(
  operationId: string,
  summary: string,
  path: `/${string}`,
  shape: S,
) {
  return defineRoute({
    ...base,
    operationId,
    summary,
    method: Method.enum.GET,
    path,
    check: store,
    params: z.strictObject(shape),
    query: GrantsQuery,
    response: GrantsPage,
  });
}

function listRoute<S extends z.ZodRawShape>(
  operationId: string,
  summary: string,
  path: `/${string}`,
  shape: S,
) {
  return defineRoute({
    ...base,
    operationId,
    summary,
    method: Method.enum.GET,
    path,
    check: caller,
    params: z.strictObject(shape),
    query: DirectoryQuery,
    response: NamedPage,
  });
}

function renameRoute<S extends z.ZodRawShape>(
  operationId: string,
  summary: string,
  path: `/${string}`,
  shape: S,
) {
  return defineRoute({
    ...base,
    operationId,
    summary,
    method: Method.enum.PATCH,
    path,
    check: store,
    params: z.strictObject(shape),
    body: RenameBody,
    response: Named,
  });
}

export const CreateOrgBody = z.strictObject({
  id: Id,
  name: Name,
  admin: PrincipalRef,
});
export const CreateSpaceBody = z.strictObject({ id: Id, name: Name });
export const CreateGroupBody = z.strictObject({
  id: Id,
  name: Name,
  member: PrincipalRef,
});

const orgBase = '/orgs/:org';
const spaceBase = `${orgBase}/spaces/:space`;
const groupBase = `${orgBase}/groups/:group`;

export const createOrg = defineRoute({
  ...base,
  operationId: 'createOrg',
  summary: 'Seats the first org_admin of a registered organization',
  method: Method.enum.POST,
  path: '/orgs',
  check: store,
  params: z.strictObject({}),
  body: CreateOrgBody,
  response: Named,
});

export const listOrgs = defineRoute({
  ...base,
  operationId: 'listOrgs',
  summary: 'Lists the organizations the caller can see',
  method: Method.enum.GET,
  path: '/orgs',
  check: caller,
  params: z.strictObject({}),
  query: DirectoryQuery,
  response: NamedPage,
});

export const getOrg = defineRoute({
  ...base,
  operationId: 'getOrg',
  summary: 'Reads one organization',
  method: Method.enum.GET,
  path: orgBase,
  check: {
    kind: CheckKind.enum.object,
    type: AuthzDirectoryType.enum.organization,
    idParams: [ORG],
    action: 'can_see',
  },
  params: orgParams,
  response: Named,
});

export const renameOrg = renameRoute(
  'renameOrg',
  'Renames an organization',
  orgBase,
  orgShape,
);

export const listOrgMembers = membersRoute(
  'listOrgMembers',
  'Lists members and org role holders',
  `${orgBase}/members`,
  orgShape,
);

export const addOrgMember = changeRoute(
  'addOrgMember',
  'Adds a member to the organization',
  Method.enum.PUT,
  `${orgBase}/members/:principal`,
  orgParam,
);

export const removeOrgMember = changeRoute(
  'removeOrgMember',
  'Removes a member from the organization',
  Method.enum.DELETE,
  `${orgBase}/members/:principal`,
  orgParam,
);

export const listRoles = defineRoute({
  ...base,
  operationId: 'listRoles',
  summary: 'Lists the privileges a type can grant',
  method: Method.enum.GET,
  path: `${orgBase}/roles`,
  check: caller,
  params: orgParams,
  query: z.object({ type: z.string().min(1) }),
  response: z.strictObject({ privileges: z.array(z.string()) }),
});

export const assignOrgRole = changeRoute(
  'assignOrgRole',
  'Assigns an org role',
  Method.enum.PUT,
  `${orgBase}/roles/:role/holders/:principal`,
  { ...orgParam, role: OrgRole },
);

export const unassignOrgRole = changeRoute(
  'unassignOrgRole',
  'Unassigns an org role',
  Method.enum.DELETE,
  `${orgBase}/roles/:role/holders/:principal`,
  { ...orgParam, role: OrgRole },
);

export const createSpace = defineRoute({
  ...base,
  operationId: 'createSpace',
  summary: 'Creates a space with the caller as editor',
  method: Method.enum.POST,
  path: `${orgBase}/spaces`,
  check: store,
  params: orgParams,
  body: CreateSpaceBody,
  response: Named,
});

export const listSpaces = listRoute(
  'listSpaces',
  'Lists the spaces the caller can see',
  `${orgBase}/spaces`,
  orgShape,
);

export const getSpace = defineRoute({
  ...base,
  operationId: 'getSpace',
  summary: 'Reads one space',
  method: Method.enum.GET,
  path: spaceBase,
  check: {
    kind: CheckKind.enum.object,
    type: AuthzDirectoryType.enum.space,
    idParams: [ORG, SPACE],
    action: 'can_see',
  },
  params: spaceParams,
  response: Named,
});

export const renameSpace = renameRoute(
  'renameSpace',
  'Renames a space',
  spaceBase,
  spaceShape,
);

export const listSpaceMembers = membersRoute(
  'listSpaceMembers',
  'Lists members and editors of a space',
  `${spaceBase}/members`,
  spaceShape,
);

export const addSpaceMember = changeRoute(
  'addSpaceMember',
  'Adds a member to a space',
  Method.enum.PUT,
  `${spaceBase}/members/:principal`,
  { ...orgParam, [SPACE]: Id },
);

export const removeSpaceMember = changeRoute(
  'removeSpaceMember',
  'Removes a member from a space',
  Method.enum.DELETE,
  `${spaceBase}/members/:principal`,
  { ...orgParam, [SPACE]: Id },
);

export const addSpaceEditor = changeRoute(
  'addSpaceEditor',
  'Names an editor of a space',
  Method.enum.PUT,
  `${spaceBase}/editors/:principal`,
  { ...orgParam, [SPACE]: Id },
);

export const removeSpaceEditor = changeRoute(
  'removeSpaceEditor',
  'Removes an editor of a space',
  Method.enum.DELETE,
  `${spaceBase}/editors/:principal`,
  { ...orgParam, [SPACE]: Id },
);

export const createGroup = defineRoute({
  ...base,
  operationId: 'createGroup',
  summary: 'Creates a group with its first member',
  method: Method.enum.POST,
  path: `${orgBase}/groups`,
  check: store,
  params: orgParams,
  body: CreateGroupBody,
  response: Named,
});

export const listGroups = listRoute(
  'listGroups',
  'Lists the groups the caller can see',
  `${orgBase}/groups`,
  orgShape,
);

export const listGroupMembers = membersRoute(
  'listGroupMembers',
  'Lists group members',
  `${groupBase}/members`,
  groupShape,
);

export const addGroupMember = changeRoute(
  'addGroupMember',
  'Adds a user to a group',
  Method.enum.PUT,
  `${groupBase}/members/:principal`,
  { ...orgParam, [GROUP]: Id },
);

export const removeGroupMember = changeRoute(
  'removeGroupMember',
  'Removes a user from a group',
  Method.enum.DELETE,
  `${groupBase}/members/:principal`,
  { ...orgParam, [GROUP]: Id },
);

/** C7: an audit cursor is a decimal `uint64`. */
const UINT64_BITS = 64n;
const UINT64_MAX = (1n << UINT64_BITS) - 1n;
const DECIMAL = /^[0-9]+$/u;
const Uint64Text = z
  .string()
  .regex(DECIMAL)
  .refine((text) => DECIMAL.test(text) && BigInt(text) <= UINT64_MAX);

/** An object as `<type>:<id>`, the form a body or query names it in. */
const ObjectText = z.string().min(1);
const GrantEntry = z.strictObject({
  principal: PrincipalRef,
  privilege: z.string().min(1),
});
const RoleEntry = z.strictObject({
  principal: PrincipalRef,
  role: z.string().min(1),
});
const ObjectGrants = z.strictObject({
  object: ObjectText,
  writes: z.array(GrantEntry).optional(),
  deletes: z.array(GrantEntry).optional(),
});

/** C11: `{ object, writes?, deletes? }` or `{ objects }`, never both. */
export const GrantsBody = z
  .strictObject({
    object: ObjectText.optional(),
    writes: z.array(GrantEntry).optional(),
    deletes: z.array(GrantEntry).optional(),
    objects: z.array(ObjectGrants).min(1).optional(),
  })
  .refine((body) =>
    body.objects === undefined
      ? body.object !== undefined
      : body.object === undefined &&
        body.writes === undefined &&
        body.deletes === undefined,
  );
export const RolesBody = z.strictObject({
  writes: z.array(RoleEntry).optional(),
  deletes: z.array(RoleEntry).optional(),
});
export const ChecksBody = z.strictObject({
  items: z
    .array(z.strictObject({ object: ObjectText, action: z.string().min(1) }))
    .min(1),
});

const markingBase = `${orgBase}/marking-categories`;
const CATEGORY = 'category';
const MARKING = 'marking';
const categoryShape = { ...orgParam, [CATEGORY]: Id };
const markingShape = { ...orgParam, [MARKING]: Id };

export const listGrants = defineRoute({
  ...base,
  operationId: 'listGrants',
  summary: 'One page of grants on one object',
  method: Method.enum.GET,
  path: `${orgBase}/grants`,
  check: store,
  params: orgParams,
  query: z.object({
    object: ObjectText,
    continuation: z.string().min(1).optional(),
  }),
  response: GrantsPage,
});

export const writeGrants = defineRoute({
  ...base,
  operationId: 'writeGrants',
  summary: 'Grants and revokes in one all-or-none write',
  method: Method.enum.POST,
  path: `${orgBase}/grants`,
  check: store,
  params: orgParams,
  body: GrantsBody,
  response: Empty,
});

export const listGrantable = defineRoute({
  ...base,
  operationId: 'listGrantable',
  summary: 'Lists the privileges a type can grant',
  method: Method.enum.GET,
  path: `${orgBase}/grantable/:type`,
  check: caller,
  params: z.strictObject({ ...orgParam, type: z.string().min(1) }),
  response: z.strictObject({ privileges: z.array(z.string()) }),
});

export const checkObjects = defineRoute({
  ...base,
  operationId: 'checkObjects',
  summary: 'Checks a batch of (object, action) for the caller',
  method: Method.enum.POST,
  path: `${orgBase}/checks`,
  check: caller,
  params: orgParams,
  body: ChecksBody,
  response: z.strictObject({
    decisions: z.array(
      z.strictObject({ allow: z.boolean(), reason: z.string().optional() }),
    ),
  }),
});

export const createMarkingCategory = defineRoute({
  ...base,
  operationId: 'createMarkingCategory',
  summary: 'Creates a marking category',
  method: Method.enum.POST,
  path: markingBase,
  check: store,
  params: orgParams,
  body: CreateSpaceBody,
  response: Named,
});

export const listMarkingCategories = listRoute(
  'listMarkingCategories',
  'Lists the marking categories the caller can see',
  markingBase,
  orgShape,
);

export const createMarking = defineRoute({
  ...base,
  operationId: 'createMarking',
  summary: 'Creates a marking in a category',
  method: Method.enum.POST,
  path: `${markingBase}/:category/markings`,
  check: store,
  params: z.strictObject(categoryShape),
  body: CreateSpaceBody,
  response: Named,
});

export const listMarkings = listRoute(
  'listMarkings',
  'Lists the markings the caller can see',
  `${markingBase}/:category/markings`,
  categoryShape,
);

export const writeCategoryRoles = defineRoute({
  ...base,
  operationId: 'writeCategoryRoles',
  summary: 'Grants and revokes category roles',
  method: Method.enum.POST,
  path: `${markingBase}/:category/roles`,
  check: store,
  params: z.strictObject(categoryShape),
  body: RolesBody,
  response: Empty,
});

export const writeMarkingRoles = defineRoute({
  ...base,
  operationId: 'writeMarkingRoles',
  summary: 'Grants and revokes marking roles',
  method: Method.enum.POST,
  path: `${orgBase}/markings/:marking/roles`,
  check: store,
  params: z.strictObject(markingShape),
  body: RolesBody,
  response: Empty,
});

/** The path of a marking on an object: `type` and `id` name the object as authz-api does. */
const objectMarkingShape = {
  ...orgParam,
  type: z.string().min(1),
  id: z.string().min(1),
  [MARKING]: Id,
};
const objectMarkingPath = `${orgBase}/objects/:type/:id/markings/:marking`;

export const applyMarking = defineRoute({
  ...base,
  operationId: 'applyMarking',
  summary: 'Puts a marking on an object',
  method: Method.enum.PUT,
  path: objectMarkingPath,
  check: store,
  params: z.strictObject(objectMarkingShape),
  response: Empty,
});

export const removeMarking = defineRoute({
  ...base,
  operationId: 'removeMarking',
  summary: 'Takes a marking off an object',
  method: Method.enum.DELETE,
  path: objectMarkingPath,
  check: store,
  params: z.strictObject(objectMarkingShape),
  response: Empty,
});

export const listAuditEvents = defineRoute({
  ...base,
  operationId: 'listAuditEvents',
  summary: 'One page of authz-api audit rows',
  method: Method.enum.GET,
  path: `${orgBase}/audit-events`,
  check: store,
  params: orgParams,
  query: z.object({
    object: ObjectText.optional(),
    after: Uint64Text.optional(),
  }),
  response: z.strictObject({
    events: z.array(
      z.strictObject({
        id: z.string(),
        attemptId: z.string().optional(),
        action: z.string(),
        outcome: z.string(),
        actor: z.string().optional(),
        object: z.string(),
        relation: z.string().optional(),
        target: z.string().optional(),
        statusCode: z.string().optional(),
        traceId: z.string().optional(),
        at: z.string().optional(),
      }),
    ),
    after: z.string().optional(),
  }),
});

export const authzRoutes = {
  listGrants,
  writeGrants,
  listGrantable,
  checkObjects,
  createMarkingCategory,
  listMarkingCategories,
  createMarking,
  listMarkings,
  writeCategoryRoles,
  writeMarkingRoles,
  applyMarking,
  removeMarking,
  listAuditEvents,
  createOrg,
  listOrgs,
  getOrg,
  renameOrg,
  listOrgMembers,
  addOrgMember,
  removeOrgMember,
  listRoles,
  assignOrgRole,
  unassignOrgRole,
  createSpace,
  listSpaces,
  getSpace,
  renameSpace,
  listSpaceMembers,
  addSpaceMember,
  removeSpaceMember,
  addSpaceEditor,
  removeSpaceEditor,
  createGroup,
  listGroups,
  listGroupMembers,
  addGroupMember,
  removeGroupMember,
} as const;
