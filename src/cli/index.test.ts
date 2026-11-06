import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { createContext, runCli } from './index.ts';
import type { CliContext, CliEnv } from './index.ts';
import { createCredentialsStore } from './utils/credentials.ts';
import type { Credentials } from './utils/credentials.ts';
import { CliFailure } from './utils/failure.ts';
import { noTtyPrompter } from './utils/prompts.ts';

const BASE = 'http://api.test';
const ISSUER = 'https://issuer.example';
const OLD_SESSION = 'ses_old-never-printed';
const NEW_SESSION = 'ses_new-never-printed';
const SECRET = 'svc-secret-never-printed';
const CODE = 'handoff-code-never-printed';
const IDP_AUTHORIZE = 'https://auth0.example/authorize?state=test';
const EXPIRED = 'run cli login';

const person: Credentials = {
  baseUrl: BASE,
  auth: { kind: 'person', session: OLD_SESSION },
};
const service: Credentials = {
  baseUrl: BASE,
  auth: {
    kind: 'service',
    issuer: ISSUER,
    clientId: 'svc',
    clientSecret: SECRET,
  },
};

const unauthenticated = (): Response =>
  Response.json(
    { error: { type: 'unauthenticated', message: 'unauthenticated' } },
    { status: 401 },
  );

const meReply = (): Response =>
  Response.json({ principal: 'user:ns~alice', kind: 'person' });

const delta = (id: string): string =>
  `id: ${id}\ndata: ${JSON.stringify({ id, kind: 'delta', delta: 'text', traceId: 't', text: 'x' })}\n\n`;

const endOfStream = `id: end\ndata: ${JSON.stringify({ id: 'end', kind: 'end-of-stream' })}\n\n`;

const sse = (...blocks: string[]): Response =>
  new Response(blocks.join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });

interface Harness {
  readonly env: CliEnv;
  readonly ctx: CliContext;
  readonly sent: Request[];
  readonly stderr: () => string;
  /** How many requests ended with `suffix`. */
  readonly count: (suffix: string) => number;
  readonly credentials: ReturnType<typeof createCredentialsStore>;
}

/** One temp config dir per test; the API, issuer, and browser are scripted. */
async function setup(
  t: TestContext,
  options: {
    readonly file?: Credentials;
    readonly tty: boolean;
    readonly respond: (req: Request) => Response;
  },
): Promise<Harness> {
  const dir = await mkdtemp(join(tmpdir(), 'cli-index-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const credentials = createCredentialsStore(dir);
  if (options.file !== undefined) await credentials.write(options.file);
  const sent: Request[] = [];
  let errors = '';
  let hit: ((url: URL) => void) | undefined;
  const respond = (req: Request): Response => {
    const { pathname } = new URL(req.url);
    if (pathname.endsWith('/auth/login')) {
      return Response.redirect(IDP_AUTHORIZE, 302);
    }
    if (pathname.endsWith('/auth/handoff')) {
      return Response.json({ session: NEW_SESSION });
    }
    if (pathname.endsWith('openid-configuration')) {
      return Response.json({ token_endpoint: `${ISSUER}/token` });
    }
    if (pathname === '/token') {
      return Response.json({ access_token: 'tok', expires_in: 60 });
    }
    return options.respond(req);
  };
  const env: CliEnv = {
    configDir: dir,
    projectDir: dir,
    vars: {},
    loopbackHost: '127.0.0.1',
    fetch: (input, init) => {
      const req = new Request(input, init);
      sent.push(req);
      return Promise.resolve(respond(req));
    },
    io: {
      stdout: () => undefined,
      stderr: (text) => {
        errors += text;
      },
      stdin: () => Promise.resolve(''),
      isTTY: options.tty,
    },
    prompter: noTtyPrompter(),
    open: () => {
      hit?.(new URL(`/callback?handoff=${CODE}`, 'http://127.0.0.1:1'));
    },
    listen: (onRequest) => {
      hit = onRequest;
      return Promise.resolve({ port: 1, close: () => Promise.resolve() });
    },
    spawn: () => {
      throw new Error('spawn not scripted');
    },
    readFile: () => Promise.reject(new Error('no such file')),
  };
  return {
    env,
    ctx: createContext(env),
    sent,
    stderr: () => errors,
    count: (suffix) =>
      sent.filter((req) => new URL(req.url).pathname.endsWith(suffix)).length,
    credentials,
  };
}

/** Answers `me` with each reply in turn; the last one repeats. */
function meSequence(
  ...replies: (() => Response)[]
): (req: Request) => Response {
  let at = 0;
  return () => {
    const reply = replies[Math.min(at, replies.length - 1)] ?? meReply;
    at += 1;
    return reply();
  };
}

function expired(): (cause: unknown) => boolean {
  return (cause) => cause instanceof CliFailure && cause.message === EXPIRED;
}

void test('V11a: an unauthenticated call on a TTY with a person file logs in once and retries once', async (t) => {
  const h = await setup(t, {
    file: person,
    tty: true,
    respond: meSequence(unauthenticated, meReply),
  });
  const result = await h.ctx.call('me', {});
  assert.equal(result.ok, true);
  assert.equal(h.count('/auth/login'), 1);
  assert.equal(h.count('/auth/me'), 2);
  assert.deepEqual((await h.credentials.read())?.auth, {
    kind: 'person',
    session: NEW_SESSION,
  });
});

void test('V11b: a second unauthenticated stops: one login, then run cli login', async (t) => {
  const h = await setup(t, {
    file: person,
    tty: true,
    respond: meSequence(unauthenticated),
  });
  await assert.rejects(h.ctx.call('me', {}), expired());
  assert.equal(h.count('/auth/login'), 1);
  assert.equal(h.count('/auth/me'), 2);
});

void test('V11c: a service credential never logs in', async (t) => {
  const h = await setup(t, {
    file: service,
    tty: true,
    respond: meSequence(unauthenticated),
  });
  await assert.rejects(h.ctx.call('me', {}), expired());
  assert.equal(h.count('/auth/login'), 0);
  assert.equal(h.count('/auth/me'), 1);
});

void test('V11d: no TTY never logs in', async (t) => {
  const h = await setup(t, {
    file: person,
    tty: false,
    respond: meSequence(unauthenticated),
  });
  await assert.rejects(h.ctx.call('me', {}), expired());
  assert.equal(h.count('/auth/login'), 0);
});

const STREAM_INPUT = { org: 'o', conv: 'c', msg: 'm' };

async function ids(frames: AsyncIterable<{ readonly id: string | null }>) {
  const seen: (string | null)[] = [];
  for await (const frame of frames) seen.push(frame.id);
  return seen;
}

void test('V11e: an unauthenticated first frame logs in once and retries the stream', async (t) => {
  let connects = 0;
  const h = await setup(t, {
    file: person,
    tty: true,
    respond: () => {
      connects += 1;
      return connects === 1 ? unauthenticated() : sse(delta('1'), endOfStream);
    },
  });
  const frames = await h.ctx.streamCall('message', STREAM_INPUT);
  assert.deepEqual(await ids(frames), ['1', 'end']);
  assert.equal(h.count('/auth/login'), 1);
  assert.equal(connects, 2);
});

void test('V11f: an error after a text frame does not retry and the frame comes once', async (t) => {
  let connects = 0;
  const h = await setup(t, {
    file: person,
    tty: true,
    respond: () => {
      connects += 1;
      return connects === 1 ? sse(delta('1')) : unauthenticated();
    },
  });
  const seen: (string | null)[] = [];
  const frames = await h.ctx.streamCall('message', STREAM_INPUT);
  await assert.rejects(async () => {
    for await (const frame of frames) seen.push(frame.id);
  });
  assert.deepEqual(seen, ['1']);
  assert.equal(h.count('/auth/login'), 0);
});

void test('a missing credentials file fails with run cli login', async (t) => {
  const h = await setup(t, { tty: true, respond: meSequence(meReply) });
  await assert.rejects(h.ctx.client(), expired());
  assert.equal(h.sent.length, 0);
});

void test('an unknown operation id is a usage error and sends nothing', async (t) => {
  const h = await setup(t, { file: person, tty: true, respond: meSequence() });
  await assert.rejects(h.ctx.call('nope', {}));
  assert.equal(h.count('/auth/me'), 0);
});

void test('runCli exits 2 on an unknown command and 0 on --help', async (t) => {
  const h = await setup(t, { file: person, tty: false, respond: meSequence() });
  assert.equal(await runCli(['nope'], h.env), 2);
  assert.equal(await runCli(['--help'], h.env), 0);
});

void test('runCli exits 1 and prints run cli login without a credentials file', async (t) => {
  const h = await setup(t, { tty: false, respond: meSequence() });
  assert.equal(await runCli(['whoami'], h.env), 1);
  assert.ok(h.stderr().includes(EXPIRED));
});
