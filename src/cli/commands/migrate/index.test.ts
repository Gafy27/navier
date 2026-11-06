import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { z } from '../../../index.ts';
import { runCli } from '../../index.ts';
import type { Child, CliEnv, Spawn } from '../../utils/context.ts';
import { EXIT_USAGE } from '../../utils/constants.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import { noTtyPrompter } from '../../utils/prompts.ts';
import {
  ServerVariable,
  childEnv,
  writeServerFiles,
} from '../../utils/server-config.ts';
import type { ServerFiles } from '../../utils/server-config.ts';
import { MigrateToken, NODE_BINARY, runMigrate } from './index.ts';

const Fixture = z.enum({
  deskPrefix: 'cli-migrate-',
  loopback: '127.0.0.1',
  dbUrl: 'postgresql://app:migrate-db-value@127.0.0.1:55432/agents',
  line: 'applied 3 migrations',
});

const V = ServerVariable.enum;
const EXIT_CODE_FAILED = 1;

function deskFiles(): ServerFiles {
  return {
    config: { env: { [V.HEALTH_HOST]: Fixture.enum.loopback }, workers: [] },
    secrets: { env: { [V.DATABASE_URL]: Fixture.enum.dbUrl }, databases: {} },
  };
}

function fakeChild(code: number, lines: readonly string[]): Child {
  return {
    exited: Promise.resolve(code),
    kill: () => undefined,
    lines: linesOf(lines),
  };
}

function linesOf(lines: readonly string[]): AsyncIterable<string> {
  return Readable.from(lines) as AsyncIterable<string>;
}

interface Spawned {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly cwd: string;
}

async function harness(
  t: TestContext,
  spawn: Spawn,
  writeDesk: boolean,
): Promise<{
  readonly env: CliEnv;
  readonly dir: string;
  readonly out: string[];
}> {
  const dir = await mkdtemp(join(tmpdir(), Fixture.enum.deskPrefix));
  t.after(() => rm(dir, { recursive: true, force: true }));
  if (writeDesk) await writeServerFiles(dir, deskFiles());
  const out: string[] = [];
  const env: CliEnv = {
    configDir: dir,
    projectDir: dir,
    vars: {},
    loopbackHost: Fixture.enum.loopback,
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
    spawn,
    readFile: () => Promise.reject(new Error('readFile not scripted')),
  };
  return { env, dir, out };
}

void test('migrate without desk files is a usage error naming cli init, and spawns nothing', async (t) => {
  const spawned: Spawned[] = [];
  const h = await harness(
    t,
    (command, args, opts) => {
      spawned.push({ command, args, env: opts.env, cwd: opts.cwd });
      return fakeChild(0, []);
    },
    false,
  );
  await assert.rejects(
    runMigrate(h.env),
    (cause) => cause instanceof CliUsage && cause.message.includes('cli init'),
  );
  assert.equal(spawned.length, 0);
});

void test('migrate spawns src/migrate.ts with the child env, and forwards its lines', async (t) => {
  const spawned: Spawned[] = [];
  const h = await harness(
    t,
    (command, args, opts) => {
      spawned.push({ command, args, env: opts.env, cwd: opts.cwd });
      return fakeChild(0, [Fixture.enum.line]);
    },
    true,
  );
  await runMigrate(h.env);
  assert.deepEqual(spawned, [
    {
      command: NODE_BINARY,
      args: [MigrateToken.enum.entry],
      env: childEnv(deskFiles()),
      cwd: h.dir,
    },
  ]);
  assert.deepEqual(h.out, [`${Fixture.enum.line}\n`]);
});

void test('a non-zero migrate exit is a failure that names the exit code', async (t) => {
  const h = await harness(t, () => fakeChild(EXIT_CODE_FAILED, []), true);
  await assert.rejects(
    runMigrate(h.env),
    (cause) =>
      cause instanceof CliFailure &&
      cause.message === `migrate exited with ${String(EXIT_CODE_FAILED)}`,
  );
});

void test('the migrate command is registered: without desk files it exits with a usage code', async (t) => {
  const h = await harness(t, () => fakeChild(0, []), false);
  assert.equal(await runCli([MigrateToken.enum.command], h.env), EXIT_USAGE);
});
