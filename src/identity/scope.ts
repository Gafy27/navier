import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';

/** The closed set of scope resources. */
export const ScopeResource = {
  agent: 'agent',
  tool: 'tool',
  fs: 'fs',
  sandbox: 'sandbox',
  model: 'model',
  agent_create: 'agent_create',
  tool_create: 'tool_create',
  org: 'org',
} as const;

export type ScopeResource = (typeof ScopeResource)[keyof typeof ScopeResource];

/** Actions per resource. The grammar and `Scope` both come from these. */
export const AgentAction = z.enum({
  write: 'write',
  admin: 'admin',
});
export const ToolAction = z.enum({
  invoke: 'invoke',
  assign: 'assign',
  enable: 'enable',
  register: 'register',
});
export const FsAction = z.enum({ read: 'read', write: 'write' });
export const SandboxAction = z.enum({ exec: 'exec' });
export const ModelAction = z.enum({ admin: 'admin' });
export const AgentCreateAction = z.enum({ create: 'create' });
export const ToolCreateAction = z.enum({ create: 'create' });
export const OrgAction = z.enum({ config: 'config' });

export type AgentAction = z.infer<typeof AgentAction>;
export type ToolAction = z.infer<typeof ToolAction>;
export type FsAction = z.infer<typeof FsAction>;
export type SandboxAction = z.infer<typeof SandboxAction>;
export type ModelAction = z.infer<typeof ModelAction>;
export type AgentCreateAction = z.infer<typeof AgentCreateAction>;
export type ToolCreateAction = z.infer<typeof ToolCreateAction>;
export type OrgAction = z.infer<typeof OrgAction>;

const IdPresence = z.enum({ required: 'required', forbidden: 'forbidden' });

const toolKey = /^[a-z0-9][a-z0-9_.-]*$/u;
const idBan = /[:#]|\s/u;

function validFsPath(path: string): boolean {
  if (!path.startsWith('/') || path.includes('//')) return false;
  if (path !== '/' && path.endsWith('/')) return false;
  return !path.split('/').includes('..');
}

const AgentScopeId = z
  .string()
  .min(1)
  .refine((id) => !idBan.test(id));
const ToolScopeId = z.string().regex(toolKey);
const FsScopeId = z.string().refine(validFsPath);
const AbsentId = z.never().optional();

const ScopeSchema = z.discriminatedUnion('resource', [
  z.object({
    resource: z.literal(ScopeResource.agent),
    action: AgentAction,
    id: AgentScopeId,
  }),
  z.object({
    resource: z.literal(ScopeResource.tool),
    action: ToolAction,
    id: ToolScopeId,
  }),
  z.object({
    resource: z.literal(ScopeResource.fs),
    action: FsAction,
    id: FsScopeId,
  }),
  z.strictObject({
    resource: z.literal(ScopeResource.sandbox),
    action: SandboxAction,
    id: AbsentId,
  }),
  z.strictObject({
    resource: z.literal(ScopeResource.model),
    action: ModelAction,
    id: AbsentId,
  }),
  z.strictObject({
    resource: z.literal(ScopeResource.agent_create),
    action: AgentCreateAction,
    id: AbsentId,
  }),
  z.strictObject({
    resource: z.literal(ScopeResource.tool_create),
    action: ToolCreateAction,
    id: AbsentId,
  }),
  z.object({
    resource: z.literal(ScopeResource.org),
    action: OrgAction,
    id: AgentScopeId,
  }),
]);

/** A parsed scope. `id` is present exactly when the resource requires one. */
export type Scope = z.infer<typeof ScopeSchema>;

interface GrammarRow {
  readonly actions: readonly string[];
  readonly id: z.infer<typeof IdPresence>;
  readonly validId: (id: string) => boolean;
}

function requiredRow(
  action: z.ZodEnum<Record<string, string>>,
  id: z.ZodType<string>,
): GrammarRow {
  return {
    actions: Object.freeze([...action.options]),
    id: IdPresence.enum.required,
    validId: (value) => id.safeParse(value).success,
  };
}

function forbiddenRow(action: z.ZodEnum<Record<string, string>>): GrammarRow {
  return {
    actions: Object.freeze([...action.options]),
    id: IdPresence.enum.forbidden,
    validId: () => false,
  };
}

/** The full scope list. A new scope is a design change. */
export const SCOPE_GRAMMAR: Readonly<Record<ScopeResource, GrammarRow>> =
  Object.freeze({
    agent: requiredRow(AgentAction, AgentScopeId),
    tool: requiredRow(ToolAction, ToolScopeId),
    fs: requiredRow(FsAction, FsScopeId),
    sandbox: forbiddenRow(SandboxAction),
    model: forbiddenRow(ModelAction),
    agent_create: forbiddenRow(AgentCreateAction),
    tool_create: forbiddenRow(ToolCreateAction),
    org: requiredRow(OrgAction, AgentScopeId),
  });

function invalid(): Result<never> {
  return err(appError(ErrorCode.invalid_argument, 'invalid scope'));
}

/** Parses `resource:action[:id]`. Only the first two colons split. The error never echoes the input. */
export function parseScope(raw: unknown): Result<Scope> {
  if (typeof raw !== 'string') return invalid();
  const first = raw.indexOf(':');
  if (first === -1) return invalid();
  const second = raw.indexOf(':', first + 1);
  const resource = raw.slice(0, first);
  const action = raw.slice(first + 1, second === -1 ? undefined : second);
  const id = second === -1 ? undefined : raw.slice(second + 1);
  const parsed = ScopeSchema.safeParse(
    id === undefined ? { resource, action } : { resource, action, id },
  );
  if (!parsed.success) return invalid();
  return ok(parsed.data);
}

/** The inverse of `parseScope`. */
export function formatScope(scope: Scope): string {
  const head = `${scope.resource}:${scope.action}`;
  return scope.id === undefined ? head : `${head}:${scope.id}`;
}
