import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { listCatalogOperations } from '../../client/index.ts';
import type { CatalogOperation } from '../../client/index.ts';
import { z } from '../../index.ts';
import { runCli } from '../index.ts';
import type { CliEnv } from '../index.ts';
import { STREAM_FAILURE_NAME } from './constants.ts';
import type { Io } from './context.ts';
import type { Credentials, CredentialsStore } from './credentials.ts';
import { createCredentialsStore } from './credentials.ts';
import { CliFailure } from './failure.ts';
import type { CliUsage } from './failure.ts';
import { checkInput, emitFrames, parseFlags } from './leaf.ts';
import { noTtyPrompter } from './prompts.ts';
import type { Prompter } from './prompts.ts';
import { scriptedPrompter } from './prompts.test-support.ts';

const BASE = 'http://api.test';
const API = '/api/v1';
const HIDDEN = 'ses_hidden';
const SECRET = 'sk-real';
const ORG = 'acme';
const TOOL = 'lookup';
const PROVIDER = 'anthropic';
const MODEL = 'opus';
const SUB_PREFIX = 'user:ns~';
const SPACE_DEFAULT = 'support';

const ME_PATH = `${API}/auth/me`;
const ME = { principal: `${SUB_PREFIX}bob`, kind: 'person' };
const ORGS = {
  items: [
    { id: ORG, name: 'Acme' },
    { id: 'beta', name: 'Beta' },
  ],
};
const SPACES = {
  items: [
    { id: 'support', name: 'Support' },
    { id: 'sales', name: 'Sales' },
  ],
};
const TWO_MEMBERS = {
  grants: [
    { principal: `${SUB_PREFIX}bob`, privilege: 'member' },
    { principal: `${SUB_PREFIX}dave`, privilege: 'editor' },
  ],
};
const ONE_MEMBER = {
  grants: [{ principal: `${SUB_PREFIX}dave`, privilege: 'editor' }],
};

const mixed: CatalogOperation = {
  operationId: 'mixed',
  summary: 'params, query, and body',
  kind: 'plain',
  input: z.object({
    id: z.string(),
    limit: z.number(),
    body: z.strictObject({
      title: z.string(),
      on: z.boolean().optional(),
      tags: z.array(z.string()).optional(),
    }),
  }),
};

const clash: CatalogOperation = {
  operationId: 'clash',
  summary: 'body key equals a path key',
  kind: 'plain',
  input: z.object({
    id: z.string(),
    body: z.object({ id: z.string(), title: z.string() }),
  }),
};

function operation(id: string): CatalogOperation {
  const found = listCatalogOperations().find((op) => op.operationId === id);
  assert.ok(found, id);
  return found;
}

interface Sent {
  readonly method: string;
  readonly path: string;
  readonly search: string;
  readonly body: string;
}

interface Setup {
  readonly prompter: Prompter;
  readonly stored?: Credentials | null;
  readonly tty?: boolean;
  readonly spaces?: unknown;
  readonly members?: unknown;
}

interface Harness {
  readonly env: CliEnv;
  readonly store: CredentialsStore;
  readonly sent: Sent[];
  readonly out: () => string;
  readonly err: () => string;
}

function signedIn(space: string | undefined): Credentials {
  const file: Credentials = {
    baseUrl: BASE,
    auth: { kind: 'person', session: 'ses_leaf-never-printed' },
    org: ORG,
  };
  return space === undefined ? file : { ...file, space };
}

const TOOL_WIRE = {
  org: ORG,
  key: TOOL,
  implementationVersion: 2,
  name: 'Lookup',
  description: 'Looks up a record',
  inputSchema: {},
  retryOnInterrupt: false,
  toolAttempts: 1,
  maxToolOutputBytes: 1,
  approval: 'never_ask',
  configSchema: null,
  enabled: true,
};
const MODEL_WIRE = {
  provider: PROVIDER,
  model: MODEL,
  enabled: true,
  degraded: false,
};

/** A fake API: lists answer from fixtures, and a write answers the route's own response shape. */
function answer(sent: Sent, setup: Setup): unknown {
  if (sent.path === ME_PATH) return ME;
  if (sent.path.endsWith('/key')) return { seq: 1 };
  if (sent.path.endsWith('/enabled')) return TOOL_WIRE;
  if (sent.path.includes('/models/')) return MODEL_WIRE;
  if (sent.path.endsWith('/spaces')) return setup.spaces ?? SPACES;
  if (sent.path.endsWith('/members')) return setup.members ?? TWO_MEMBERS;
  if (sent.path.endsWith('/orgs')) return ORGS;
  if (sent.path.endsWith('/agents')) return { items: [] };
  return {};
}

async function harness(t: TestContext, setup: Setup): Promise<Harness> {
  const dir = await mkdtemp(join(tmpdir(), 'cli-leaf-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = createCredentialsStore(dir);
  const stored =
    setup.stored === undefined ? signedIn(SPACE_DEFAULT) : setup.stored;
  if (stored !== null) await store.write(stored);
  const sent: Sent[] = [];
  let out = '';
  let err = '';
  const io: Io = {
    stdout: (text) => {
      out += text;
    },
    stderr: (text) => {
      err += text;
    },
    stdin: () => Promise.resolve(''),
    isTTY: setup.tty ?? true,
  };
  const env: CliEnv = {
    configDir: dir,
    projectDir: dir,
    vars: {},
    loopbackHost: '127.0.0.1',
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      const body = request.method === 'GET' ? '' : await request.text();
      const record: Sent = {
        method: request.method,
        path: url.pathname,
        search: url.search,
        body,
      };
      sent.push(record);
      return Response.json(answer(record, setup));
    },
    io,
    prompter: setup.prompter,
    open: () => undefined,
    listen: () => Promise.reject(new Error('listen not scripted')),
    spawn: () => {
      throw new Error('spawn not scripted');
    },
    readFile: () => Promise.reject(new Error('no such file')),
  };
  return {
    env,
    store,
    sent,
    out: () => out,
    err: () => err,
  };
}

function at(sent: readonly Sent[], index: number): Sent {
  const found = sent[index];
  assert.ok(found, `request ${String(index)}`);
  return found;
}

function bodyOf(sent: Sent): unknown {
  const parsed: unknown = JSON.parse(sent.body);
  return parsed;
}

function writeOf(sent: readonly Sent[], method: string): Sent {
  const found = sent.find((s) => s.method === method);
  assert.ok(found, method);
  return found;
}

/** The refusal for argv, from the parse or the schema check; undefined when it passes both. */
function refusalOf(
  op: CatalogOperation,
  argv: readonly string[],
): CliUsage | undefined {
  const parsed = parseFlags(op, argv, []);
  if (!parsed.ok) return parsed.error;
  const checked = checkInput(op, parsed.value);
  return checked.ok ? undefined : checked.error;
}

/** A refused input prints no flag value (V15): the parse and the schema check both must refuse it. */
function assertRefused(op: CatalogOperation, argv: readonly string[]): void {
  const error = refusalOf(op, argv);
  assert.ok(error, argv.join(' '));
  assert.equal(error.message.includes(HIDDEN), false);
}

void test('V15: params, query, and body flags nest scalars under body', () => {
  const parsed = parseFlags(
    mixed,
    ['--id', 'a', '--limit', '2', '--title', 'hi', '--on', 'true'],
    [],
  );
  assert.deepEqual(parsed, {
    ok: true,
    value: { id: 'a', limit: 2, body: { title: 'hi', on: true } },
  });
});

void test('V15: a bad flag, a bad value, or a missing value is refused and prints no value', () => {
  const cases: { op: CatalogOperation; argv: string[] }[] = [
    { op: mixed, argv: ['--id', 'a', '--limit', HIDDEN, '--title', 't'] },
    { op: mixed, argv: ['--nope', HIDDEN] },
    { op: mixed, argv: ['--id', 'a', '--limit', '1', '--tags', HIDDEN] },
    { op: mixed, argv: ['--id', 'a', '--limit', '1', '--title'] },
    { op: clash, argv: ['--id', HIDDEN, '--title', 't'] },
  ];
  for (const item of cases) assertRefused(item.op, item.argv);
});

void test('V15: a body key that equals a path key is a collision, named by key', () => {
  const parsed = parseFlags(clash, ['--id', 'a'], []);
  assert.equal(parsed.ok, false);
  assert.match(parsed.error.message, /flag collision: id/u);
});

void test('V15: a missing required key is asked for, not refused by the flag parser', () => {
  assert.equal(
    parseFlags(mixed, ['--limit', '1', '--title', 't'], []).ok,
    true,
  );
});

void test('V15: a stream route takes --lastEventId', () => {
  const parsed = parseFlags(
    operation('message'),
    ['--org', 'o', '--conv', 'c', '--msg', 'm', '--lastEventId', '3'],
    [],
  );
  assert.deepEqual(parsed, {
    ok: true,
    value: { org: 'o', conv: 'c', msg: 'm', lastEventId: '3' },
  });
});

void test('V15 (G6): a secret flag is refused before any request', async (t) => {
  const h = await harness(t, { prompter: scriptedPrompter({}) });
  const argv = [
    'provider',
    'key',
    '--org',
    ORG,
    '--provider',
    PROVIDER,
    '--key',
    SECRET,
  ];
  assert.equal(await runCli(argv, h.env), 2);
  assert.equal(h.sent.length, 0);
  assert.equal(h.err().includes(SECRET), false);
  assert.equal(h.out().includes(SECRET), false);
});

void test('V15: a masked prompt sends the secret only in the setProviderKey body', async (t) => {
  const h = await harness(t, {
    prompter: scriptedPrompter({ provider: [PROVIDER], key: [SECRET] }),
  });
  assert.equal(await runCli(['provider', 'key', '--org', ORG], h.env), 0);
  const write = at(h.sent, 0);
  assert.equal(write.method, 'PUT');
  assert.equal(write.path, `${API}/orgs/${ORG}/providers/${PROVIDER}/key`);
  assert.deepEqual(bodyOf(write), { key: SECRET });
  assert.equal(h.out().includes(SECRET), false);
});

void test('V15 (G6): with no TTY a missing secret is a usage error before any request', async (t) => {
  const h = await harness(t, { prompter: noTtyPrompter(), tty: false });
  const argv = ['provider', 'key', '--org', ORG, '--provider', PROVIDER];
  assert.equal(await runCli(argv, h.env), 2);
  assert.match(h.err(), /missing --key/u);
  assert.equal(h.sent.length, 0);
});

void test('V16: a body default fixes enabled, and a flag cannot override it', async (t) => {
  const h = await harness(t, { prompter: scriptedPrompter({}) });
  const tool = ['--org', ORG, '--tool', TOOL, '--implementationVersion', '2'];
  assert.equal(
    await runCli(['tool', 'enable', ...tool, '--enabled', 'false'], h.env),
    0,
  );
  assert.equal(await runCli(['tool', 'disable', ...tool], h.env), 0);
  assert.deepEqual(bodyOf(at(h.sent, 0)), {
    implementationVersion: 2,
    enabled: true,
  });
  assert.deepEqual(bodyOf(at(h.sent, 1)), {
    implementationVersion: 2,
    enabled: false,
  });
});

void test('V16: model disable and degrade send their fixed enabled and degraded pair', async (t) => {
  const h = await harness(t, { prompter: scriptedPrompter({}) });
  const model = ['--org', ORG, '--provider', PROVIDER, '--model', MODEL];
  assert.equal(await runCli(['model', 'disable', ...model], h.env), 0);
  assert.equal(await runCli(['model', 'degrade', ...model], h.env), 0);
  assert.deepEqual(bodyOf(at(h.sent, 0)), { enabled: false, degraded: false });
  assert.deepEqual(bodyOf(at(h.sent, 1)), { enabled: true, degraded: true });
});

void test('V17 (a): a credentials space is used and no space list is sent', async (t) => {
  const h = await harness(t, { prompter: scriptedPrompter({}) });
  assert.equal(
    await runCli(['space', 'member', 'list', '--org', ORG], h.env),
    0,
  );
  assert.deepEqual(
    h.sent.map((s) => s.path),
    [`${API}/orgs/${ORG}/spaces/${SPACE_DEFAULT}/members`],
  );
});

void test('V17 (b): with no space and a TTY, a select over the space rows fills the request', async (t) => {
  const h = await harness(t, {
    prompter: scriptedPrompter({ space: ['sales'] }),
    stored: signedIn(undefined),
  });
  assert.equal(
    await runCli(['space', 'member', 'list', '--org', ORG], h.env),
    0,
  );
  assert.equal(at(h.sent, 0).path, `${API}/orgs/${ORG}/spaces`);
  assert.equal(
    at(h.sent, 0).search,
    `?limit=${String(Number.MAX_SAFE_INTEGER)}`,
  );
  assert.equal(at(h.sent, 1).path, `${API}/orgs/${ORG}/spaces/sales/members`);
});

void test('agent list does not ask for a limit; --limit still sets it', async (t) => {
  const h = await harness(t, { prompter: scriptedPrompter({}) });
  assert.equal(
    await runCli(['agent', 'list', '--org', ORG, '--view', 'use'], h.env),
    0,
  );
  assert.equal(
    at(h.sent, 0).search,
    `?view=use&limit=${String(Number.MAX_SAFE_INTEGER)}`,
  );
  const capped = await harness(t, { prompter: scriptedPrompter({}) });
  assert.equal(
    await runCli(
      ['agent', 'list', '--org', ORG, '--view', 'use', '--limit', '4'],
      capped.env,
    ),
    0,
  );
  assert.equal(at(capped.sent, 0).search, '?view=use&limit=4');
});

void test('V17 (c): with --yes and one row the select picks it without asking', async (t) => {
  const h = await harness(t, {
    prompter: scriptedPrompter({}),
    members: ONE_MEMBER,
  });
  assert.equal(
    await runCli(['member', 'remove', '--org', ORG, '--yes'], h.env),
    0,
  );
  assert.equal(
    decodeURIComponent(writeOf(h.sent, 'DELETE').path),
    `${API}/orgs/${ORG}/members/${SUB_PREFIX}dave`,
  );
});

void test('V17 (d): with --yes and two rows the select refuses to choose', async (t) => {
  const h = await harness(t, { prompter: scriptedPrompter({}) });
  assert.equal(
    await runCli(['member', 'remove', '--org', ORG, '--yes'], h.env),
    2,
  );
  assert.equal(
    h.sent.some((s) => s.method === 'DELETE'),
    false,
  );
  assert.match(h.err(), /missing --principal/u);
});

void test('V17 (e): with --yes a required text key with no default is a usage error', async (t) => {
  const h = await harness(t, { prompter: scriptedPrompter({}) });
  assert.equal(
    await runCli(['provider', 'add', '--org', ORG, '--yes'], h.env),
    2,
  );
  assert.match(h.err(), /missing --provider/u);
  assert.equal(h.sent.length, 0);
});

void test('V17 (f): with no TTY a missing space is a usage error and sends nothing', async (t) => {
  const h = await harness(t, {
    prompter: noTtyPrompter(),
    stored: signedIn(undefined),
    tty: false,
  });
  assert.equal(
    await runCli(['space', 'member', 'list', '--org', ORG], h.env),
    2,
  );
  assert.match(h.err(), /missing --space/u);
  assert.equal(h.sent.length, 0);
});

void test('V18: a sub becomes the wire principal from me, which is read once', async (t) => {
  const h = await harness(t, { prompter: scriptedPrompter({}) });
  assert.equal(
    await runCli(['member', 'add', '--org', ORG, '--sub', 'alice'], h.env),
    0,
  );
  assert.equal(h.sent.filter((s) => s.path === ME_PATH).length, 1);
  assert.equal(
    decodeURIComponent(writeOf(h.sent, 'PUT').path),
    `${API}/orgs/${ORG}/members/${SUB_PREFIX}alice`,
  );
});

void test('V18: a missing sub is asked as text, never as a select', async (t) => {
  const h = await harness(t, {
    prompter: scriptedPrompter({ sub: ['carol'] }),
  });
  assert.equal(await runCli(['member', 'add', '--org', ORG], h.env), 0);
  assert.equal(
    decodeURIComponent(writeOf(h.sent, 'PUT').path),
    `${API}/orgs/${ORG}/members/${SUB_PREFIX}carol`,
  );
});

void test('V18: with no TTY a missing sub is a usage error before me is read', async (t) => {
  const h = await harness(t, { prompter: noTtyPrompter(), tty: false });
  assert.equal(await runCli(['member', 'add', '--org', ORG], h.env), 2);
  assert.match(h.err(), /missing --sub/u);
  assert.equal(h.sent.length, 0);
});

void test('V18: a sub with a bad character is refused before the write', async (t) => {
  const h = await harness(t, { prompter: scriptedPrompter({}) });
  assert.equal(
    await runCli(['member', 'add', '--org', ORG, '--sub', 'a b'], h.env),
    2,
  );
  assert.equal(
    h.sent.some((s) => s.method === 'PUT'),
    false,
  );
});

void test('V18: remove picks the principal from the members list by its principal id', async (t) => {
  const h = await harness(t, {
    prompter: scriptedPrompter({ principal: [`${SUB_PREFIX}dave`] }),
  });
  assert.equal(await runCli(['member', 'remove', '--org', ORG], h.env), 0);
  assert.equal(
    decodeURIComponent(writeOf(h.sent, 'DELETE').path),
    `${API}/orgs/${ORG}/members/${SUB_PREFIX}dave`,
  );
});

void test('emitFrames: a stream failure prints its type and message as a CliFailure', async () => {
  const failing = (async function* () {
    yield await Promise.resolve({ kind: 'delta' });
    const failure = Object.assign(new Error('denied'), {
      type: 'unauthenticated',
    });
    failure.name = STREAM_FAILURE_NAME;
    throw failure;
  })();
  const out: string[] = [];
  const io: Io = {
    stdout: (text) => {
      out.push(text);
    },
    stderr: () => undefined,
    stdin: () => Promise.resolve(''),
    isTTY: false,
  };
  await assert.rejects(emitFrames(failing, io), (error: unknown) => {
    assert.ok(error instanceof CliFailure);
    assert.equal(error.message, 'unauthenticated: denied');
    return true;
  });
  assert.deepEqual(out, [`${JSON.stringify({ kind: 'delta' })}\n`]);
});
