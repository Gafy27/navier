import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { CliFailure } from '../../utils/failure.ts';
import { createLoopbackListener, runLogin } from './login.ts';
import type { LoginDeps } from './login.ts';
import type { Credentials, CredentialsStore } from '../../utils/credentials.ts';

const BASE = 'http://api.test';
const LOOPBACK = '127.0.0.1';
const PORT = 43124;
const CODE = 'handoff-code-value';
const SESSION = 'ses_session-value-never-printed';
const VERIFIER_BYTES = new Uint8Array(32).fill(7);
const VERIFIER = Buffer.from(VERIFIER_BYTES).toString('base64url');

/** A fake `listen`: `hit` plays a browser request to the loopback callback. */
function fakeListen() {
  let handler: ((url: URL) => void) | undefined;
  const closed = { count: 0 };
  const listen: LoginDeps['listen'] = (onRequest) => {
    handler = onRequest;
    return Promise.resolve({
      port: PORT,
      close: () => {
        closed.count += 1;
        return Promise.resolve();
      },
    });
  };
  const hit = (path: string): void => {
    handler?.(new URL(path, `http://${LOOPBACK}:${String(PORT)}`));
  };
  return { listen, hit, closed };
}

function scriptedFetch(respond: (req: Request) => Response): {
  fetch: typeof fetch;
  sent: Request[];
} {
  const sent: Request[] = [];
  const fetchFn: typeof fetch = (input, init) => {
    const req = new Request(input, init);
    sent.push(req);
    return Promise.resolve(respond(req));
  };
  return { fetch: fetchFn, sent };
}

function memoryStore(): CredentialsStore & {
  readonly saved: Credentials[];
} {
  const saved: Credentials[] = [];
  return {
    saved,
    read: () => Promise.resolve(saved.at(-1)),
    write: (credentials) => {
      saved.push(credentials);
      return Promise.resolve();
    },
    remove: () => Promise.resolve(),
  };
}

const sessionReply = () => Response.json({ session: SESSION });

const unauthenticated = () =>
  Response.json(
    { error: { type: 'unauthenticated', message: 'unauthenticated' } },
    { status: 401 },
  );

const IDP_AUTHORIZE = 'https://auth0.example/authorize?state=test-state';

function withLoginRedirect(respond: (req: Request) => Response) {
  return (req: Request): Response => {
    if (req.method === 'GET' && req.url.includes('/auth/login')) {
      return Response.redirect(IDP_AUTHORIZE, 302);
    }
    return respond(req);
  };
}

function depsFor(
  listener: ReturnType<typeof fakeListen>,
  fetchFn: typeof fetch,
  open: (url: string) => void,
  signal?: AbortSignal,
): LoginDeps {
  return {
    open,
    fetch: fetchFn,
    random: () => VERIFIER_BYTES,
    listen: listener.listen,
    ...(signal === undefined ? {} : { signal }),
  };
}

void test('a loopback callback redeems the code with the verifier behind the challenge and stores a person profile', async () => {
  const listener = fakeListen();
  const store = memoryStore();
  const { fetch, sent } = scriptedFetch(withLoginRedirect(sessionReply));
  let opened = '';
  const open = (url: string): void => {
    opened = url;
    listener.hit(`/callback?handoff=${CODE}`);
  };

  await runLogin(depsFor(listener, fetch, open), store, BASE, LOOPBACK);

  assert.equal(opened, IDP_AUTHORIZE);
  const loginGet = sent.find(
    (req) => req.method === 'GET' && req.url.includes('/auth/login'),
  );
  assert.ok(loginGet);
  const login = new URL(loginGet.url);
  assert.equal(
    login.searchParams.get('return'),
    `http://${LOOPBACK}:${String(PORT)}/callback`,
  );
  const challenge = login.searchParams.get('handoff_challenge');
  assert.equal(
    challenge,
    createHash('sha256').update(VERIFIER).digest('base64url'),
  );
  const redeem = sent.find((req) => req.method === 'POST');
  assert.ok(redeem);
  assert.equal(redeem.url, `${BASE}/api/v1/auth/handoff`);
  assert.deepEqual(await redeem.json(), { handoff: CODE, verifier: VERIFIER });
  assert.deepEqual(store.saved, [
    { baseUrl: BASE, auth: { kind: 'person', session: SESSION } },
  ]);
  assert.equal(listener.closed.count, 1);
});

void test('a wrong verifier fails with the wire type only, writes no profile, and closes the listener', async () => {
  const listener = fakeListen();
  const store = memoryStore();
  const { fetch } = scriptedFetch(withLoginRedirect(unauthenticated));
  const open = (): void => {
    listener.hit(`/callback?handoff=${CODE}`);
  };

  const failure = await runLogin(
    depsFor(listener, fetch, open),
    store,
    BASE,
    LOOPBACK,
  ).then(
    () => assert.fail('expected a failure'),
    (cause: unknown) => cause,
  );
  assert.ok(failure instanceof CliFailure);
  assert.equal(failure.message, 'login failed: unauthenticated');
  assert.equal(failure.message.includes(CODE), false);
  assert.equal(store.saved.length, 0);
  assert.equal(listener.closed.count, 1);
});

void test('a callback with no handoff code fails before any redeem, and closes the listener', async () => {
  const listener = fakeListen();
  const store = memoryStore();
  const { fetch, sent } = scriptedFetch(withLoginRedirect(sessionReply));
  const open = (): void => {
    listener.hit('/callback');
  };

  await assert.rejects(
    runLogin(depsFor(listener, fetch, open), store, BASE, LOOPBACK),
    (cause: unknown) =>
      cause instanceof CliFailure &&
      cause.message === 'login callback had no handoff code',
  );
  assert.equal(
    sent.some((req) => req.url.endsWith('/auth/handoff')),
    false,
  );
  assert.equal(store.saved.length, 0);
  assert.equal(listener.closed.count, 1);
});

void test('an abort while the browser never calls back fails promptly and closes the listener', async () => {
  const listener = fakeListen();
  const store = memoryStore();
  const { fetch } = scriptedFetch(withLoginRedirect(sessionReply));
  const controller = new AbortController();
  const open = (): void => {
    controller.abort();
  };

  await assert.rejects(
    runLogin(
      depsFor(listener, fetch, open, controller.signal),
      store,
      BASE,
      LOOPBACK,
    ),
    (cause: unknown) =>
      cause instanceof CliFailure && cause.message === 'login was cancelled',
  );
  assert.equal(store.saved.length, 0);
  assert.equal(listener.closed.count, 1);
});

void test('when the API is down, login fails with a clear message', async () => {
  const listener = fakeListen();
  const store = memoryStore();
  const fetchFn: typeof fetch = () =>
    Promise.reject(new TypeError('fetch failed'));
  await assert.rejects(
    runLogin(
      depsFor(listener, fetchFn, () => undefined),
      store,
      BASE,
      LOOPBACK,
    ),
    (cause: unknown) =>
      cause instanceof CliFailure &&
      cause.message === 'login failed: cannot reach http://api.test',
  );
  assert.equal(listener.closed.count, 1);
});

void test('--user adds login_hint on the Auth0 URL the browser opens', async () => {
  const listener = fakeListen();
  const store = memoryStore();
  const hint = 'alice@example.com';
  const { fetch } = scriptedFetch(withLoginRedirect(sessionReply));
  let opened = '';
  const open = (url: string): void => {
    opened = url;
    listener.hit(`/callback?handoff=${CODE}`);
  };

  await runLogin(depsFor(listener, fetch, open), store, BASE, LOOPBACK, hint);

  const auth = new URL(opened);
  assert.equal(auth.origin + auth.pathname, 'https://auth0.example/authorize');
  assert.equal(auth.searchParams.get('login_hint'), hint);
});

void test('the loopback listener binds the configured host, hands the URL to onRequest, and closes', async () => {
  const seen: URL[] = [];
  const listener = await createLoopbackListener(LOOPBACK)((url) => {
    seen.push(url);
  });
  const response = await fetch(
    `http://${LOOPBACK}:${String(listener.port)}/callback?handoff=${CODE}`,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'You can close this tab.');
  await listener.close();
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.searchParams.get('handoff'), CODE);
});
