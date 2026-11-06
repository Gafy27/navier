#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appError, ErrorCode, loadConfig, z } from '../index.ts';
import {
  drainTool,
  retireTool,
  ServingStatus,
  servingStatus,
} from '../catalog/index.ts';
import { SCOPE_GRAMMAR } from '../identity/index.ts';
import { listPinnedImplementations } from '../runtime/index.ts';
import { SdkError } from '../sdk/index.ts';
import {
  grantAgentRequests,
  listAgentRequests,
  setModelEnabled,
  setToolEnabled,
} from './admin.ts';
import {
  setOrgConfigFields,
  setProviderKeyFromStdin,
  setProviderRow,
  showOrgConfig,
  showProvider,
} from './orgconfig-admin.ts';
import { requireKeyFile } from '../orgconfig/index.ts';
import {
  issuePaths,
  publish,
  PublishProjectSchema,
  registerTools,
  withSession,
} from './publish.ts';
import type { PublishOptions, PublishProject } from './publish.ts';
import {
  addProjectMember,
  createProject,
  placeTool,
  releaseAgent,
  setVisibility,
} from './project-admin.ts';

/** The command names, `sdk <command> <target>`. */
const Command = z.enum({
  register: 'register',
  publish: 'publish',
  drain: 'drain',
  retire: 'retire',
  'enable-tool': 'enable-tool',
  'enable-model': 'enable-model',
  requests: 'requests',
  grant: 'grant',
  release: 'release',
  visibility: 'visibility',
});

type Command = z.infer<typeof Command>;

/** Commands that take words after the target: `grant` scopes, `release` a project, `visibility` a state. */
const TAKES_EXTRA: readonly Command[] = [
  Command.enum.grant,
  Command.enum.release,
  Command.enum.visibility,
];

const Visibility = z.enum({
  published: 'published',
  unpublished: 'unpublished',
});

const ExitCode = { success: 0, failure: 1, usage: 2 } as const;

const PAIR_PATTERN = /^([^@]+)@([1-9]\d*)$/u;
const INTERNAL_MESSAGE = 'internal error';

/** The credential and org come from the environment, never from argv (D6). */
const CliEnvSchema = z.object({
  SDK_CREDENTIAL: z.string().min(1),
  SDK_ORG: z.string().min(1),
});

const ToolPairSchema = z.string().transform((text, ctx) => {
  const match = PAIR_PATTERN.exec(text);
  const key = match?.[1];
  const version = match?.[2];
  const implementationVersion =
    version === undefined ? Number.NaN : Number(version);
  if (
    key === undefined ||
    !Number.isSafeInteger(implementationVersion) ||
    !SCOPE_GRAMMAR.tool.validId(key)
  ) {
    ctx.addIssue({ code: 'custom', message: 'key@version' });
    return z.NEVER;
  }
  return { key, implementationVersion };
});

const LEGACY_COMMANDS = Object.values(Command.enum).join('|');
const USAGE = `usage: sdk <${LEGACY_COMMANDS}|config|provider|project> <target> [args...]`;

type Env = Readonly<Record<string, string | undefined>>;

function fail(code: ErrorCode, message: string): never {
  throw new SdkError(appError(code, message));
}

/** D5: a constructor error keeps its message; any other throw is `internal` with no stack. */
async function loadProject(modulePath: string): Promise<PublishProject> {
  let loaded: unknown;
  try {
    loaded = await import(pathToFileURL(resolve(modulePath)).href);
  } catch (e) {
    if (e instanceof SdkError) fail(ErrorCode.invalid_argument, e.message);
    return fail(ErrorCode.internal, INTERNAL_MESSAGE);
  }
  const parsed = PublishProjectSchema.safeParse(loaded);
  if (!parsed.success) {
    return fail(
      ErrorCode.invalid_argument,
      `module: ${issuePaths(parsed.error)}`,
    );
  }
  return parsed.data;
}

function parsePair(target: string): z.infer<typeof ToolPairSchema> {
  const pair = ToolPairSchema.safeParse(target);
  if (!pair.success)
    return fail(ErrorCode.invalid_argument, 'target: key@version');
  return pair.data;
}

function parseModel(target: string): { provider: string; model: string } {
  const slash = target.indexOf('/');
  const provider = target.slice(0, slash);
  const model = target.slice(slash + 1);
  if (slash === -1 || provider === '' || model === '') {
    return fail(ErrorCode.invalid_argument, 'target: provider/model');
  }
  return { provider, model };
}

interface PairReport {
  readonly key: string;
  readonly version: number;
  readonly serving: z.infer<typeof ServingStatus> | null;
}

async function operate(
  command: typeof Command.enum.drain | typeof Command.enum.retire,
  target: string,
  options: PublishOptions,
): Promise<PairReport> {
  const { key, implementationVersion } = parsePair(target);
  return withSession(options, async ({ db, authz, caller, org }) => {
    const done =
      command === Command.enum.drain
        ? await drainTool(authz, db, caller, org, key, implementationVersion)
        : await retireTool(
            { authz, db, listPinned: listPinnedImplementations },
            caller,
            org,
            key,
            implementationVersion,
          );
    if (!done.ok) throw new SdkError(done.error);
    return {
      key,
      version: implementationVersion,
      serving: await servingStatus(db, org, key, implementationVersion),
    };
  });
}

type Handler = (
  target: string,
  scopes: readonly string[],
  options: PublishOptions,
) => Promise<object>;

const handlers: Record<Command, Handler> = {
  register: async (target, _scopes, options) =>
    registerTools(await loadProject(target), options),
  publish: async (target, _scopes, options) =>
    publish(await loadProject(target), options),
  drain: (target, _scopes, options) =>
    operate(Command.enum.drain, target, options),
  retire: (target, _scopes, options) =>
    operate(Command.enum.retire, target, options),
  'enable-tool': (target, _scopes, options) => {
    const { key, implementationVersion } = parsePair(target);
    return setToolEnabled({ key, version: implementationVersion }, options);
  },
  'enable-model': (target, _scopes, options) =>
    setModelEnabled(parseModel(target), options),
  requests: (target, _scopes, options) => listAgentRequests(target, options),
  grant: (target, scopes, options) =>
    grantAgentRequests(
      target,
      scopes.length === 0 ? undefined : scopes,
      options,
    ),
  release: (target, scopes, options) => {
    const [project] = scopes;
    if (project === undefined || scopes.length !== 1) {
      return fail(ErrorCode.invalid_argument, 'release: invalid');
    }
    return releaseAgent(target, project, options);
  },
  visibility: (target, scopes, options) => {
    const [state] = scopes;
    const parsed = Visibility.safeParse(state);
    if (!parsed.success || scopes.length !== 1) {
      return fail(ErrorCode.invalid_argument, 'visibility: invalid');
    }
    return setVisibility(target, parsed.data, options);
  },
};

function print(stream: NodeJS.WriteStream, value: object): void {
  stream.write(`${JSON.stringify(value)}\n`);
}

/** Config loading must not see the bearer. The verifier receives it on its own. */
function withoutCredential(env: Env): Env {
  const copy: Record<string, string | undefined> = { ...env };
  delete copy['SDK_CREDENTIAL'];
  return copy;
}

async function runOrgConfig(
  group: 'config' | 'provider',
  sub: string | undefined,
  rest: readonly string[],
  options: PublishOptions,
): Promise<object> {
  if (group === 'config') {
    if (sub === 'show') {
      if (rest.length > 0)
        return fail(ErrorCode.invalid_argument, 'config: invalid');
      return showOrgConfig(options);
    }
    if (sub === 'set') return setOrgConfigFields(rest, options);
    return fail(ErrorCode.invalid_argument, 'config: invalid');
  }
  const [provider, adapter, baseUrl, ...tail] = rest;
  if (sub === 'show') {
    if (provider === undefined || adapter !== undefined || tail.length > 0) {
      return fail(ErrorCode.invalid_argument, 'provider: invalid');
    }
    return showProvider(provider, options);
  }
  if (sub === 'set') {
    if (
      provider === undefined ||
      adapter === undefined ||
      baseUrl === undefined ||
      tail.length > 0
    ) {
      return fail(ErrorCode.invalid_argument, 'provider: invalid');
    }
    return setProviderRow(provider, adapter, baseUrl, options);
  }
  if (sub === 'set-key') {
    if (provider === undefined || adapter !== undefined || tail.length > 0) {
      return fail(ErrorCode.invalid_argument, 'key: invalid');
    }
    return setProviderKeyFromStdin(provider, tail, options);
  }
  return fail(ErrorCode.invalid_argument, 'provider: invalid');
}

/** D3: `project create|add-member|place-tool`. Each arity is the program's `project: invalid`. */
async function runProject(
  sub: string,
  rest: readonly string[],
  options: PublishOptions,
): Promise<object> {
  const [first, second] = rest;
  if (first === undefined)
    return fail(ErrorCode.invalid_argument, 'project: invalid');
  if (sub === 'create' && rest.length === 1)
    return createProject(first, options);
  if (second === undefined || rest.length !== 2) {
    return fail(ErrorCode.invalid_argument, 'project: invalid');
  }
  if (sub === 'add-member') return addProjectMember(first, second, options);
  if (sub === 'place-tool') return placeTool(first, second, options);
  return fail(ErrorCode.invalid_argument, 'project: invalid');
}

async function main(argv: readonly string[], env: Env): Promise<number> {
  const keyFile = requireKeyFile();
  if (!keyFile.ok) {
    print(process.stdout, {
      code: keyFile.error.code,
      message: keyFile.error.message,
    });
    return ExitCode.failure;
  }
  const [name, target, ...extra] = argv;
  const isOrgGroup = name === 'config' || name === 'provider';
  const isProjectGroup = name === 'project';
  const isGroup = isOrgGroup || isProjectGroup;
  const command = Command.safeParse(name);
  const takesExtra = command.success && TAKES_EXTRA.includes(command.data);
  if (
    !isGroup &&
    (!command.success ||
      target === undefined ||
      (extra.length > 0 && !takesExtra))
  ) {
    process.stderr.write(`${USAGE}\n`);
    return ExitCode.usage;
  }
  if (target === undefined) {
    process.stderr.write(`${USAGE}\n`);
    return ExitCode.usage;
  }
  const sub = target;
  try {
    const variables = loadConfig(CliEnvSchema, env);
    if (!variables.ok) throw new SdkError(variables.error);
    const options: PublishOptions = {
      credential: variables.value.SDK_CREDENTIAL,
      org: variables.value.SDK_ORG,
      env: withoutCredential(env),
    };
    if (!isGroup && !command.success) {
      process.stderr.write(`${USAGE}\n`);
      return ExitCode.usage;
    }
    const report = isOrgGroup
      ? await runOrgConfig(name, sub, extra, options)
      : isProjectGroup
        ? await runProject(sub, extra, options)
        : await handlers[command.data as Command](sub, extra, options);
    print(process.stdout, report);
    return ExitCode.success;
  } catch (e) {
    const error =
      e instanceof SdkError
        ? { code: e.code, message: e.message }
        : { code: ErrorCode.internal, message: INTERNAL_MESSAGE };
    print(process.stdout, error);
    return ExitCode.failure;
  }
}

process.exit(await main(process.argv.slice(2), process.env));
