import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import type { Server } from 'node:net';
import { Readable } from 'node:stream';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { z } from '../../../index.ts';
import { runCli } from '../../index.ts';
import type { Child, CliEnv, Spawn } from '../../utils/context.ts';
import { EXIT_USAGE } from '../../utils/constants.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import { usageMissingFlag } from '../../utils/copy.ts';
import { noTtyPrompter } from '../../utils/prompts.ts';
import type { Prompter } from '../../utils/prompts.ts';
import { scriptedPrompter } from '../../utils/prompts.test-support.ts';
import {
  ServerFile,
  ServerVariable,
  VARIABLES,
  childEnv,
  readServerFiles,
} from '../../utils/server-config.ts';
import type { ServerFiles, Variable } from '../../utils/server-config.ts';
import { MigrateToken, NODE_BINARY } from '../migrate/index.ts';
import { InitMessage, InitToken, liveInitChecks, runInit } from './index.ts';
import type { InitChecks } from './index.ts';

const Fixture = z.enum({
  deskPrefix: 'cli-init-',
  loopback: '127.0.0.1',
  issuer: 'https://idp.example/realms/desk/',
  issuerBase: 'https://idp.example/realms/desk',
  secretAnswer: 'secret-answer-for-',
  plainAnswer: 'plain-answer-for-',
  dbUrl: 'postgresql://app:db-url-value@127.0.0.1:55432/agents',
});

const V = ServerVariable.enum;
const PERMISSION_BITS = 0o777;
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;
const REQUIRED = VARIABLES.filter((row) => row.required);

const ok = (): Promise<boolean> => Promise.resolve(true);
const no = (): Promise<boolean> => Promise.resolve(false);
const PASSING: InitChecks = {
  postgres: ok,
  temporal: ok,
  idp: ok,
  authz: ok,
};

interface Harness {
  readonly env: CliEnv;
  readonly dir: string;
  readonly out: string[];
}

interface Spawned {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly cwd: string;
}

function rowOf(name: ServerVariable): Variable {
  const row = VARIABLES.find((candidate) => candidate.name === name);
  assert.ok(row !== undefined);
  return row;
}

function answerFor(name: ServerVariable): string {
  const secret = rowOf(name).secret;
  return `${secret ? Fixture.enum.secretAnswer : Fixture.enum.plainAnswer}${name}`;
}

function scriptFor(): Record<string, string[]> {
  return Object.fromEntries(
    REQUIRED.map((row) => [row.name, [answerFor(row.name)]]),
  );
}

interface Asked {
  readonly kind: string;
  readonly flag: string;
}

/** A scripted prompter that also records which kind of question each flag got. */
function recording(script: Record<string, string[]>): {
  readonly prompter: Prompter;
  readonly asked: Asked[];
} {
  const inner = scriptedPrompter(script);
  const asked: Asked[] = [];
  return {
    asked,
    prompter: {
      text: (q) => {
        asked.push({ kind: 'text', flag: q.flag });
        return inner.text(q);
      },
      password: (q) => {
        asked.push({ kind: 'password', flag: q.flag });
        return inner.password(q);
      },
      select: inner.select,
      multiselect: inner.multiselect,
      confirm: inner.confirm,
    },
  };
}

function refuseSpawn(): Child {
  throw new Error('spawn not scripted');
}

function refuseFetch(): Promise<Response> {
  return Promise.reject(new Error('fetch not scripted'));
}

function fakeChild(code: number): Child {
  return {
    exited: Promise.resolve(code),
    kill: () => undefined,
    lines: linesOf([]),
  };
}

function linesOf(lines: readonly string[]): AsyncIterable<string> {
  return Readable.from(lines) as AsyncIterable<string>;
}

async function harness(
  t: TestContext,
  prompter: Prompter,
  deps: { readonly spawn?: Spawn; readonly fetch?: typeof fetch } = {},
): Promise<Harness> {
  const dir = await mkdtemp(join(tmpdir(), Fixture.enum.deskPrefix));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const out: string[] = [];
  const env: CliEnv = {
    configDir: dir,
    projectDir: dir,
    vars: {},
    loopbackHost: Fixture.enum.loopback,
    fetch: deps.fetch ?? refuseFetch,
    io: {
      stdout: (text) => {
        out.push(text);
      },
      stderr: () => undefined,
      stdin: () => Promise.resolve(''),
      isTTY: true,
    },
    prompter,
    open: () => undefined,
    listen: () => Promise.reject(new Error('listen not scripted')),
    spawn: deps.spawn ?? refuseSpawn,
    readFile: () => Promise.reject(new Error('readFile not scripted')),
  };
  return { env, dir, out };
}

/** The desk files as `init` would hold them, with `config` as the non-secret env. */
function filesWith(config: Record<string, string>): ServerFiles {
  return {
    config: { env: config, workers: [] },
    secrets: { env: { [V.DATABASE_URL]: Fixture.enum.dbUrl }, databases: {} },
  };
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function modeOf(file: string): Promise<number> {
  return (await stat(file)).mode & PERMISSION_BITS;
}

async function listening(): Promise<{
  readonly server: Server;
  readonly port: number;
}> {
  const server = createServer();
  await new Promise<void>((resolve) => {
    server.listen(0, Fixture.enum.loopback, () => {
      resolve();
    });
  });
  const address = server.address();
  assert.ok(typeof address === 'object' && address !== null);
  return { server, port: address.port };
}

function closed(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

void test('init prompts only the required rows, and writes both files when every check passes', async (t) => {
  const { prompter, asked } = recording(scriptFor());
  const h = await harness(t, prompter);
  await runInit(h.env, PASSING);

  assert.deepEqual(
    asked.map((q) => q.flag).sort(),
    REQUIRED.map((row) => row.name).sort(),
  );
  for (const row of REQUIRED) {
    const kind = asked.find((q) => q.flag === row.name)?.kind;
    assert.equal(kind, row.secret ? 'password' : 'text');
  }

  const files = await readServerFiles(h.dir);
  assert.equal(
    files.config.env[V.SHUTDOWN_TIMEOUT_MS],
    answerFor(V.SHUTDOWN_TIMEOUT_MS),
  );
  assert.equal(files.secrets.env[V.DATABASE_URL], answerFor(V.DATABASE_URL));
  const config = await readFile(join(h.dir, ServerFile.enum.config), 'utf8');
  assert.ok(!config.includes(answerFor(V.DATABASE_URL)));
  assert.ok(!config.includes(answerFor(V.WORKER_TOOLS_TOKEN)));
  assert.ok(!h.out.join('').includes(answerFor(V.DATABASE_URL)));
  assert.equal(await modeOf(join(h.dir, ServerFile.enum.secretsDir)), DIR_MODE);
  const secretsFile = join(
    h.dir,
    ServerFile.enum.secretsDir,
    ServerFile.enum.secretsFile,
  );
  assert.equal(await modeOf(secretsFile), FILE_MODE);
});

void test('a failed check writes no file and names the check that failed', async (t) => {
  const cases: readonly (readonly [Partial<InitChecks>, string])[] = [
    [{ postgres: no }, InitMessage.enum.postgres],
    [{ temporal: no }, InitMessage.enum.temporal],
    [{ idp: no }, InitMessage.enum.idp],
    [{ authz: no }, InitMessage.enum.authz],
  ];
  for (const [override, message] of cases) {
    const h = await harness(t, scriptedPrompter(scriptFor()));
    await assert.rejects(
      runInit(h.env, { ...PASSING, ...override }),
      (cause) => cause instanceof CliFailure && cause.message === message,
    );
    assert.equal(await exists(join(h.dir, ServerFile.enum.config)), false);
    assert.equal(await exists(join(h.dir, ServerFile.enum.secretsDir)), false);
  }
});

void test('without a TTY the first prompt is a usage error naming its flag, and nothing is written', async (t) => {
  const h = await harness(t, noTtyPrompter());
  await assert.rejects(
    runInit(h.env, PASSING),
    (cause) =>
      cause instanceof CliUsage &&
      cause.message === usageMissingFlag(V.SHUTDOWN_TIMEOUT_MS),
  );
  assert.equal(await exists(join(h.dir, ServerFile.enum.config)), false);
});

void test('an empty required answer is a usage error naming the variable', async (t) => {
  const script = { ...scriptFor(), [V.SHUTDOWN_TIMEOUT_MS]: [''] };
  const h = await harness(t, scriptedPrompter(script));
  await assert.rejects(
    runInit(h.env, PASSING),
    (cause) =>
      cause instanceof CliUsage &&
      cause.message === `${V.SHUTDOWN_TIMEOUT_MS} is empty`,
  );
});

void test('the Postgres check runs migrate --check with the child env, and passes on exit 0 or 1 only', async (t) => {
  const files = filesWith({});
  const spawned: Spawned[] = [];
  for (const [code, expected] of [
    [0, true],
    [1, true],
    [2, false],
  ] as const) {
    const h = await harness(t, noTtyPrompter(), {
      spawn: (command, args, opts) => {
        spawned.push({ command, args, env: opts.env, cwd: opts.cwd });
        return fakeChild(code);
      },
    });
    assert.equal(await liveInitChecks(h.env).postgres(files), expected);
    assert.equal(spawned.at(-1)?.cwd, h.dir);
  }
  for (const call of spawned) {
    assert.equal(call.command, NODE_BINARY);
    assert.deepEqual(call.args, [
      MigrateToken.enum.entry,
      MigrateToken.enum.checkFlag,
    ]);
    assert.deepEqual(call.env, childEnv(files));
  }
});

void test('the Temporal check reaches a listening address, and fails once it is closed', async (t) => {
  const { server, port } = await listening();
  const h = await harness(t, noTtyPrompter());
  const checks = liveInitChecks(h.env);
  const address = `${Fixture.enum.loopback}:${String(port)}`;
  assert.equal(
    await checks.temporal(filesWith({ [V.TEMPORAL_ADDRESS]: address })),
    true,
  );
  await closed(server);
  assert.equal(
    await checks.temporal(filesWith({ [V.TEMPORAL_ADDRESS]: address })),
    false,
  );
  assert.equal(await checks.temporal(filesWith({})), false);
});

void test('the authz check reaches the host and port in AUTHZ_API_URL', async (t) => {
  const { server, port } = await listening();
  const h = await harness(t, noTtyPrompter());
  const url = `http://${Fixture.enum.loopback}:${String(port)}/v1`;
  assert.equal(
    await liveInitChecks(h.env).authz(filesWith({ [V.AUTHZ_API_URL]: url })),
    true,
  );
  await closed(server);
});

void test('the IdP check fetches the discovery document under the issuer', async (t) => {
  const requested: string[] = [];
  const answer = (status: number) => (input: string | URL | Request) => {
    requested.push(new Request(input).url);
    return Promise.resolve(new Response(null, { status }));
  };
  const files = filesWith({ [V.IDP_ISSUER]: Fixture.enum.issuer });
  const discovery = `${Fixture.enum.issuerBase}${InitToken.enum.discoveryPath}`;

  const passed = await harness(t, noTtyPrompter(), { fetch: answer(200) });
  assert.equal(await liveInitChecks(passed.env).idp(files), true);
  assert.deepEqual(requested, [discovery]);

  const refused = await harness(t, noTtyPrompter(), { fetch: answer(500) });
  assert.equal(await liveInitChecks(refused.env).idp(files), false);

  const unreachable = await harness(t, noTtyPrompter());
  assert.equal(await liveInitChecks(unreachable.env).idp(files), false);
});

void test('the init command is registered: without a TTY it stops at the first prompt', async (t) => {
  const h = await harness(t, noTtyPrompter());
  assert.equal(await runCli([InitToken.enum.command], h.env), EXIT_USAGE);
  assert.equal(await exists(join(h.dir, ServerFile.enum.config)), false);
});
