import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { listCatalogOperations } from '../../../client/index.ts';
import { runCli } from '../../index.ts';
import type { CliEnv } from '../../index.ts';
import type { Io } from '../../utils/context.ts';
import { createCredentialsStore } from '../../utils/credentials.ts';
import type { Credentials } from '../../utils/credentials.ts';
import { noTtyPrompter } from '../../utils/prompts.ts';

const BASE = 'http://api.test';
const API = '/api/v1';
const SECRET = 'sk-api-secret';
const ORG = 'x';
const CONVERSATION = `${API}/orgs/o/conversations/c/messages/m/events`;

const file: Credentials = {
  baseUrl: BASE,
  auth: { kind: 'person', session: 'ses_api-never-printed' },
};

interface Sent {
  readonly method: string;
  readonly path: string;
  readonly body: string;
}

interface Harness {
  readonly env: CliEnv;
  readonly sent: Sent[];
  readonly out: () => string;
  readonly err: () => string;
}

const frames = [
  { id: '4', kind: 'delta', delta: 'text', traceId: 't', text: 'one' },
  { id: '5', kind: 'delta', delta: 'text', traceId: 't', text: 'two' },
];

function sse(): Response {
  const text = frames
    .map((frame) => `id: ${frame.id}\ndata: ${JSON.stringify(frame)}\n\n`)
    .join('');
  return new Response(text, {
    headers: { 'content-type': 'text/event-stream' },
  });
}

/** A fake API: the message route streams two frames; the org route answers, or fails when asked to. */
function respond(sent: Sent, denied: boolean): Response {
  if (sent.path === CONVERSATION) return sse();
  if (denied) {
    return Response.json(
      { error: { type: 'forbidden', message: 'denied' } },
      { status: 403 },
    );
  }
  return Response.json({ id: ORG, name: 'X' });
}

async function harness(t: TestContext, denied = false): Promise<Harness> {
  const dir = await mkdtemp(join(tmpdir(), 'cli-api-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await createCredentialsStore(dir).write(file);
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
    isTTY: false,
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
      const record: Sent = { method: request.method, path: url.pathname, body };
      sent.push(record);
      return respond(record, denied);
    },
    io,
    prompter: noTtyPrompter(),
    open: () => undefined,
    listen: () => Promise.reject(new Error('listen not scripted')),
    spawn: () => {
      throw new Error('spawn not scripted');
    },
    readFile: () => Promise.reject(new Error('no such file')),
  };
  return { env, sent, out: () => out, err: () => err };
}

void test('api --list prints the sorted catalog operation ids', async (t) => {
  const h = await harness(t);
  assert.equal(await runCli(['api', '--list'], h.env), 0);
  const expected = listCatalogOperations()
    .map((op) => op.operationId)
    .sort();
  assert.equal(h.out(), `${expected.join('\n')}\n`);
  assert.equal(h.sent.length, 0);
});

void test('api calls one operation with its JSON input and prints the result', async (t) => {
  const h = await harness(t);
  assert.equal(await runCli(['api', 'getOrg', `{"org":"${ORG}"}`], h.env), 0);
  assert.equal(h.sent[0]?.path, `${API}/orgs/${ORG}`);
  assert.equal(h.out(), `${JSON.stringify({ id: ORG, name: 'X' })}\n`);
});

void test('api refuses an unknown id, bad JSON, a non-object, and a missing field before any request', async (t) => {
  const cases = [
    ['api', 'nope'],
    ['api', 'getOrg', 'not json'],
    ['api', 'getOrg', '[]'],
    ['api', 'getOrg', '{}'],
  ];
  for (const argv of cases) {
    const h = await harness(t);
    assert.equal(await runCli(argv, h.env), 2, argv.join(' '));
    assert.equal(h.sent.length, 0, argv.join(' '));
  }
});

void test('api refuses a secret in its JSON argument before any request (G6, D2)', async (t) => {
  const h = await harness(t);
  const json = `{"org":"${ORG}","provider":"p","body":{"key":"${SECRET}"}}`;
  assert.equal(await runCli(['api', 'setProviderKey', json], h.env), 2);
  assert.equal(h.sent.length, 0);
  assert.equal(h.err().includes(SECRET), false);
});

void test('api --stream prints one JSON object per line', async (t) => {
  const h = await harness(t);
  const json = `{"org":"o","conv":"c","msg":"m"}`;
  assert.equal(await runCli(['api', 'message', json, '--stream'], h.env), 0);
  const lines = h
    .out()
    .split('\n')
    .filter((line) => line !== '');
  assert.deepEqual(
    lines.map((line) => JSON.parse(line) as unknown),
    frames,
  );
});

void test('api prints a failed call as the API error and exits 1', async (t) => {
  const h = await harness(t, true);
  assert.equal(await runCli(['api', 'getOrg', `{"org":"${ORG}"}`], h.env), 1);
  assert.equal(h.err(), 'forbidden: denied\n');
  assert.equal(h.out(), '');
});
