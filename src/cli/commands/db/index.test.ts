import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { z } from '../../../index.ts';
import { createContext, runCli } from '../../index.ts';
import type { CliContext, CliEnv } from '../../utils/context.ts';
import { EXIT_USAGE } from '../../utils/constants.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import { noTtyPrompter } from '../../utils/prompts.ts';
import type { Prompter } from '../../utils/prompts.ts';
import { scriptedPrompter } from '../../utils/prompts.test-support.ts';
import {
  DatabaseOrigin,
  ServerFile,
  readServerFiles,
  writeServerFiles,
} from '../../utils/server-config.ts';
import type { ServerFiles } from '../../utils/server-config.ts';
import { DbToken } from './create.ts';
import type { PgAccess } from './create.ts';
import {
  DbCommand,
  runDbDelete,
  runDbList,
  runDbShow,
  runDbUse,
} from './index.ts';

const Fixture = z.enum({
  deskPrefix: 'cli-db-index-',
  loopback: '127.0.0.1',
  createdUrl: 'postgresql://svc:created-secret-value@127.0.0.1:55432/agents',
  usedUrl: 'postgresql://app:used-secret-value@db.example:5432/app_1',
  otherUrl: 'postgresql://app:other-secret-value@db.example:5432/app_1',
  newUrl: 'postgresql://app:new-secret-value@db.example:5432/app_2',
  noPathUrl: 'postgresql://app:nopath-secret-value@db.example:5432',
  superPassword: 'super-secret-value',
  confirmFlag: 'yes',
  initHint: 'cli init',
  created: 'agents',
  used: 'app_1',
  legacy: 'legacy',
  legacyUrl: 'postgresql://app:legacy-secret-value@db.example:5432/legacy',
});

function deskFiles(): ServerFiles {
  return {
    config: { env: {}, workers: [] },
    secrets: {
      env: {},
      databases: {
        [Fixture.enum.created]: {
          url: Fixture.enum.createdUrl,
          origin: DatabaseOrigin.enum.create,
        },
        [Fixture.enum.used]: {
          url: Fixture.enum.usedUrl,
          origin: DatabaseOrigin.enum.use,
        },
      },
      attached: Fixture.enum.createdUrl,
    },
  };
}

interface Harness {
  readonly ctx: CliContext;
  readonly env: CliEnv;
  readonly out: string[];
  readonly statements: { url: string; statement: string }[];
  readonly pg: PgAccess;
}

async function harness(
  t: TestContext,
  options: {
    readonly files?: ServerFiles;
    readonly prompter?: Prompter;
    readonly stdin?: string;
    readonly connects?: boolean;
  },
): Promise<Harness> {
  const dir = await mkdtemp(join(tmpdir(), Fixture.enum.deskPrefix));
  t.after(() => rm(dir, { recursive: true, force: true }));
  if (options.files !== undefined) await writeServerFiles(dir, options.files);
  const out: string[] = [];
  const statements: { url: string; statement: string }[] = [];
  const env: CliEnv = {
    configDir: dir,
    projectDir: dir,
    vars: { [DbToken.enum.postgresPassword]: Fixture.enum.superPassword },
    loopbackHost: Fixture.enum.loopback,
    fetch: () => Promise.reject(new Error('fetch not scripted')),
    io: {
      stdout: (text) => {
        out.push(text);
      },
      stderr: () => undefined,
      stdin: () => Promise.resolve(options.stdin ?? ''),
      isTTY: false,
    },
    prompter: options.prompter ?? noTtyPrompter(),
    open: () => undefined,
    listen: () => Promise.reject(new Error('listen not scripted')),
    spawn: () => {
      throw new Error('spawn not scripted');
    },
    readFile: () => Promise.reject(new Error('readFile not scripted')),
  };
  return {
    ctx: createContext(env),
    env,
    out,
    statements,
    pg: {
      run: (url, statement) => {
        statements.push({ url, statement });
        return options.connects === false
          ? Promise.reject(new CliFailure('refused'))
          : Promise.resolve();
      },
    },
  };
}

function printed(h: Harness): string {
  return h.out.join('');
}

void test('db list and db show without desk files are usage errors naming cli init, with no spawn and no pg', async (t) => {
  const h = await harness(t, {});
  for (const run of [
    () => runDbList(h.ctx, h.env.io),
    () =>
      runDbShow(
        h.ctx,
        { name: Fixture.enum.created, showSecrets: false },
        h.env.io,
      ),
  ]) {
    await assert.rejects(
      run(),
      (cause) =>
        cause instanceof CliUsage &&
        cause.message.includes(Fixture.enum.initHint),
    );
  }
  assert.equal(h.statements.length, 0);
});

void test('db list shows name, origin, and the attached entry, and never a URL', async (t) => {
  const h = await harness(t, { files: deskFiles() });
  await runDbList(h.ctx, h.env.io);
  const text = printed(h);
  assert.ok(text.includes(`${Fixture.enum.created} create`));
  assert.ok(text.includes('DATABASE_URL'));
  assert.ok(text.includes(`${Fixture.enum.used} use\n`));
  assert.ok(!text.includes('postgresql://'));
  assert.ok(!text.includes('secret-value'));
});

void test('db show masks the password unless --show-secrets', async (t) => {
  const h = await harness(t, { files: deskFiles() });
  await runDbShow(
    h.ctx,
    { name: Fixture.enum.created, showSecrets: false },
    h.env.io,
  );
  assert.ok(!printed(h).includes('created-secret-value'));
  assert.ok(printed(h).includes('agents'));
  h.out.length = 0;
  await runDbShow(
    h.ctx,
    { name: Fixture.enum.created, showSecrets: true },
    h.env.io,
  );
  assert.ok(printed(h).includes('created-secret-value'));
});

void test('db show of a missing entry is a usage error', async (t) => {
  const h = await harness(t, { files: deskFiles() });
  await assert.rejects(
    runDbShow(h.ctx, { name: 'nope', showSecrets: false }, h.env.io),
    CliUsage,
  );
});

void test('db use checks the connection, then writes the entry keyed by the URL path and attaches it', async (t) => {
  const h = await harness(t, {
    files: deskFiles(),
    stdin: `${Fixture.enum.newUrl}\n`,
  });
  await runDbUse(h.ctx, h.env.io, h.pg);
  assert.deepEqual(h.statements, [
    { url: Fixture.enum.newUrl, statement: DbToken.enum.selectOne },
  ]);
  const { secrets } = await readServerFiles(h.env.projectDir);
  assert.deepEqual(secrets.databases['app_2'], {
    url: Fixture.enum.newUrl,
    origin: DatabaseOrigin.enum.use,
  });
  assert.equal(secrets.attached, Fixture.enum.newUrl);
});

void test('db use with a URL that fails to connect writes nothing', async (t) => {
  const h = await harness(t, {
    files: deskFiles(),
    stdin: Fixture.enum.newUrl,
    connects: false,
  });
  await assert.rejects(runDbUse(h.ctx, h.env.io, h.pg), CliFailure);
  assert.deepEqual(
    (await readServerFiles(h.env.projectDir)).secrets,
    deskFiles().secrets,
  );
});

void test('db use with a URL that has no database path is a usage error before pg', async (t) => {
  const h = await harness(t, {
    files: deskFiles(),
    stdin: Fixture.enum.noPathUrl,
  });
  await assert.rejects(runDbUse(h.ctx, h.env.io, h.pg), CliUsage);
  assert.equal(h.statements.length, 0);
});

void test('db use with a name held by another URL is refused naming db delete, before pg', async (t) => {
  const h = await harness(t, {
    files: deskFiles(),
    stdin: Fixture.enum.otherUrl,
  });
  await assert.rejects(
    runDbUse(h.ctx, h.env.io, h.pg),
    (cause) => cause instanceof CliUsage && cause.message.includes('db delete'),
  );
  assert.equal(h.statements.length, 0);
});

void test('db delete with confirm no changes nothing and drops nothing', async (t) => {
  const h = await harness(t, {
    files: deskFiles(),
    prompter: scriptedPrompter({ [Fixture.enum.confirmFlag]: [false] }),
  });
  assert.equal(
    await runDbDelete(
      h.ctx,
      { name: Fixture.enum.created, yes: false },
      h.env.io,
      h.pg,
    ),
    0,
  );
  assert.equal(h.statements.length, 0);
  assert.deepEqual(
    (await readServerFiles(h.env.projectDir)).secrets,
    deskFiles().secrets,
  );
});

void test('db delete --yes on a create entry drops it through the superuser, removes it, and clears attached', async (t) => {
  const h = await harness(t, { files: deskFiles() });
  await runDbDelete(
    h.ctx,
    { name: Fixture.enum.created, yes: true },
    h.env.io,
    h.pg,
  );
  assert.equal(h.statements.length, 1);
  const [drop] = h.statements;
  assert.ok(drop);
  assert.equal(drop.statement, 'DROP DATABASE "agents"');
  assert.equal(new URL(drop.url).username, DbToken.enum.superuser);
  const { secrets } = await readServerFiles(h.env.projectDir);
  assert.equal(secrets.databases[Fixture.enum.created], undefined);
  assert.equal(secrets.attached, undefined);
});

void test('db delete of a use entry only detaches it and leaves attached alone', async (t) => {
  const h = await harness(t, { files: deskFiles() });
  await runDbDelete(
    h.ctx,
    { name: Fixture.enum.used, yes: true },
    h.env.io,
    h.pg,
  );
  assert.equal(h.statements.length, 0);
  assert.ok(printed(h).includes(`detached ${Fixture.enum.used}`));
  const { secrets } = await readServerFiles(h.env.projectDir);
  assert.equal(secrets.databases[Fixture.enum.used], undefined);
  assert.equal(secrets.attached, Fixture.enum.createdUrl);
});

void test('db delete of an entry with no origin reads as use: detach only, no drop', async (t) => {
  const h = await harness(t, { files: deskFiles() });
  await writeFile(
    join(
      h.env.projectDir,
      ServerFile.enum.secretsDir,
      ServerFile.enum.secretsFile,
    ),
    JSON.stringify({
      env: {},
      databases: { [Fixture.enum.legacy]: { url: Fixture.enum.legacyUrl } },
    }),
  );
  await runDbDelete(
    h.ctx,
    { name: Fixture.enum.legacy, yes: true },
    h.env.io,
    h.pg,
  );
  assert.equal(h.statements.length, 0);
  assert.ok(printed(h).includes(`detached ${Fixture.enum.legacy}`));
});

void test('the db command is registered: without desk files it exits with a usage code', async (t) => {
  const h = await harness(t, {});
  assert.equal(
    await runCli([DbCommand.enum.db, DbCommand.enum.list], h.env),
    EXIT_USAGE,
  );
});

void test('the V47 ban: no --kind and no hosted provider name in the db sources', async () => {
  for (const file of ['index.ts', 'create.ts']) {
    const text = await readFile(new URL(`./${file}`, import.meta.url), 'utf8');
    assert.ok(!/(--kind\b|turso|neon)/u.test(text), file);
  }
});
