import { z } from '../../../index.ts';
import {
  CheckKind,
  defineRoute,
  Method,
  RouteTag,
  WireType,
} from '../../adapter/route-types.ts';
import { ScopeResource, SCOPE_ACTIONS } from '../../adapter/scope-names.ts';

/** Which agents a list returns: those the caller may use, or may write (`listAgents`). */
export const AgentView = z.enum({ use: 'use', write: 'write' });
export type AgentView = z.infer<typeof AgentView>;

/** A copy of `AgentStatus` in `src/agents/head.ts`, so this file stays pure. */
export const AgentStatusWire = z.enum({
  active: 'active',
  archived: 'archived',
});

const Id = z.string().min(1);
const PageLimit = z.coerce.number().int();
const VersionNumber = z.coerce.number().int();

const orgParams = z.strictObject({ org: Id });
const agentParams = z.strictObject({ org: Id, agent: Id });
const versionParams = z.strictObject({
  org: Id,
  agent: Id,
  version: VersionNumber,
});

export const AgentWire = z.strictObject({
  id: z.string(),
  principal: z.string(),
  status: AgentStatusWire,
  activeVersion: z.number().int(),
  createdBy: z.string(),
  createdAt: z.string(),
});

export const VersionWire = z.strictObject({
  number: z.number().int(),
  definition: z.record(z.string(), z.unknown()),
  hash: z.string(),
  authorId: z.string(),
  createdAt: z.string(),
});

const AgentRead = z.strictObject({ record: AgentWire, version: VersionWire });
const SaveWire = z.strictObject({
  id: z.string(),
  version: z.number().int(),
  changed: z.boolean(),
});
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
const base = { tag: RouteTag.enum.agents, errors: ERRORS } as const;
const store = { kind: CheckKind.enum.store } as const;

export const listAgents = defineRoute({
  ...base,
  operationId: 'listAgents',
  summary: 'Lists the agents the caller can see, filtered before the limit',
  method: Method.enum.GET,
  path: '/orgs/:org/agents',
  check: store,
  params: orgParams,
  query: z.object({
    view: AgentView,
    limit: PageLimit,
    cursor: Id.optional(),
  }),
  response: z.strictObject({
    items: z.array(AgentWire),
    cursor: z.string().optional(),
  }),
});

export const createAgent = defineRoute({
  ...base,
  operationId: 'createAgent',
  summary: 'Creates an agent from a full document and an idempotency key',
  method: Method.enum.POST,
  path: '/orgs/:org/agents',
  check: {
    kind: CheckKind.enum.scope,
    resource: ScopeResource.enum.agent_create,
    action: SCOPE_ACTIONS.agent_create.enum.create,
  },
  params: orgParams,
  body: z.strictObject({ idempotencyKey: Id, document: z.unknown() }),
  response: SaveWire,
});

export const getAgent = defineRoute({
  ...base,
  operationId: 'getAgent',
  summary: 'Reads the agent record and one version, the active one by default',
  method: Method.enum.GET,
  path: '/orgs/:org/agents/:agent',
  check: store,
  params: agentParams,
  query: z.object({ version: VersionNumber.optional() }),
  response: AgentRead,
});

export const updateAgent = defineRoute({
  ...base,
  operationId: 'updateAgent',
  summary: 'Writes a new version, or returns changed false and writes nothing',
  method: Method.enum.PUT,
  path: '/orgs/:org/agents/:agent',
  check: store,
  params: agentParams,
  body: z.strictObject({ document: z.unknown() }),
  response: SaveWire,
});

export const listAgentVersions = defineRoute({
  ...base,
  operationId: 'listAgentVersions',
  summary: 'Lists the versions of an agent, newest first',
  method: Method.enum.GET,
  path: '/orgs/:org/agents/:agent/versions',
  check: store,
  params: agentParams,
  query: z.object({ limit: PageLimit, before: VersionNumber.optional() }),
  response: z.strictObject({ items: z.array(VersionWire) }),
});

export const getAgentVersion = defineRoute({
  ...base,
  operationId: 'getAgentVersion',
  summary: 'Reads one read-only version of an agent',
  method: Method.enum.GET,
  path: '/orgs/:org/agents/:agent/versions/:version',
  check: store,
  params: versionParams,
  response: AgentRead,
});

export const archiveAgent = defineRoute({
  ...base,
  operationId: 'archiveAgent',
  summary: 'Stops new messages to the agent. Pinned messages finish',
  method: Method.enum.POST,
  path: '/orgs/:org/agents/:agent/archive',
  check: store,
  params: agentParams,
  response: AgentWire,
});

export const restoreAgent = defineRoute({
  ...base,
  operationId: 'restoreAgent',
  summary: 'Accepts new messages to the agent again',
  method: Method.enum.POST,
  path: '/orgs/:org/agents/:agent/restore',
  check: store,
  params: agentParams,
  response: AgentWire,
});

export const publishAgentVersion = defineRoute({
  ...base,
  operationId: 'publishAgentVersion',
  summary: 'Seals the version with one pin per tool to the space',
  method: Method.enum.POST,
  path: '/orgs/:org/agents/:agent/versions/:version/publish',
  check: store,
  params: versionParams,
  body: z.strictObject({ space: Id, tools: z.array(Id).optional() }),
  response: z.strictObject({
    pins: z.array(z.strictObject({ toolKey: z.string(), space: z.string() })),
  }),
});

export const setAgentPublished = defineRoute({
  ...base,
  operationId: 'setAgentPublished',
  summary: 'Sets or clears the organization-wide open flag of the agent',
  method: Method.enum.PUT,
  path: '/orgs/:org/agents/:agent/published',
  check: store,
  params: agentParams,
  body: z.strictObject({ published: z.boolean() }),
  response: Empty,
});

export const agentsRoutes = {
  listAgents,
  createAgent,
  getAgent,
  updateAgent,
  listAgentVersions,
  getAgentVersion,
  archiveAgent,
  restoreAgent,
  publishAgentVersion,
  setAgentPublished,
} as const;
