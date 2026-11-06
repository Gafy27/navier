import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import {
  assertWorkerToolsFresh,
  canonicalHash,
  DEV_STATE_FILE,
  deployFiles,
  readDevState,
  readWorkerTools,
  workerSources,
} from './worker-tools.ts';
import type { WorkerTools } from './worker-tools.ts';

const TOKEN = 'wtt-never-printed';
const WORKER = { name: 'desk', toolsUrl: 'http://127.0.0.1:4100/tools' };
const ENTRY = {
  key: 'desk_lookup_order',
  implementationVersion: 1,
  name: 'desk_lookup_order',
  description: 'Look up an order',
  inputSchema: { type: 'object' },
  approval: 'never_ask',
};

async function tempDir(t: TestContext): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cli-deploy-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

function live(hash: string): WorkerTools {
  return { ...WORKER, entries: [], hash };
}

void test('V33: key order does not change the hash; array order does', () => {
  assert.equal(
    canonicalHash({ a: 1, b: { c: 2, d: 3 } }),
    canonicalHash({ b: { d: 3, c: 2 }, a: 1 }),
  );
  assert.notEqual(canonicalHash([1, 2]), canonicalHash([2, 1]));
  assert.match(canonicalHash({}), /^[0-9a-f]{64}$/u);
});

void test('V33: a hash mismatch is a CliFailure naming the worker and dev/start', () => {
  assert.throws(
    () => {
      assertWorkerToolsFresh(live('new'), { ...WORKER, hash: 'old' });
    },
    (cause: unknown) =>
      cause instanceof CliFailure &&
      cause.message.includes('worker desk') &&
      cause.message.includes('restart dev or start'),
  );
});

void test('V33: the same hash and a missing snapshot pass', () => {
  assertWorkerToolsFresh(live('same'), { ...WORKER, hash: 'same' });
  assertWorkerToolsFresh(live('any'), undefined);
});

void test('V35: readWorkerTools sends Bearer <token> in a header, never the URL, and hashes the body', async () => {
  const seen: { url: string; authorization: string | null }[] = [];
  const tools = await readWorkerTools(
    (input, init) => {
      const request = new Request(input, init);
      seen.push({
        url: request.url,
        authorization: request.headers.get('authorization'),
      });
      return Promise.resolve(Response.json([ENTRY]));
    },
    WORKER,
    TOKEN,
  );
  assert.deepEqual(seen, [
    { url: WORKER.toolsUrl, authorization: `Bearer ${TOKEN}` },
  ]);
  assert.equal(tools.entries[0]?.key, ENTRY.key);
  assert.equal(tools.hash, canonicalHash([ENTRY]));
});

void test('readWorkerTools: a refusal, an unreachable worker, and a bad list each fail naming the worker, never the token', async () => {
  const replies: (() => Promise<Response>)[] = [
    () => Promise.resolve(Response.json({}, { status: 401 })),
    () => Promise.reject(new TypeError(`fetch failed ${TOKEN}`)),
    () => Promise.resolve(Response.json([{ ...ENTRY, extra: true }])),
    () => Promise.resolve(new Response('not json')),
  ];
  for (const reply of replies) {
    await assert.rejects(
      readWorkerTools(reply, WORKER, TOKEN),
      (cause: unknown) =>
        cause instanceof CliFailure &&
        cause.message.startsWith('worker desk') &&
        !cause.message.includes(TOKEN),
    );
  }
});

void test('readDevState: no file is no snapshot; rows parse; a bad file fails', async (t) => {
  const dir = await tempDir(t);
  assert.deepEqual(await readDevState(dir), []);
  await mkdir(join(dir, '.secrets'));
  const file = join(dir, '.secrets', DEV_STATE_FILE);
  const rows = [{ ...WORKER, hash: 'abc' }];
  await writeFile(file, JSON.stringify(rows));
  assert.deepEqual(await readDevState(dir), rows);
  await writeFile(file, '{"workers": []}');
  await assert.rejects(readDevState(dir), CliFailure);
});

void test('PD7: a directory yields its own *.yaml and *.yml files in lexical order; a file yields itself', async (t) => {
  const dir = await tempDir(t);
  for (const name of ['b.yaml', 'a.yml', 'c.txt', 'B.yaml']) {
    await writeFile(join(dir, name), '');
  }
  await mkdir(join(dir, 'nested.yaml'));
  assert.deepEqual(await deployFiles(dir), [
    join(dir, 'B.yaml'),
    join(dir, 'a.yml'),
    join(dir, 'b.yaml'),
  ]);
  assert.deepEqual(await deployFiles(join(dir, 'c.txt')), [join(dir, 'c.txt')]);
  assert.deepEqual(await deployFiles(join(dir, 'nested.yaml')), []);
});

void test('PD7: a missing path is a usage error naming it', async (t) => {
  const missing = join(await tempDir(t), 'absent');
  await assert.rejects(
    deployFiles(missing),
    (cause: unknown) =>
      cause instanceof CliUsage && cause.message.includes(missing),
  );
});

void test('D8: a dev-state row URL wins, config.yaml is the fallback, and neither fails naming the worker', () => {
  const devUrl = 'http://127.0.0.1:40123/tools';
  const rows = [{ name: 'desk', toolsUrl: devUrl, hash: 'h' }];
  assert.deepEqual(
    workerSources(
      [
        { name: 'desk', toolsUrl: WORKER.toolsUrl },
        { name: 'other', toolsUrl: WORKER.toolsUrl },
      ],
      rows,
    ),
    [
      { name: 'desk', toolsUrl: devUrl },
      { name: 'other', toolsUrl: WORKER.toolsUrl },
    ],
  );
  assert.throws(
    () => workerSources([{ name: 'bare' }], rows),
    (cause: unknown) =>
      cause instanceof CliFailure && cause.message.startsWith('worker bare'),
  );
});
