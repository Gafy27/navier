import { z } from '../../../index.ts';
import {
  CheckKind,
  defineRoute,
  Method,
  RouteTag,
  WireType,
} from '../../adapter/route-types.ts';
import {
  AuthzDirectoryType,
  ObjectAction,
  ScopeResource,
  SCOPE_ACTIONS,
} from '../../adapter/scope-names.ts';

/** The id segment of the org config scope `org:config:admin`. */
const CONFIG_SCOPE_ID = z.enum({ admin: 'admin' });

const Id = z.string().min(1);
const nonNegativeInt = z.number().int().min(0);
const positiveInt = z.number().int().min(1);

const orgParams = z.strictObject({ org: Id });
const providerParams = z.strictObject({ org: Id, provider: Id });
const modelParams = z.strictObject({ org: Id, provider: Id, model: Id });

/** The thirteen org snapshot fields (`OrgSnapshotSchema` in `src/orgconfig/config.ts`), so this file stays pure. */
const SnapshotFields = {
  maxToolsPerVersion: nonNegativeInt,
  maxFallbacks: nonNegativeInt,
  maxSteps: positiveInt,
  pauseTimeout: Id,
  maxTraceOutputBytes: positiveInt,
  maxToolOutputBytes: positiveInt,
  maxToolAttempts: positiveInt,
  streamReplayTtl: Id,
  streamAccessRecheck: Id,
  streamPollHold: Id,
  streamKeepalive: Id,
  streamMaxLifetime: Id,
  maxStreamDeltasPerMessage: positiveInt,
} as const;

export const OrgSnapshotWire = z.strictObject(SnapshotFields);
export const OrgPatchBody = OrgSnapshotWire.partial();

const OrgConfigWire = z.strictObject({
  set: z.boolean(),
  seq: z.number().int().optional(),
  snapshot: OrgSnapshotWire.optional(),
});

/** A provider row. No key, no sealed field (G4). */
export const ProviderWire = z.strictObject({
  provider: z.string(),
  adapter: z.string(),
  baseUrl: z.string(),
  seq: z.number().int(),
  hasKey: z.boolean(),
  keyRevision: z.number().int().nullable(),
});

export const ModelPolicyWire = z.strictObject({
  provider: z.string(),
  model: z.string(),
  enabled: z.boolean(),
  degraded: z.boolean(),
});

const SeqWire = z.strictObject({ seq: z.number().int() });

const ERRORS = [
  WireType.enum.unauthenticated,
  WireType.enum.forbidden,
  WireType.enum.not_found,
  WireType.enum.invalid_request,
  WireType.enum.conflict,
  WireType.enum.unavailable,
  WireType.enum.internal,
];
const base = { tag: RouteTag.enum.config, errors: ERRORS } as const;
const store = { kind: CheckKind.enum.store } as const;
/** The guard of the org config reads: `org:config:admin` (P13.4 Open 2). */
const configAdmin = {
  kind: CheckKind.enum.scope,
  resource: ScopeResource.enum.org,
  action: SCOPE_ACTIONS.org.enum.config,
  id: CONFIG_SCOPE_ID.enum.admin,
} as const;

export const getOrgConfig = defineRoute({
  ...base,
  operationId: 'getOrgConfig',
  summary: 'Reads the newest org snapshot of limits',
  method: Method.enum.GET,
  path: '/orgs/:org/config',
  check: configAdmin,
  params: orgParams,
  response: OrgConfigWire,
});

export const patchOrgConfig = defineRoute({
  ...base,
  operationId: 'patchOrgConfig',
  summary: 'Appends a new org snapshot from the fields given',
  method: Method.enum.PATCH,
  path: '/orgs/:org/config',
  check: store,
  params: orgParams,
  body: OrgPatchBody,
  response: SeqWire,
});

export const listProviders = defineRoute({
  ...base,
  operationId: 'listProviders',
  summary: 'Lists the providers and whether a key is set. Never the key',
  method: Method.enum.GET,
  path: '/orgs/:org/providers',
  check: configAdmin,
  params: orgParams,
  response: z.strictObject({ items: z.array(ProviderWire) }),
});

export const setProvider = defineRoute({
  ...base,
  operationId: 'setProvider',
  summary: 'Sets the adapter and base URL of a provider',
  method: Method.enum.PUT,
  path: '/orgs/:org/providers/:provider',
  check: store,
  params: providerParams,
  body: z.strictObject({ adapter: Id, baseUrl: Id }),
  response: SeqWire,
});

export const setProviderKey = defineRoute({
  ...base,
  operationId: 'setProviderKey',
  summary:
    'Verifies a provider key with the provider, then seals it. The key is never returned',
  method: Method.enum.PUT,
  path: '/orgs/:org/providers/:provider/key',
  check: store,
  params: providerParams,
  body: z.strictObject({ key: z.string().min(1) }),
  response: SeqWire,
});

export const listModels = defineRoute({
  ...base,
  operationId: 'listModels',
  summary: 'Lists the models with enabled and degraded',
  method: Method.enum.GET,
  path: '/orgs/:org/models',
  check: {
    kind: CheckKind.enum.object,
    type: AuthzDirectoryType.enum.organization,
    idParams: ['org'],
    action: ObjectAction.enum.can_see,
  },
  params: orgParams,
  response: z.strictObject({ items: z.array(ModelPolicyWire) }),
});

export const setModelPolicy = defineRoute({
  ...base,
  operationId: 'setModelPolicy',
  summary: 'Enables, disables, or marks a model degraded',
  method: Method.enum.PUT,
  path: '/orgs/:org/models/:provider/:model',
  check: store,
  params: modelParams,
  body: z.strictObject({ enabled: z.boolean(), degraded: z.boolean() }),
  response: ModelPolicyWire,
});

export const configRoutes = {
  getOrgConfig,
  patchOrgConfig,
  listProviders,
  setProvider,
  setProviderKey,
  listModels,
  setModelPolicy,
} as const;
