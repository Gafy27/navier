import { z } from '../../../index.ts';
import {
  CheckKind,
  defineRoute,
  Method,
  RouteTag,
  WireType,
} from '../../adapter/route-types.ts';
import {
  ObjectAction,
  ScopeResource,
  SCOPE_ACTIONS,
} from '../../adapter/scope-names.ts';

/** A copy of the catalog's approval levels (`src/catalog/catalog.ts`), so this file stays pure. */
export const ToolApproval = z.enum({
  never_ask: 'never_ask',
  low: 'low',
  medium: 'medium',
  high: 'high',
});

/** A copy of `ServingStatus` in `src/catalog/serving.ts`. */
export const ToolServing = z.enum({
  served: 'served',
  draining: 'draining',
  retired: 'retired',
});

const Id = z.string().min(1);
const positiveInt = z.number().int().min(1);
const jsonObject = z.record(z.string(), z.unknown());

const orgParams = z.strictObject({ org: Id });
const toolParams = z.strictObject({ org: Id, tool: Id });

/** The `ToolEntryInput` shape (C12). The catalog parses it again, strictly. */
export const ToolEntryBody = z.strictObject({
  key: Id,
  implementationVersion: positiveInt,
  name: z.string().min(1),
  description: z.string(),
  inputSchema: jsonObject,
  retryOnInterrupt: z.boolean().optional(),
  toolAttempts: positiveInt.optional(),
  maxToolOutputBytes: positiveInt.optional(),
  approval: ToolApproval,
  configSchema: jsonObject.nullish(),
});

export const ToolWire = z.strictObject({
  org: z.string(),
  key: z.string(),
  implementationVersion: z.number().int(),
  name: z.string(),
  description: z.string(),
  inputSchema: jsonObject,
  retryOnInterrupt: z.boolean(),
  toolAttempts: z.number().int(),
  maxToolOutputBytes: z.number().int(),
  approval: ToolApproval,
  configSchema: jsonObject.nullable(),
  enabled: z.boolean(),
});

const VersionBody = z.strictObject({ implementationVersion: positiveInt });
const Empty = z.strictObject({});

const ERRORS = [
  WireType.enum.unauthenticated,
  WireType.enum.forbidden,
  WireType.enum.not_found,
  WireType.enum.invalid_request,
  WireType.enum.conflict,
  WireType.enum.unavailable,
  WireType.enum.internal,
];
const base = { tag: RouteTag.enum.tools, errors: ERRORS } as const;
const store = { kind: CheckKind.enum.store } as const;

export const listTools = defineRoute({
  ...base,
  operationId: 'listTools',
  summary:
    'Lists the catalog tools the caller can see, filtered before the limit',
  method: Method.enum.GET,
  path: '/orgs/:org/tools',
  check: store,
  params: orgParams,
  query: z.object({ limit: z.coerce.number().int() }),
  response: z.strictObject({ items: z.array(ToolWire) }),
});

export const createTool = defineRoute({
  ...base,
  operationId: 'createTool',
  summary: 'Adds a tool to the catalog. The caller owns it',
  method: Method.enum.POST,
  path: '/orgs/:org/tools',
  check: {
    kind: CheckKind.enum.scope,
    resource: ScopeResource.enum.tool_create,
    action: SCOPE_ACTIONS.tool_create.enum.create,
  },
  params: orgParams,
  body: ToolEntryBody,
  response: ToolWire,
});

export const getTool = defineRoute({
  ...base,
  operationId: 'getTool',
  summary: 'Reads one tool version and its serving status',
  method: Method.enum.GET,
  path: '/orgs/:org/tools/:tool',
  check: {
    kind: CheckKind.enum.object,
    type: ScopeResource.enum.tool,
    idParams: ['org', 'tool'],
    action: ObjectAction.enum.can_see,
  },
  params: toolParams,
  query: z.object({ implementationVersion: z.coerce.number().int() }),
  response: ToolWire.extend({ serving: ToolServing.nullable() }),
});

export const setToolEnabled = defineRoute({
  ...base,
  operationId: 'setToolEnabled',
  summary:
    'Turns org availability of a tool version on or off. Not the tool#enable grant, which is set on /grants',
  method: Method.enum.PUT,
  path: '/orgs/:org/tools/:tool/enabled',
  check: store,
  params: toolParams,
  body: z.strictObject({
    implementationVersion: positiveInt,
    enabled: z.boolean(),
  }),
  response: ToolWire,
});

export const drainTool = defineRoute({
  ...base,
  operationId: 'drainTool',
  summary:
    'Marks a served tool version draining. Already draining or retired writes nothing',
  method: Method.enum.POST,
  path: '/orgs/:org/tools/:tool/drain',
  check: store,
  params: toolParams,
  body: VersionBody,
  response: Empty,
});

export const retireTool = defineRoute({
  ...base,
  operationId: 'retireTool',
  summary: 'Retires a draining tool version no pinned agent message still uses',
  method: Method.enum.POST,
  path: '/orgs/:org/tools/:tool/retire',
  check: store,
  params: toolParams,
  body: VersionBody,
  response: Empty,
});

export const setToolSpaces = defineRoute({
  ...base,
  operationId: 'setToolSpaces',
  summary:
    'Adds or removes spaces of the tool. Members of a space can invoke it',
  method: Method.enum.POST,
  path: '/orgs/:org/tools/:tool/spaces',
  check: store,
  params: toolParams,
  body: z.strictObject({ add: z.array(Id), remove: z.array(Id) }),
  response: Empty,
});

export const toolsRoutes = {
  listTools,
  createTool,
  getTool,
  setToolEnabled,
  drainTool,
  retireTool,
  setToolSpaces,
} as const;
