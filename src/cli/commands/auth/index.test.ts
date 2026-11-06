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
const ISSUER = 'https://issuer.example';
const OLD_SESSION = 'ses_old-never-printed';
const NEW_SESSION = 'ses_new-never-printed';
const SECRET = 'svc-secret-never-printed';
const CODE = 'handoff-code-never-printed';
const IDP_AUTHORIZE = 'https://auth0.example/authorize?state=test';

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

const secrets = [OLD_SESSION, NEW_SESSION, SECRET, CODE, 'Authorization'];

const failure = (status: number): Response =>
  Response.json(
    { error: { type: 'internal', message: `boom ${OLD_SESSION}` } },
    { status },
  );

interface Harness {
  readonly env: CliEnv;
  readonly store: ReturnType<typeof createCredentialsStore>;
  readonly sent: Request[];
  /** Everything the run printed or sent: stdout, stderr, and every URL. */
  readonly everything: () => string;
  readonly stdout: () => string;
  readonly opened: () => number;
  readonly count: (suffix: string) => number;
}

async function setup(
  t: TestContext,
  options: {
    readonly file?: Credentials;
    readonly tty?: boolean;
    readonly vars?: Record<string, string>;
    readonly prompter?: Prompter;
    readonly respond?: (req: Request) => Response | Promise<Response>;
  } = {},
): Promise<Harness> {
  const dir = await mkdtemp(join(tmpdir(), 'cli-auth-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = createCredentialsStore(dir);
  if (options.file !== undefined) await store.write(options.file);
  const sent: Request[] = [];
  let out = '';
  let err = '';
  let opens = 0;
  let hit: ((url: URL) => void) | undefined;
  const respond = (req: Request): Response | Promise<Response> => {
    const { pathname } = new URL(req.url);
    if (pathname.endsWith('/auth/login')) {
      return Response.redirect(IDP_AUTHORIZE, 302);
    }
    if (pathname.endsWith('/auth/handoff')) {
      return Response.json({ session: NEW_SESSION });
    }
    if (pathname.endsWith('/auth/logout')) return Response.json({});
    if (pathname.endsWith('/auth/me')) {
      return Response.json({ principal: 'user:ns~alice', kind: 'person' });
    }
    return Response.json({});
  };
  const loopbackHost = '127.0.0.1';
  const env: CliEnv = {
    configDir: dir,
    projectDir: dir,
    vars: options.vars ?? {},
    loopbackHost,
    fetch: (input, init) => {
      const req = new Request(input, init);
      sent.push(req);
      return Promise.resolve((options.respond ?? respond)(req));
    },
    io: {
      stdout: (text) => {
        out += text;
      },
      stderr: (text) => {
        err += text;
      },
      stdin: () => Promise.resolve(''),
      isTTY: options.tty ?? false,
    },
    prompter: options.prompter ?? noTtyPrompter(),
    open: () => {
      opens += 1;
      hit?.(new URL(`/callback?handoff=${CODE}`, `http://${loopbackHost}:1`));
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
    store,
    sent,
    everything: () =>
      `${out}\n${err}\n${sent.map((req) => req.url).join('\n')}`,
    stdout: () => out,
    opened: () => opens,
    count: (suffix) =>
      sent.filter((req) => new URL(req.url).pathname.endsWith(suffix)).length,
  };
}

/** Routes `/auth/logout` to `logout` and everything else to the default replies. */
function logoutIs(
  reply: (req: Request) => Response | Promise<Response>,
): (req: Request) => Response | Promise<Response> {
  return (req) => {
    const { pathname } = new URL(req.url);
    if (pathname.endsWith('/auth/logout')) return reply(req);
    if (pathname.endsWith('/auth/login')) {
      return Response.redirect(IDP_AUTHORIZE, 302);
    }
    if (pathname.endsWith('/auth/handoff')) {
      return Response.json({ session: NEW_SESSION });
    }
    return Response.json({});
  };
}

void test('V13a: logout removes the file when the server call succeeds', async (t) => {
  const h = await setup(t, { file: person });
  assert.equal(await runCli(['logout'], h.env), 0);
  assert.equal(await h.store.read(), undefined);
  assert.equal(h.count('/auth/logout'), 1);
});

void test('V13b: logout keeps the file and exits 1 on a server 500', async (t) => {
  const h = await setup(t, {
    file: person,
    respond: logoutIs(() => failure(500)),
  });
  assert.equal(await runCli(['logout'], h.env), 1);
  assert.deepEqual(await h.store.read(), person);
});

void test('V13c: logout keeps the file and exits 1 when the server is unreachable', async (t) => {
  const h = await setup(t, {
    file: person,
    respond: logoutIs(() => {
      throw new TypeError('fetch failed');
    }),
  });
  assert.equal(await runCli(['logout'], h.env), 1);
  assert.deepEqual(await h.store.read(), person);
});

void test('login opens the browser when the old session is already unauthenticated', async (t) => {
  const h = await setup(t, {
    file: person,
    tty: true,
    respond: logoutIs(() =>
      Response.json(
        { error: { type: 'unauthenticated', message: 'unauthenticated' } },
        { status: 401 },
      ),
    ),
  });
  assert.equal(await runCli(['login'], h.env), 0);
  assert.equal(h.opened(), 1);
  assert.equal(h.count('/auth/login'), 1);
  assert.deepEqual(await h.store.read(), {
    baseUrl: BASE,
    auth: { kind: 'person', session: NEW_SESSION },
  });
});

void test('V13d: login aborts without a browser or a write when the old logout fails', async (t) => {
  const h = await setup(t, {
    file: person,
    tty: true,
    respond: logoutIs(() => failure(500)),
  });
  assert.equal(await runCli(['login'], h.env), 1);
  assert.equal(h.opened(), 0);
  assert.equal(h.count('/auth/login'), 0);
  assert.deepEqual(await h.store.read(), person);
});

void test('V13e: login logs the old session out, then replaces the whole file', async (t) => {
  const h = await setup(t, {
    file: { ...person, org: 'desk', space: 'support' },
    tty: true,
  });
  assert.equal(await runCli(['login'], h.env), 0);
  assert.equal(h.count('/auth/logout'), 1);
  assert.deepEqual(await h.store.read(), {
    baseUrl: BASE,
    auth: { kind: 'person', session: NEW_SESSION },
  });
});

void test('V13f: login over a service file sends no logout', async (t) => {
  const h = await setup(t, { file: service, tty: true });
  assert.equal(await runCli(['login'], h.env), 0);
  assert.equal(h.count('/auth/logout'), 0);
  assert.equal((await h.store.read())?.auth.kind, 'person');
});

void test('login with no file and no --url asks for the URL, and no TTY names --url', async (t) => {
  const h = await setup(t);
  assert.equal(await runCli(['login'], h.env), 2);
  const asked = await setup(t, {
    tty: true,
    prompter: scriptedPrompter({ url: [BASE] }),
  });
  assert.equal(await runCli(['login'], asked.env), 0);
  assert.equal((await asked.store.read())?.baseUrl, BASE);
  const flagged = await setup(t, { tty: true });
  assert.equal(await runCli(['login', '--url', BASE], flagged.env), 0);
});

void test('login add-service reads the four values from the environment', async (t) => {
  const h = await setup(t, {
    vars: {
      MASTRA_AGENTS_BASE_URL: BASE,
      MASTRA_AGENTS_ISSUER: ISSUER,
      MASTRA_AGENTS_CLIENT_ID: 'svc',
      MASTRA_AGENTS_CLIENT_SECRET: SECRET,
    },
  });
  assert.equal(await runCli(['login', 'add-service'], h.env), 0);
  assert.deepEqual(await h.store.read(), service);
  assert.equal(h.everything().includes(SECRET), false);
});

void test('login add-service prompts on a TTY with the secret masked', async (t) => {
  const h = await setup(t, {
    tty: true,
    prompter: scriptedPrompter({
      url: [BASE],
      issuer: [ISSUER],
      'client-id': ['svc'],
      'client-secret': [SECRET],
    }),
  });
  assert.equal(await runCli(['login', 'add-service'], h.env), 0);
  assert.deepEqual(await h.store.read(), service);
  assert.equal(h.everything().includes(SECRET), false);
});

void test('login add-service without a TTY names the missing variable and writes nothing', async (t) => {
  const h = await setup(t, { vars: { MASTRA_AGENTS_BASE_URL: BASE } });
  assert.equal(await runCli(['login', 'add-service'], h.env), 2);
  assert.ok(h.everything().includes('MASTRA_AGENTS_ISSUER'));
  assert.equal(await h.store.read(), undefined);
});

void test('V14: whoami prints the principal and kind only', async (t) => {
  const h = await setup(t, { file: person });
  assert.equal(await runCli(['whoami'], h.env), 0);
  assert.equal(h.stdout(), 'principal: user:ns~alice\nkind: person\n');
});

void test('V14: no secret reaches any output or URL across login, add-service, logout, and whoami', async (t) => {
  const runs: Harness[] = [
    await setup(t, { file: person, tty: true }),
    await setup(t, {
      file: person,
      tty: true,
      respond: logoutIs(() => failure(500)),
    }),
    await setup(t, {
      vars: {
        MASTRA_AGENTS_BASE_URL: BASE,
        MASTRA_AGENTS_ISSUER: ISSUER,
        MASTRA_AGENTS_CLIENT_ID: 'svc',
        MASTRA_AGENTS_CLIENT_SECRET: SECRET,
      },
    }),
    await setup(t, { file: person }),
    await setup(t, { file: person, respond: logoutIs(() => failure(500)) }),
  ];
  const argv = [
    ['login'],
    ['login'],
    ['login', 'add-service'],
    ['whoami'],
    ['logout'],
  ];
  for (const [index, h] of runs.entries()) {
    await runCli(argv[index] ?? [], h.env);
    for (const secret of secrets) {
      const seen = h.everything();
      // The old session is the bearer on a request header, never a URL or output.
      assert.equal(
        seen.includes(secret),
        false,
        `${String(argv[index])}: ${secret}`,
      );
    }
  }
});
