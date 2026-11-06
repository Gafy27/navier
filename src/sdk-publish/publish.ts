import { isDeepStrictEqual } from 'node:util';
import { appError, createLogger, ErrorCode, z } from '../index.ts';
import type { AppError, Result } from '../index.ts';
import { createDb, parseOrgId, withTransaction } from '../db/index.ts';
import type { Db, OrgId } from '../db/index.ts';
import {
  deriveAgentId,
  emptyAgentsConfig,
  readAgent,
  saveAgent,
} from '../agents/index.ts';
import {
  registerTool,
  ServingStatus,
  servingStatus,
} from '../catalog/index.ts';
import type { CatalogConfig, ToolEntryInput } from '../catalog/index.ts';
import {
  agentPrincipalId,
  createAuthz,
  createCallerVerifier,
  DenyReason,
  formatScope,
  requestGrant,
  SCOPE_GRAMMAR,
  ScopeResource,
  ToolAction,
  ToolCreateAction,
} from '../identity/index.ts';
import type { Authz, Caller, Scope } from '../identity/index.ts';
import { Agent, SdkError } from '../sdk/index.ts';
import type { Tool } from '../sdk/index.ts';
import { toAgentDocument } from '../sdk/agent.ts';
import { toToolEntryInput } from '../sdk/tool.ts';
import { loadPublishConfig } from './config.ts';
import type { SdkPublishConfig } from './config.ts';

const BEARER_SCHEME = 'Bearer';
/** P3.3's message when a create key already belongs to another document. */
const TAKEN_ID = 'idempotencyKey: reused with another document';
const ROOT_PATH = '(root)';
const positiveInt = z.number().int().min(1);

const RetrySchema = z.object({
  onInterrupt: z.literal(true),
  attempts: positiveInt,
});

const ToolShape = z.object({
  id: z.string().refine((id) => SCOPE_GRAMMAR.tool.validId(id)),
  version: positiveInt,
  description: z.string(),
  inputSchema: z.instanceof(z.ZodType),
  outputSchema: z.instanceof(z.ZodType).optional(),
  maxToolOutputBytes: positiveInt.optional(),
  requireApproval: z.boolean().optional(),
  retry: RetrySchema.optional(),
  execute: z.function(),
});

const ToolSchema = z.custom<Tool>(
  (value) => ToolShape.safeParse(value).success,
);

export const PublishProjectSchema = z.object({
  agents: z.record(z.string(), z.instanceof(Agent)),
  tools: z.record(z.string(), ToolSchema).optional(),
});

export type PublishProject = z.infer<typeof PublishProjectSchema>;

const PublishOptionsSchema = z.object({
  credential: z.string().min(1),
  org: z.string().min(1),
  env: z.record(z.string(), z.string().optional()).optional(),
});

export type PublishOptions = z.input<typeof PublishOptionsSchema>;

export const PublishReportSchema = z.object({
  tools: z.array(
    z.object({
      key: z.string(),
      version: z.number().int(),
      enabled: z.boolean(),
      serving: ServingStatus.nullable(),
    }),
  ),
  agents: z.array(
    z.object({
      id: z.string(),
      agentId: z.string(),
      version: z.number().int(),
      changed: z.boolean(),
    }),
  ),
});

export type PublishReport = z.infer<typeof PublishReportSchema>;

type ToolReport = PublishReport['tools'][number];
type AgentReport = PublishReport['agents'][number];

export interface Session {
  readonly db: Db;
  readonly authz: Authz;
  readonly caller: Caller;
  readonly org: OrgId;
  readonly catalog: CatalogConfig;
  readonly agents: SdkPublishConfig;
}

export function fail(code: AppError['code'], message: string): never {
  throw new SdkError(appError(code, message));
}

export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  return fail(result.error.code, result.error.message);
}

/** The paths of a failed parse, never a value. */
export function issuePaths(error: z.ZodError): string {
  return [
    ...new Set(error.issues.map((issue) => issue.path.join('.') || ROOT_PATH)),
  ]
    .sort()
    .join(', ');
}

const pairKey = (key: string, version: number): string =>
  `${key}@${String(version)}`;

const toolLabel = (key: string, version: number): string =>
  `tool ${pairKey(key, version)}`;

async function open(
  options: PublishOptions,
): Promise<{ session: Session; close: () => Promise<void> }> {
  const parsed = PublishOptionsSchema.safeParse(options);
  if (!parsed.success) {
    return fail(
      ErrorCode.invalid_argument,
      `options: ${issuePaths(parsed.error)}`,
    );
  }
  const { credential, org: rawOrg, env } = parsed.data;
  const config = unwrap(loadPublishConfig(env ?? {}));
  const org = unwrap(parseOrgId(rawOrg));
  // The CLI prints its report on stdout, so log lines go to stderr.
  const log = createLogger(config.LOG_LEVEL, {
    write: (line) => void process.stderr.write(line),
  });
  const caller = unwrap(
    await createCallerVerifier(config, log).verify(
      `${BEARER_SCHEME} ${credential}`,
    ),
  );
  const database = createDb(config, log);
  return {
    session: {
      db: database.db,
      authz: createAuthz(config, log),
      caller,
      org,
      catalog: config,
      agents: config,
    },
    close: database.close,
  };
}

/** Verifies the credential, opens the connections, runs `run`, and always closes them. */
export async function withSession<T>(
  options: PublishOptions,
  run: (session: Session) => Promise<T>,
): Promise<T> {
  const { session, close } = await open(options);
  try {
    return await run(session);
  } finally {
    await close();
  }
}

function parseProject(project: PublishProject): PublishProject {
  const parsed = PublishProjectSchema.safeParse(project);
  if (!parsed.success) {
    return fail(
      ErrorCode.invalid_argument,
      `project: ${issuePaths(parsed.error)}`,
    );
  }
  return parsed.data;
}

function entryOf(tool: Tool): ToolEntryInput {
  try {
    return toToolEntryInput(tool);
  } catch (e) {
    if (!(e instanceof SdkError)) throw e;
    return fail(e.code, `${toolLabel(tool.id, tool.version)}: ${e.message}`);
  }
}

/** D2: every listed tool plus `project.tools`, one entry per pair, in key order. */
function collectEntries(project: PublishProject): ToolEntryInput[] {
  const listed = [
    ...Object.values(project.agents).flatMap(
      (agent) => toAgentDocument(agent).tools,
    ),
    ...Object.values(project.tools ?? {}),
  ];
  const byPair = new Map<string, ToolEntryInput>();
  for (const tool of listed) {
    const entry = entryOf(tool);
    const key = pairKey(entry.key, entry.implementationVersion);
    const seen = byPair.get(key);
    if (seen !== undefined && !isDeepStrictEqual(seen, entry)) {
      fail(
        ErrorCode.invalid_argument,
        `${toolLabel(entry.key, entry.implementationVersion)}: defined twice with different entries`,
      );
    }
    byPair.set(key, entry);
  }
  return [...byPair.values()].sort(
    (a, b) =>
      a.key.localeCompare(b.key) ||
      a.implementationVersion - b.implementationVersion,
  );
}

/** Whether the caller holds `scope` now. An unreachable authz-api is `unavailable`, never an answer. */
async function callerHolds(session: Session, scope: string): Promise<boolean> {
  const decision = unwrap(
    await session.authz.check(session.org, session.caller, scope),
  );
  if (decision.allow) return true;
  if (decision.reason === DenyReason.unavailable) {
    fail(ErrorCode.unavailable, 'authz-api unavailable');
  }
  return false;
}

/** D3: `RegisterTool` per key on the caller's token, then the caller's `tool:enable` and `tool:assign`. */
async function registerOwned(
  session: Session,
  keys: readonly string[],
): Promise<void> {
  const { authz, caller, org } = session;
  for (const key of keys) {
    const registered = await authz.registerTool(caller, org, key);
    if (!registered.ok) {
      if (registered.error.code !== ErrorCode.permission_denied) {
        fail(registered.error.code, `tool ${key}: ${registered.error.message}`);
      }
      const createScope = formatScope({
        resource: ScopeResource.tool_create,
        action: ToolCreateAction.enum.create,
      });
      fail(
        ErrorCode.permission_denied,
        (await callerHolds(session, createScope))
          ? `tool ${key}: owned by another principal`
          : `tool ${key}: RegisterTool refused, caller lacks ${createScope}`,
      );
    }
    for (const action of [ToolAction.enum.enable, ToolAction.enum.assign]) {
      const scope = { resource: ScopeResource.tool, action, id: key };
      const granted = await authz.grant(caller, org, caller.principal.id, [
        scope,
      ]);
      if (!granted.ok) {
        fail(
          granted.error.code,
          granted.error.code === ErrorCode.permission_denied
            ? `tool ${key}: grant ${formatScope(scope)} refused`
            : `tool ${key}: ${granted.error.message}`,
        );
      }
    }
  }
}

/** D3: the catalog write and serving status per pair. Grants nothing. */
async function writeCatalog(
  session: Session,
  entries: readonly ToolEntryInput[],
): Promise<ToolReport[]> {
  const reports: ToolReport[] = [];
  for (const entry of entries) {
    const label = toolLabel(entry.key, entry.implementationVersion);
    const registered = await withTransaction(session.db, (tx) =>
      registerTool(
        tx,
        session.catalog,
        session.org,
        entry,
        session.caller.principal,
      ),
    );
    if (!registered.ok) {
      const { code, message } = registered.error;
      fail(
        code,
        code === ErrorCode.already_exists
          ? `${label}: entry changed without a version bump`
          : `${label}: ${message}`,
      );
    }
    reports.push({
      key: entry.key,
      version: entry.implementationVersion,
      enabled: registered.value.enabled,
      serving: await servingStatus(
        session.db,
        session.org,
        entry.key,
        entry.implementationVersion,
      ),
    });
  }
  return reports;
}

/** D3 and D4: derive, read, create or update, then record the scope requests. */
async function publishAgent(
  session: Session,
  agent: Agent,
): Promise<AgentReport> {
  const { db, authz, caller, org } = session;
  const { document, tools } = toAgentDocument(agent);
  const agentId = deriveAgentId(org, agent.id);
  const existing = await readAgent({ db, authz }, caller, org, agentId);
  if (!existing.ok && existing.error.code !== ErrorCode.not_found) {
    fail(existing.error.code, `agent ${agent.id}: ${existing.error.message}`);
  }
  const saved = await saveAgent(
    { db, authz, config: emptyAgentsConfig },
    caller,
    org,
    existing.ok
      ? { id: agentId, document }
      : { idempotencyKey: agent.id, document },
  );
  if (!saved.ok) {
    const { code, message } = saved.error;
    const taken = code === ErrorCode.invalid_argument && message === TAKEN_ID;
    fail(
      code,
      `agent ${agent.id}: ${taken ? 'id is taken or not readable' : message}`,
    );
  }
  const principal = unwrap(agentPrincipalId(org, saved.value.id));
  const scopes: Scope[] = tools.map((tool) => ({
    resource: ScopeResource.tool,
    action: ToolAction.enum.invoke,
    id: tool.id,
  }));
  unwrap(
    await withTransaction(db, (tx) =>
      requestGrant(tx, org, principal, scopes, caller.principal),
    ),
  );
  return {
    id: agent.id,
    agentId: saved.value.id,
    version: saved.value.version,
    changed: saved.value.changed,
  };
}

/** D3: `sdk register`. Registers each key, grants the caller enable and assign, then writes the catalog. */
export async function registerTools(
  project: PublishProject,
  options: PublishOptions,
): Promise<PublishReport> {
  const checked = parseProject(project);
  return withSession(options, async (session) => {
    const entries = collectEntries(checked);
    await registerOwned(session, [...new Set(entries.map((e) => e.key))]);
    return { tools: await writeCatalog(session, entries), agents: [] };
  });
}

/** D3: `sdk publish`. Writes the catalog and saves each agent in record order. No grant. */
export async function publish(
  project: PublishProject,
  options: PublishOptions,
): Promise<PublishReport> {
  const checked = parseProject(project);
  return withSession(options, async (session) => {
    const tools = await writeCatalog(session, collectEntries(checked));
    const agents: AgentReport[] = [];
    for (const agent of Object.values(checked.agents)) {
      agents.push(await publishAgent(session, agent));
    }
    return { tools, agents };
  });
}
