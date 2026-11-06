import { Command, CommanderError } from 'commander';
import { createClient, WireType } from '../client/index.ts';
import type { ClientResult, StreamEvent } from '../client/index.ts';
import { registerApi } from './commands/api/index.ts';
import { registerAuth } from './commands/auth/index.ts';
import { loginDeps, runLogin } from './commands/auth/login.ts';
import { createServiceTokens } from './commands/auth/service-token.ts';
import { registerChat } from './commands/chat/index.ts';
import { registerContext } from './commands/context/index.ts';
import { registerDb } from './commands/db/index.ts';
import { registerGrant } from './commands/grant/index.ts';
import { registerInit } from './commands/init/index.ts';
import { registerMigrate } from './commands/migrate/index.ts';
import { registerModel } from './commands/model/index.ts';
import { registerResources } from './commands/resources/index.ts';
import { registerTool } from './commands/tool/index.ts';
import type { Client, CliContext, CliEnv } from './utils/context.ts';
import { createCredentialsStore } from './utils/credentials.ts';
import {
  CliFailure,
  CliUsage,
  EXIT_FAIL,
  EXIT_OK,
  EXIT_USAGE,
  printUsage,
} from './utils/failure.ts';

export { CliFailure } from './utils/failure.ts';
export type {
  Child,
  Client,
  CliContext,
  CliEnv,
  Io,
  Spawn,
} from './utils/context.ts';

type PlainOperation = (
  input: Record<string, unknown>,
) => Promise<ClientResult<unknown>>;

type StreamOperation = (
  input: Record<string, unknown>,
) => AsyncIterable<StreamEvent>;

interface OpenedStream {
  readonly first: IteratorResult<StreamEvent>;
  readonly rest: AsyncIterator<StreamEvent>;
}

const EXPIRED = 'run cli login';

// shortcut: operationId indexes the client methods; the operation-key test pins them. Upgrade when a key is not a method.
function plainOperation(client: Client, operationId: string): PlainOperation {
  const method = (
    client as unknown as Record<string, PlainOperation | undefined>
  )[operationId];
  if (typeof method !== 'function') throw new CliUsage('unknown operation');
  return method;
}

function streamOperation(client: Client, operationId: string): StreamOperation {
  const method = (
    client.stream as unknown as Record<string, StreamOperation | undefined>
  )[operationId];
  if (typeof method !== 'function') throw new CliUsage('unknown operation');
  return method;
}

/** `StreamFailure` is not on the client entry, so match its name and `type`. */
function isUnauthenticatedStream(cause: unknown): boolean {
  return (
    cause instanceof Error &&
    cause.name === 'StreamFailure' &&
    'type' in cause &&
    cause.type === WireType.enum.unauthenticated
  );
}

function isUnauthenticated(result: ClientResult<unknown>): boolean {
  return !result.ok && result.error.type === WireType.enum.unauthenticated;
}

async function* resumed({
  first,
  rest,
}: OpenedStream): AsyncGenerator<StreamEvent> {
  if (first.done === true) return;
  yield first.value;
  for (
    let next = await rest.next();
    next.done !== true;
    next = await rest.next()
  ) {
    yield next.value;
  }
}

/** The per-run context. Exported so a test can drive `call` and `streamCall` without a command. */
export function createContext(env: CliEnv): CliContext {
  const credentials = createCredentialsStore(env.configDir);
  const tokens = createServiceTokens(env.fetch, Date.now, env.loopbackHost);
  let held: Client | undefined;

  async function build(): Promise<Client> {
    const file = await credentials.read();
    if (file === undefined) throw new CliFailure(EXPIRED);
    const { auth } = file;
    const token = auth.kind === 'service' ? await tokens.get(auth) : undefined;
    return createClient({
      baseUrl: file.baseUrl,
      credential: () => (auth.kind === 'person' ? auth.session : token),
      fetch: env.fetch,
    });
  }

  async function client(): Promise<Client> {
    held ??= await build();
    return held;
  }

  /** One interactive login against the file's own `baseUrl`; a service credential or no TTY cannot (PD11). */
  async function relogin(): Promise<void> {
    const file = await credentials.read();
    if (!env.io.isTTY || file?.auth.kind !== 'person') {
      throw new CliFailure(EXPIRED);
    }
    await runLogin(loginDeps(env), credentials, file.baseUrl, env.loopbackHost);
    held = undefined;
  }

  async function invoke(
    operationId: string,
    input: Record<string, unknown>,
  ): Promise<ClientResult<unknown>> {
    return plainOperation(await client(), operationId)(input);
  }

  async function call(
    operationId: string,
    input: Record<string, unknown>,
  ): Promise<ClientResult<unknown>> {
    const first = await invoke(operationId, input);
    if (!isUnauthenticated(first)) return first;
    await relogin();
    const second = await invoke(operationId, input);
    if (isUnauthenticated(second)) throw new CliFailure(EXPIRED);
    return second;
  }

  async function openStream(
    operationId: string,
    input: Record<string, unknown>,
  ): Promise<OpenedStream> {
    const frames = streamOperation(await client(), operationId)(input);
    const rest = frames[Symbol.asyncIterator]();
    return { first: await rest.next(), rest };
  }

  async function streamCall(
    operationId: string,
    input: Record<string, unknown>,
  ): Promise<AsyncIterable<StreamEvent>> {
    try {
      return resumed(await openStream(operationId, input));
    } catch (cause) {
      if (!isUnauthenticatedStream(cause)) throw cause;
    }
    await relogin();
    try {
      return resumed(await openStream(operationId, input));
    } catch (cause) {
      if (isUnauthenticatedStream(cause)) throw new CliFailure(EXPIRED);
      throw cause;
    }
  }

  return { env, credentials, tokens, client, call, streamCall };
}

/** Runs one invocation and returns its exit code (PD8). Registers and maps errors; no rule lives here. */
export async function runCli(
  argv: readonly string[],
  env: CliEnv,
): Promise<number> {
  const ctx = createContext(env);
  const program = new Command('cli')
    .option('-y, --yes', 'answer confirmations and single choices')
    .exitOverride()
    .configureOutput({
      writeOut: (text) => {
        env.io.stdout(text);
      },
      writeErr: (text) => {
        env.io.stderr(text);
      },
    });
  registerAuth(program, ctx);
  registerContext(program, ctx);
  registerInit(program, ctx);
  registerDb(program, ctx);
  registerMigrate(program, ctx);
  registerGrant(program, ctx);
  registerModel(program, ctx);
  registerChat(program, ctx);
  registerTool(program, ctx);
  registerResources(program, ctx);
  registerApi(program, ctx);
  try {
    await program.parseAsync(argv, { from: 'user' });
    return EXIT_OK;
  } catch (cause) {
    if (cause instanceof CommanderError) {
      return cause.exitCode === 0 ? EXIT_OK : EXIT_USAGE;
    }
    if (cause instanceof CliUsage) return printUsage(cause, env.io);
    if (cause instanceof CliFailure) {
      env.io.stderr(`${cause.message}\n`);
      return EXIT_FAIL;
    }
    env.io.stderr('unexpected failure\n');
    return EXIT_FAIL;
  }
}
