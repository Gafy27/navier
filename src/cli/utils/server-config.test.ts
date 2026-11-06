import assert from 'node:assert/strict';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { z } from '../../index.ts';
import { CliFailure, CliUsage } from './failure.ts';
import {
  ServerFile,
  ServerVariable,
  VARIABLES,
  childEnv,
  readServerFiles,
  requireDeskProject,
  workerToolsToken,
  writeServerFiles,
} from './server-config.ts';
import type { ServerFiles } from './server-config.ts';

const Fixture = z.enum({
  deskPrefix: 'cli-server-config-',
  dbSecret: 'postgresql://app:db-secret-value@127.0.0.1:55432/agents',
  serviceDb: 'postgresql://svc:service-secret-value@127.0.0.1:55432/agents',
  token: 'worker-token-secret-value',
  temporal: 'temporal.example:7233',
  workerName: 'desk',
  workerEntry: 'examples/desk/worker.ts',
  badShape: 'not-a-map',
  initHint: 'cli init',
});

const V = ServerVariable.enum;
const PERMISSION_BITS = 0o777;
const OPEN_DIR_MODE = 0o755;
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;
const HEALTH_PORT = 8080;

function sampleFiles(): ServerFiles {
  return {
    config: {
      env: {
        [V.TEMPORAL_ADDRESS]: Fixture.enum.temporal,
        [V.HEALTH_PORT]: HEALTH_PORT,
      },
      workers: [
        { name: Fixture.enum.workerName, entry: Fixture.enum.workerEntry },
      ],
    },
    secrets: {
      env: {
        [V.DATABASE_URL]: Fixture.enum.dbSecret,
        [V.WORKER_TOOLS_TOKEN]: Fixture.enum.token,
      },
      databases: {},
    },
  };
}

async function deskDir(t: TestContext): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), Fixture.enum.deskPrefix));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function modeOf(file: string): Promise<number> {
  return (await stat(file)).mode & PERMISSION_BITS;
}

void test('the secret variables are DATABASE_URL and WORKER_TOOLS_TOKEN, and both are required', () => {
  const secrets = VARIABLES.filter((row) => row.secret);
  assert.deepEqual(
    secrets.map((row) => row.name).sort(),
    [V.DATABASE_URL, V.WORKER_TOOLS_TOKEN].sort(),
  );
  assert.ok(secrets.every((row) => row.required));
});

void test('each variable is listed once', () => {
  const names = VARIABLES.map((row) => row.name);
  assert.equal(new Set(names).size, names.length);
});

void test('config.yaml holds no secret; server.json is 0600 in a 0700 folder', async (t) => {
  const dir = await deskDir(t);
  await writeServerFiles(dir, sampleFiles());
  const config = await readFile(join(dir, ServerFile.enum.config), 'utf8');
  assert.ok(!config.includes(Fixture.enum.dbSecret));
  assert.ok(!config.includes(Fixture.enum.token));
  assert.deepEqual(await requireDeskProject(dir), sampleFiles());
  const secretsDir = join(dir, ServerFile.enum.secretsDir);
  assert.equal(await modeOf(secretsDir), DIR_MODE);
  const secretsFile = join(secretsDir, ServerFile.enum.secretsFile);
  assert.equal(await modeOf(secretsFile), FILE_MODE);
});

void test('a .secrets folder left at another mode is set back to 0700', async (t) => {
  const dir = await deskDir(t);
  const secretsDir = join(dir, ServerFile.enum.secretsDir);
  await mkdir(secretsDir, { mode: OPEN_DIR_MODE });
  await chmod(secretsDir, OPEN_DIR_MODE);
  await writeServerFiles(dir, sampleFiles());
  assert.equal(await modeOf(secretsDir), DIR_MODE);
});

void test('a project with no files is refused with a usage error that names cli init', async (t) => {
  const dir = await deskDir(t);
  await assert.rejects(
    requireDeskProject(dir),
    (cause) =>
      cause instanceof CliUsage &&
      cause.message.includes(Fixture.enum.initHint),
  );
});

void test('a config with no secrets file is refused the same way', async (t) => {
  const dir = await deskDir(t);
  await writeServerFiles(dir, sampleFiles());
  await rm(join(dir, ServerFile.enum.secretsDir), { recursive: true });
  await assert.rejects(
    readServerFiles(dir),
    (cause) =>
      cause instanceof CliUsage &&
      cause.message.includes(Fixture.enum.initHint),
  );
});

void test('a secrets file with a bad shape fails without echoing its text', async (t) => {
  const dir = await deskDir(t);
  await writeServerFiles(dir, sampleFiles());
  const bad = JSON.stringify({
    env: { [V.DATABASE_URL]: Fixture.enum.dbSecret },
    databases: Fixture.enum.badShape,
  });
  await writeFile(
    join(dir, ServerFile.enum.secretsDir, ServerFile.enum.secretsFile),
    bad,
  );
  await assert.rejects(
    readServerFiles(dir),
    (cause) =>
      cause instanceof CliFailure &&
      !cause.message.includes(Fixture.enum.dbSecret),
  );
});

void test('a database entry with no origin reads as use', async (t) => {
  const dir = await deskDir(t);
  await writeServerFiles(dir, sampleFiles());
  await writeFile(
    join(dir, ServerFile.enum.secretsDir, ServerFile.enum.secretsFile),
    JSON.stringify({
      env: {},
      databases: { agents: { url: Fixture.enum.serviceDb } },
    }),
  );
  const { secrets } = await readServerFiles(dir);
  assert.equal(secrets.databases['agents']?.origin, 'use');
});

void test('childEnv stringifies config values, merges secrets, and attached wins for DATABASE_URL', () => {
  const files = sampleFiles();
  assert.deepEqual(childEnv(files), {
    [V.TEMPORAL_ADDRESS]: Fixture.enum.temporal,
    [V.HEALTH_PORT]: String(HEALTH_PORT),
    [V.DATABASE_URL]: Fixture.enum.dbSecret,
    [V.WORKER_TOOLS_TOKEN]: Fixture.enum.token,
  });
  const attached = childEnv({
    ...files,
    secrets: { ...files.secrets, attached: Fixture.enum.serviceDb },
  });
  assert.equal(attached[V.DATABASE_URL], Fixture.enum.serviceDb);
});

void test('workerToolsToken returns the token, and refuses an absent or empty one naming cli init', () => {
  const { secrets } = sampleFiles();
  assert.equal(workerToolsToken(secrets), Fixture.enum.token);
  for (const env of [{}, { [V.WORKER_TOOLS_TOKEN]: '' }]) {
    assert.throws(
      () => workerToolsToken({ ...secrets, env }),
      (cause) =>
        cause instanceof CliUsage &&
        cause.message.includes(Fixture.enum.initHint),
    );
  }
});
