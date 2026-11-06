import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { runCli } from '../../index.ts';
import type { CliEnv } from '../../index.ts';
import { createCredentialsStore } from '../../utils/credentials.ts';
import type { Credentials } from '../../utils/credentials.ts';
import { noTtyPrompter } from '../../utils/prompts.ts';
import type { Prompter } from '../../utils/prompts.ts';
import { scriptedPrompter } from '../../utils/prompts.test-support.ts';

const BASE = 'http://api.test';

const file: Credentials = {
  baseUrl: BASE,
  auth: { kind: 'person', session: 'ses_context-never-printed' },
  org: 'acme',
  space: 'support',
};

const ORGS = {
  items: [
    { id: 'acme', name: 'Acme' },
    { id: 'beta', name: 'Beta' },
  ],
};
const SPACES = {
  items: [
    { id: 'support', name: 'Support' },
    { id: 'sales', name: 'Sales' },
  ],
};

async function setup(
  t: TestContext,
  prompter: Prompter,
  stored: Credentials | null = file,
) {
  const dir = await mkdtemp(join(tmpdir(), 'cli-context-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = createCredentialsStore(dir);
  if (stored !== null) await store.write(stored);
  const sent: URL[] = [];
  const env: CliEnv = {
    configDir: dir,
    projectDir: dir,
    vars: {},
    loopbackHost: '127.0.0.1',
    fetch: (input, init) => {
      const { url } = new Request(input, init);
      sent.push(new URL(url));
      const { pathname } = new URL(url);
      return Promise.resolve(
        Response.json(pathname.endsWith('/spaces') ? SPACES : ORGS),
      );
    },
    io: {
      stdout: () => undefined,
      stderr: () => undefined,
      stdin: () => Promise.resolve(''),
      isTTY: true,
    },
    prompter,
    open: () => undefined,
    listen: () => Promise.reject(new Error('listen not scripted')),
    spawn: () => {
      throw new Error('spawn not scripted');
    },
    readFile: () => Promise.reject(new Error('no such file')),
  };
  return { env, store, sent };
}

void test('orgs switch writes the picked org and drops the space', async (t) => {
  const h = await setup(t, scriptedPrompter({ org: ['beta'] }));
  assert.equal(await runCli(['orgs', 'switch', '--limit', '50'], h.env), 0);
  assert.deepEqual(await h.store.read(), {
    baseUrl: BASE,
    auth: file.auth,
    org: 'beta',
  });
  assert.equal(h.sent[0]?.searchParams.get('limit'), '50');
});

void test('orgs switch asks for the page size when --limit is absent', async (t) => {
  const h = await setup(t, scriptedPrompter({ limit: ['10'], org: ['acme'] }));
  assert.equal(await runCli(['orgs', 'switch'], h.env), 0);
  assert.equal(h.sent[0]?.searchParams.get('limit'), '10');
});

void test('space switch lists the file org and writes the picked space', async (t) => {
  const h = await setup(t, scriptedPrompter({ space: ['sales'] }));
  assert.equal(await runCli(['space', 'switch', '--limit', '20'], h.env), 0);
  assert.equal(h.sent[0]?.pathname, '/api/v1/orgs/acme/spaces');
  assert.deepEqual(await h.store.read(), { ...file, space: 'sales' });
});

void test('space switch --org overrides the file org', async (t) => {
  const h = await setup(t, scriptedPrompter({ space: ['sales'] }));
  assert.equal(
    await runCli(['space', 'switch', '--org', 'beta', '--limit', '20'], h.env),
    0,
  );
  assert.equal(h.sent[0]?.pathname, '/api/v1/orgs/beta/spaces');
  assert.equal((await h.store.read())?.org, 'beta');
});

void test('a bad --limit is a usage error and sends nothing', async (t) => {
  const h = await setup(t, noTtyPrompter());
  assert.equal(await runCli(['orgs', 'switch', '--limit', 'zero'], h.env), 2);
  assert.equal(h.sent.length, 0);
});

void test('switching without a credentials file exits 1 and sends nothing', async (t) => {
  const h = await setup(t, noTtyPrompter(), null);
  assert.equal(await runCli(['space', 'switch'], h.env), 1);
  assert.equal(h.sent.length, 0);
});
