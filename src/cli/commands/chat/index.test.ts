import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { createContext } from '../../index.ts';
import type { CliContext, Io } from '../../utils/context.ts';
import { AuthKind } from '../../utils/credentials.ts';
import { EXIT_FAIL, EXIT_OK } from '../../utils/constants.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import { noTtyPrompter } from '../../utils/prompts.ts';
import type { Prompter } from '../../utils/prompts.ts';
import { scriptedPrompter } from '../../utils/prompts.test-support.ts';
import { runChat } from './index.ts';
import { CHAT_BLOCKED_EXIT, CHAT_TOOL_INPUT_PREVIEW_MAX } from './render.ts';

const BASE = 'http://api.test';
const ORG = '/api/v1/orgs/acme';
const CONV = `${ORG}/conversations/c1`;
const EVENTS = `${CONV}/messages/m1/events`;

interface Sent {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

const MODELS = {
  items: [
    { provider: 'p', model: 'on', enabled: true, degraded: false },
    { provider: 'p', model: 'off', enabled: false, degraded: false },
  ],
};
const POSTED = { userMessageId: 'u1', agentMessageId: 'm1', pending: false };
const LONG = 'x'.repeat(CHAT_TOOL_INPUT_PREVIEW_MAX + 1);

function frame(value: Record<string, unknown>): string {
  return `id: ${String(value['id'])}\ndata: ${JSON.stringify(value)}\n\n`;
}

const FRAMES = {
  reasoning: frame({
    id: '1',
    kind: 'delta',
    delta: 'reasoning',
    traceId: 't',
    text: 'thinking',
  }),
  text: frame({
    id: '2',
    kind: 'delta',
    delta: 'text',
    traceId: 't',
    text: 'hello',
  }),
  actionA: frame({
    id: '3',
    kind: 'action',
    data: { actionId: 'a', toolKey: 'tool:one', arguments: { q: LONG } },
  }),
  actionB: frame({
    id: '4',
    kind: 'action',
    data: { actionId: 'b', toolKey: 'tool:two', arguments: {} },
  }),
  toolA: frame({
    id: '6',
    kind: 'tool',
    data: { actionId: 'a', isError: false },
  }),
  toolB: frame({
    id: '7',
    kind: 'tool',
    data: { actionId: 'b', isError: true },
  }),
  terminal: frame({ id: '8', kind: 'terminal', status: 'succeeded' }),
  end: frame({ id: '8.end', kind: 'end-of-stream' }),
};

function blocked(canRemember: boolean): string {
  return frame({
    id: '5',
    kind: 'blocked',
    actions: [
      { actionId: 'a', kind: 'approval', canRemember },
      { actionId: 'b', kind: 'approval', canRemember: false },
    ],
  });
}

function script(...parts: string[]): string {
  return parts.join('');
}

interface Harness {
  readonly ctx: CliContext;
  readonly io: Io;
  readonly sent: Sent[];
  readonly out: () => string;
  readonly err: () => string;
}

async function harness(
  t: TestContext,
  options: {
    readonly events?: string;
    readonly eventsMissing?: boolean;
    readonly postReply?: unknown;
    readonly prompter?: Prompter;
    readonly tty?: boolean;
  },
): Promise<Harness> {
  const dir = await mkdtemp(join(tmpdir(), 'cli-chat-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const sent: Sent[] = [];
  let out = '';
  let err = '';
  const io: Io = {
    stdout: (s) => {
      out += s;
    },
    stderr: (s) => {
      err += s;
    },
    stdin: () => Promise.resolve(''),
    isTTY: options.tty ?? true,
  };
  const ctx = createContext({
    configDir: dir,
    projectDir: dir,
    vars: {},
    loopbackHost: '127.0.0.1',
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const text = request.method === 'GET' ? '' : await request.text();
      const path = new URL(request.url).pathname;
      sent.push({
        method: request.method,
        path,
        body: text.length === 0 ? undefined : (JSON.parse(text) as unknown),
      });
      if (path === `${ORG}/models`) return Response.json(MODELS);
      if (path === EVENTS) {
        if (options.eventsMissing === true) {
          return Response.json(
            { error: { type: 'not_found', message: 'missing' } },
            { status: 404 },
          );
        }
        return new Response(options.events ?? '', {
          headers: { 'content-type': 'text/event-stream' },
        });
      }
      if (path === `${ORG}/conversations`) {
        return Response.json({
          conversationId: 'c1',
          message: options.postReply ?? POSTED,
        });
      }
      if (path === `${CONV}/messages`) {
        return Response.json(options.postReply ?? POSTED);
      }
      return Response.json({});
    },
    io,
    prompter: options.prompter ?? noTtyPrompter(),
    open: () => undefined,
    listen: () => Promise.reject(new Error('listen not scripted')),
    spawn: () => {
      throw new Error('spawn not scripted');
    },
    readFile: () => Promise.reject(new Error('readFile not scripted')),
  });
  await ctx.credentials.write({
    baseUrl: BASE,
    auth: { kind: AuthKind.enum.person, session: 'ses_chat-never-printed' },
    org: 'acme',
    space: 's1',
  });
  return { ctx, io, sent, out: () => out, err: () => err };
}

function paths(h: Harness): string[] {
  return h.sent.map((s) => s.path);
}

function bodyAt(h: Harness, path: string): unknown {
  return h.sent.find((s) => s.path === path)?.body;
}

const FULL = script(
  FRAMES.reasoning,
  FRAMES.text,
  FRAMES.actionA,
  FRAMES.actionB,
  blocked(true),
  FRAMES.toolA,
  FRAMES.toolB,
  FRAMES.terminal,
  FRAMES.end,
);

void test('V31: the blocked frame drives approve (with remember) and deny; no list call', async (t) => {
  const h = await harness(t, {
    events: FULL,
    prompter: scriptedPrompter({
      message: ['hi', ''],
      decision: ['approve', 'deny'],
      remember: [true],
    }),
  });
  assert.equal(await runChat(h.ctx, { agent: 'agent-1' }, h.io), EXIT_OK);
  assert.ok(h.out().includes('\u001B[2mthinking\u001B[22m'));
  assert.ok(h.out().includes('hello'));
  const lines = h.out().split('\n');
  const toolLines = lines.filter((l) => l.startsWith('tool '));
  assert.equal(toolLines.length, 2);
  for (const line of toolLines) {
    assert.ok(line.length <= CHAT_TOOL_INPUT_PREVIEW_MAX);
  }
  assert.ok(toolLines[1]?.endsWith('error'));
  assert.deepEqual(bodyAt(h, `${CONV}/actions/a/approve`), { remember: true });
  assert.ok(paths(h).includes(`${CONV}/actions/b/deny`));
  assert.ok(!paths(h).some((p) => p.endsWith('/blocked-actions')));
  assert.equal(h.err(), 'status: succeeded\n');
  const start = bodyAt(h, `${ORG}/conversations`) as {
    spaceId: string;
    firstMessage: { agentId: string; text: string };
  };
  assert.equal(start.spaceId, 's1');
  assert.equal(start.firstMessage.agentId, 'agent-1');
  assert.equal(start.firstMessage.text, 'hi');
});

void test('V31: a declined remember sends remember false; canRemember false never asks', async (t) => {
  const declined = await harness(t, {
    events: FULL,
    prompter: scriptedPrompter({
      message: ['hi', ''],
      decision: ['approve', 'deny'],
      remember: [false],
    }),
  });
  await runChat(declined.ctx, { agent: 'agent-1' }, declined.io);
  assert.deepEqual(bodyAt(declined, `${CONV}/actions/a/approve`), {
    remember: false,
  });
  const never = await harness(t, {
    events: script(
      FRAMES.actionA,
      FRAMES.actionB,
      blocked(false),
      FRAMES.toolA,
      FRAMES.toolB,
      FRAMES.terminal,
      FRAMES.end,
    ),
    prompter: scriptedPrompter({
      message: ['hi', ''],
      decision: ['approve', 'approve'],
    }),
  });
  await runChat(never.ctx, { agent: 'agent-1' }, never.io);
  assert.deepEqual(bodyAt(never, `${CONV}/actions/a/approve`), {});
  assert.deepEqual(bodyAt(never, `${CONV}/actions/b/approve`), {});
});

void test('V31: a tool frame before its action fails', async (t) => {
  const h = await harness(t, {
    events: script(FRAMES.toolA, FRAMES.end),
    prompter: scriptedPrompter({ message: ['hi'] }),
  });
  await assert.rejects(
    runChat(h.ctx, { agent: 'agent-1' }, h.io),
    (cause) => cause instanceof CliFailure,
  );
});

void test('V31: --message prints every frame as a JSON line and exits 3 on a block', async (t) => {
  const h = await harness(t, { events: FULL, tty: false });
  const code = await runChat(h.ctx, { agent: 'agent-1', message: 'hi' }, h.io);
  assert.equal(code, CHAT_BLOCKED_EXIT);
  assert.equal(CHAT_BLOCKED_EXIT, 3);
  const lines = h.out().trimEnd().split('\n');
  const parsed = lines.map((line) => JSON.parse(line) as { kind: string });
  assert.deepEqual(
    parsed.map((p) => p.kind),
    ['delta', 'delta', 'action', 'action', 'blocked'],
  );
  assert.ok(
    !paths(h).some(
      (p) => p.endsWith('/blocked-actions') || p.includes('/actions/'),
    ),
  );
});

void test('--message with no block prints frames and exits 0 on succeeded', async (t) => {
  const h = await harness(t, {
    events: script(FRAMES.text, FRAMES.terminal, FRAMES.end),
    tty: false,
  });
  const code = await runChat(h.ctx, { agent: 'agent-1', message: 'hi' }, h.io);
  assert.equal(code, EXIT_OK);
  assert.equal(h.out().trimEnd().split('\n').length, 2);
});

void test('V30: --model must be enabled before any post; the body carries modelSelection', async (t) => {
  const ok = await harness(t, {
    events: script(FRAMES.terminal, FRAMES.end),
    tty: false,
  });
  await runChat(
    ok.ctx,
    { agent: 'agent-1', model: 'p/on', message: 'hi' },
    ok.io,
  );
  const first = bodyAt(ok, `${ORG}/conversations`) as {
    firstMessage: { modelSelection: unknown };
  };
  assert.deepEqual(first.firstMessage.modelSelection, {
    provider: 'p',
    model: 'on',
    reasoningEffort: null,
  });
  for (const model of ['p/off', 'p/ghost', 'nope']) {
    const h = await harness(t, { tty: false });
    await assert.rejects(
      runChat(h.ctx, { agent: 'agent-1', model, message: 'hi' }, h.io),
      (cause) => cause instanceof CliUsage,
    );
    assert.ok(!paths(h).includes(`${ORG}/conversations`));
  }
});

void test('a pending post has no agent message and opens no stream', async (t) => {
  const h = await harness(t, {
    postReply: { userMessageId: 'u1', agentMessageId: null, pending: true },
    tty: false,
  });
  await assert.rejects(
    runChat(h.ctx, { agent: 'agent-1', message: 'hi' }, h.io),
    (cause) =>
      cause instanceof CliFailure && cause.message === 'unavailable: pending',
  );
  assert.ok(!paths(h).includes(EVENTS));
});

void test('a stream failure is reported as <type>: <message>', async (t) => {
  const h = await harness(t, { eventsMissing: true, tty: false });
  await assert.rejects(
    runChat(h.ctx, { agent: 'agent-1', message: 'hi' }, h.io),
    (cause) =>
      cause instanceof CliFailure && cause.message === 'not_found: missing',
  );
});

void test(
  'V31: first Ctrl-C stops the message; the second at the blocked prompt exits without waiting',
  { timeout: 2_000 },
  async (t) => {
    let asked: () => void = () => undefined;
    const prompting = new Promise<void>((resolve) => {
      asked = resolve;
    });
    const base = scriptedPrompter({ message: ['hi'] });
    const h = await harness(t, {
      events: script(FRAMES.actionA, FRAMES.actionB, blocked(true)),
      prompter: {
        ...base,
        select: () => {
          asked();
          return new Promise<never>(() => undefined);
        },
      },
    });
    const before = process.listenerCount('SIGINT');
    const running = runChat(h.ctx, { agent: 'agent-1' }, h.io);
    await prompting;
    process.emit('SIGINT');
    await new Promise((resolve) => setImmediate(resolve));
    process.emit('SIGINT');
    assert.equal(await running, EXIT_FAIL);
    const stops = h.sent.filter((s) => s.path === `${CONV}/stop`);
    assert.equal(stops.length, 1);
    assert.deepEqual(stops[0]?.body, { messageIds: ['m1'], kind: 'cancel' });
    assert.equal(process.listenerCount('SIGINT'), before);
  },
);
