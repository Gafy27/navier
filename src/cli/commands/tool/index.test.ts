import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { runCli } from '../../index.ts';
import { EXIT_OK, EXIT_USAGE } from '../../utils/constants.ts';
import { CliUsage } from '../../utils/failure.ts';
import { noTtyPrompter } from '../../utils/prompts.ts';
import { scriptedPrompter } from '../../utils/prompts.test-support.ts';
import type { Prompter } from '../../utils/prompts.ts';
import { writeServerFiles } from '../../utils/server-config.ts';
import { DEV_STATE_FILE } from '../deploy/worker-tools.ts';
import { harness } from '../grant/grant.test-support.ts';
import type { Harness, Reply, Sent } from '../grant/grant.test-support.ts';
import { runToolCreate } from './index.ts';

const TOKEN = 'wtt-tool-never-printed';
const CONFIG_URL = 'http://127.0.0.1:8082/tools';
const DEV_URL = 'http://127.0.0.1:40123/tools';
const CREATE_PATH = '/api/v1/orgs/acme/tools';

function entry(key: string): Record<string, unknown> {
  return {
    key,
    implementationVersion: 1,
    name: key,
    description: `${key} tool`,
    inputSchema: { type: 'object' },
    approval: 'never_ask',
  };
}

const LOOKUP = entry('desk_lookup_order');
const REFUND = entry('desk_refund_order');

/** `createTool` answers the `ToolWire` row the client checks: the sent entry plus stored fields. */
function created(body: unknown): unknown {
  return {
    retryOnInterrupt: false,
    toolAttempts: 1,
    maxToolOutputBytes: 1,
    configSchema: null,
    ...(body as Record<string, unknown>),
    org: 'acme',
    enabled: false,
  };
}

function workerReply(entries: readonly unknown[]): (sent: Sent) => Reply {
  return (sent) =>
    sent.path === '/tools' ? { json: entries } : { json: created(sent.body) };
}

async function desk(
  t: TestContext,
  options: {
    readonly entries?: readonly unknown[];
    readonly token?: boolean;
    readonly prompter?: Prompter;
    readonly tty?: boolean;
  },
): Promise<Harness> {
  const h = await harness(t, {
    reply: workerReply(options.entries ?? [LOOKUP, REFUND]),
    prompter: options.prompter ?? noTtyPrompter(),
    tty: options.tty ?? true,
  });
  await writeServerFiles(h.env.projectDir, {
    config: {
      env: {},
      workers: [
        {
          name: 'desk',
          entry: 'examples/desk/worker.ts',
          toolsUrl: CONFIG_URL,
        },
      ],
    },
    secrets: {
      env: options.token === false ? {} : { WORKER_TOOLS_TOKEN: TOKEN },
      databases: {},
    },
  });
  return h;
}

function creates(sent: readonly Sent[]): Sent[] {
  return sent.filter((s) => s.path === CREATE_PATH && s.method === 'POST');
}

void test('a select picks one served entry and createTool sends it as the body', async (t) => {
  const h = await desk(t, {
    prompter: scriptedPrompter({ tool: ['desk_refund_order'] }),
  });
  await runToolCreate(h.ctx, { yes: false });
  assert.deepEqual(
    creates(h.sent).map((s) => s.body),
    [REFUND],
  );
  assert.deepEqual(JSON.parse(h.out()), created(REFUND));
  assert.ok(!h.out().includes(TOKEN));
});

void test('--tool answers without a prompt; an unserved key is a usage error and creates nothing', async (t) => {
  const h = await desk(t, { tty: false });
  await runToolCreate(h.ctx, { tool: 'desk_lookup_order', yes: false });
  assert.deepEqual(
    creates(h.sent).map((s) => s.body),
    [LOOKUP],
  );
  await assert.rejects(
    runToolCreate(h.ctx, { tool: 'nope', yes: false }),
    CliUsage,
  );
  assert.equal(creates(h.sent).length, 1);
});

void test('--yes picks the only entry, and refuses to choose among several', async (t) => {
  const one = await desk(t, { entries: [LOOKUP] });
  await runToolCreate(one.ctx, { yes: true });
  assert.equal(creates(one.sent).length, 1);
  const two = await desk(t, {});
  await assert.rejects(
    runToolCreate(two.ctx, { yes: true }),
    (cause: unknown) =>
      cause instanceof CliUsage && cause.message === 'missing --tool',
  );
  assert.equal(creates(two.sent).length, 0);
});

void test('V35: workers without WORKER_TOOLS_TOKEN is a usage error naming init, before any fetch', async (t) => {
  const h = await desk(t, { token: false });
  await assert.rejects(
    runToolCreate(h.ctx, { yes: false }),
    (cause: unknown) =>
      cause instanceof CliUsage && cause.message.includes('cli init'),
  );
  assert.deepEqual(h.sent, []);
});

void test('the dev-state row URL wins over config.yaml', async (t) => {
  const seen: string[] = [];
  const h = await desk(t, {});
  const base = h.env.fetch;
  Object.assign(h.env, {
    fetch: (...args: Parameters<typeof fetch>) => {
      const [input] = args;
      seen.push(input instanceof Request ? input.url : String(input));
      return base(...args);
    },
  });
  await mkdir(join(h.env.projectDir, '.secrets'), { recursive: true });
  await writeFile(
    join(h.env.projectDir, '.secrets', DEV_STATE_FILE),
    JSON.stringify([{ name: 'desk', toolsUrl: DEV_URL, hash: 'h' }]),
  );
  await runToolCreate(h.ctx, { tool: 'desk_lookup_order', yes: false });
  assert.equal(seen[0], DEV_URL);
});

void test('PD13: with only credentials, tool create exits 2 naming cli init and sends nothing', async (t) => {
  const h = await harness(t, { reply: workerReply([]) });
  let err = '';
  const env = {
    ...h.env,
    io: {
      ...h.env.io,
      stderr: (s: string) => {
        err += s;
      },
    },
  };
  const code = await runCli(['tool', 'create'], env);
  assert.equal(code, EXIT_USAGE);
  assert.match(err, /cli init/u);
  assert.deepEqual(h.sent, []);
});

void test('tool create and the table tool leaves share one tool group', async (t) => {
  const h = await harness(t, { reply: workerReply([]) });
  let out = '';
  const env = {
    ...h.env,
    io: {
      ...h.env.io,
      stdout: (s: string) => {
        out += s;
      },
    },
  };
  assert.equal(await runCli(['tool', '--help'], env), EXIT_OK);
  assert.match(out, /create/u);
  assert.match(out, /enable/u);
});
