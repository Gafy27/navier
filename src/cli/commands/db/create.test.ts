import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { z } from '../../../index.ts';
import { createContext } from '../../index.ts';
import type { Child, CliContext, CliEnv } from '../../utils/context.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import { noTtyPrompter } from '../../utils/prompts.ts';
import {
  DatabaseOrigin,
  ServerVariable,
  readServerFiles,
  writeServerFiles,
} from '../../utils/server-config.ts';
import type { ServerFiles } from '../../utils/server-config.ts';
import {
  DbToken,
  SUPERUSER_PORT,
  findComposeRoot,
  runDbCreate,
} from './create.ts';
import type { PgAccess } from './create.ts';

const Fixture = z.enum({
  deskPrefix: 'cli-db-create-',
  nested: 'a/b',
  superPassword: 'super-secret-value',
  servicePassword: 'service-secret-value',
  heldUrl: 'postgresql://svc:held-secret-value@127.0.0.1:55432/app_1',
  injected: 'a"; drop database x;--',
  upper: 'App',
  composeBody: 'services: {}\n',
});

const V = ServerVariable.enum;

function deskFiles(): ServerFiles {
  return {
    config: { env: {}, workers: [] },
    secrets: { env: { [V.DATABASE_URL]: Fixture.enum.heldUrl }, databases: {} },
  };
}

interface Spawned {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

interface Harness {
  readonly ctx: CliContext;
  readonly dir: string;
  readonly spawned: Spawned[];
  readonly statements: { url: string; statement: string }[];
  readonly out: string[];
  readonly pg: PgAccess;
}

const HOST_VARS: Readonly<Record<string, string>> = {
  [DbToken.enum.postgresPassword]: Fixture.enum.superPassword,
  [DbToken.enum.servicePassword]: Fixture.enum.servicePassword,
};

function fakeChild(code: number): Child {
  return {
    exited: Promise.resolve(code),
    kill: () => undefined,
    lines: Readable.from([]) as AsyncIterable<string>,
  };
}

async function harness(
  t: TestContext,
  composeAt: string | undefined,
  composeExit = 0,
  vars: Readonly<Record<string, string>> = HOST_VARS,
): Promise<Harness> {
  const dir = await mkdtemp(join(tmpdir(), Fixture.enum.deskPrefix));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const project = join(dir, Fixture.enum.nested);
  await mkdir(project, { recursive: true });
  await writeServerFiles(project, deskFiles());
  if (composeAt !== undefined) {
    await writeFile(
      join(dir, composeAt, DbToken.enum.composeFile),
      Fixture.enum.composeBody,
    );
  }
  const spawned: Spawned[] = [];
  const statements: { url: string; statement: string }[] = [];
  const out: string[] = [];
  const env: CliEnv = {
    configDir: dir,
    projectDir: project,
    vars,
    loopbackHost: DbToken.enum.loopback,
    fetch: () => Promise.reject(new Error('fetch not scripted')),
    io: {
      stdout: (text) => {
        out.push(text);
      },
      stderr: () => undefined,
      stdin: () => Promise.resolve(''),
      isTTY: false,
    },
    prompter: noTtyPrompter(),
    open: () => undefined,
    listen: () => Promise.reject(new Error('listen not scripted')),
    spawn: (command, args, opts) => {
      spawned.push({ command, args, cwd: opts.cwd });
      return fakeChild(composeExit);
    },
    readFile: () => Promise.reject(new Error('readFile not scripted')),
  };
  return {
    ctx: createContext(env),
    dir,
    spawned,
    statements,
    out,
    pg: {
      run: (url, statement) => {
        statements.push({ url, statement });
        return Promise.resolve();
      },
    },
  };
}

void test('findComposeRoot walks up to the folder that holds the compose file', async (t) => {
  const h = await harness(t, '');
  assert.equal(findComposeRoot(h.ctx.env.projectDir), h.dir);
});

void test('findComposeRoot with no compose file above is a usage error', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), Fixture.enum.deskPrefix));
  t.after(() => rm(dir, { recursive: true, force: true }));
  assert.throws(() => findComposeRoot(dir), CliUsage);
});

void test('db create with no --name spawns compose with an args array and no password, then creates agents', async (t) => {
  const h = await harness(t, '');
  assert.equal(await runDbCreate(h.ctx, {}, h.ctx.env.io, h.pg), 0);
  assert.deepEqual(h.spawned, [
    {
      command: DbToken.enum.docker,
      args: [
        DbToken.enum.compose,
        DbToken.enum.fileFlag,
        join(h.dir, DbToken.enum.composeFile),
        DbToken.enum.up,
        DbToken.enum.detach,
        DbToken.enum.wait,
        DbToken.enum.postgresService,
      ],
      cwd: h.dir,
    },
  ]);
  for (const arg of h.spawned.flatMap((s) => s.args)) {
    assert.ok(!arg.includes(Fixture.enum.superPassword));
    assert.ok(!arg.includes(Fixture.enum.servicePassword));
  }
  assert.equal(h.statements.length, 1);
  const [statement] = h.statements;
  assert.ok(statement);
  assert.equal(
    statement.statement,
    `CREATE DATABASE "${DbToken.enum.defaultName}" OWNER "${DbToken.enum.serviceRole}"`,
  );
  const superuser = new URL(statement.url);
  assert.equal(superuser.username, DbToken.enum.superuser);
  assert.equal(superuser.password, Fixture.enum.superPassword);
  assert.equal(superuser.port, String(SUPERUSER_PORT));
  const { secrets } = await readServerFiles(h.ctx.env.projectDir);
  const entry = secrets.databases[DbToken.enum.defaultName];
  assert.ok(entry);
  assert.equal(entry.origin, DatabaseOrigin.enum.create);
  assert.equal(new URL(entry.url).password, Fixture.enum.servicePassword);
  assert.equal(secrets.attached, entry.url);
  assert.ok(
    h.out.every((line) => !line.includes(Fixture.enum.servicePassword)),
  );
});

void test('db create --name app_1 creates that database', async (t) => {
  const h = await harness(t, '');
  await runDbCreate(h.ctx, { name: 'app_1' }, h.ctx.env.io, h.pg);
  const [statement] = h.statements;
  assert.ok(statement);
  assert.ok(statement.statement.includes('"app_1"'));
  const { secrets } = await readServerFiles(h.ctx.env.projectDir);
  const entry = secrets.databases['app_1'];
  assert.ok(entry);
  assert.equal(entry.origin, DatabaseOrigin.enum.create);
});

void test('a bad --name never reaches spawn or pg', async (t) => {
  for (const name of [Fixture.enum.injected, Fixture.enum.upper]) {
    const h = await harness(t, '');
    await assert.rejects(
      runDbCreate(h.ctx, { name }, h.ctx.env.io, h.pg),
      CliUsage,
    );
    assert.equal(h.spawned.length, 0);
    assert.equal(h.statements.length, 0);
  }
});

void test('a name already held is refused before any spawn', async (t) => {
  const h = await harness(t, '');
  await runDbCreate(h.ctx, { name: 'app_1' }, h.ctx.env.io, h.pg);
  const spawnedBefore = h.spawned.length;
  await assert.rejects(
    runDbCreate(h.ctx, { name: 'app_1' }, h.ctx.env.io, h.pg),
    (cause) => cause instanceof CliUsage && cause.message.includes('db delete'),
  );
  assert.equal(h.spawned.length, spawnedBefore);
});

void test('a failed compose start is a failure and never reaches pg', async (t) => {
  const h = await harness(t, '', 1);
  await assert.rejects(runDbCreate(h.ctx, {}, h.ctx.env.io, h.pg), CliFailure);
  assert.equal(h.statements.length, 0);
});

void test('a missing POSTGRES_PASSWORD is a usage error before any spawn', async (t) => {
  const h = await harness(t, '', 0, {
    [DbToken.enum.servicePassword]: Fixture.enum.servicePassword,
  });
  await assert.rejects(runDbCreate(h.ctx, {}, h.ctx.env.io, h.pg), CliUsage);
  assert.equal(h.spawned.length, 0);
});
