import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CliFailure } from '../../utils/failure.ts';
import { createServiceTokens } from './service-token.ts';
import type { ServiceAuth } from './service-token.ts';

const SECRET = 'secret-value-never-printed';
const ISSUER = 'https://issuer.example';
const LOOPBACK = '127.0.0.1';
const WELL_KNOWN = '/.well-known/openid-configuration';
const TOKEN_URL = `${ISSUER}/token`;
const EXPIRES_IN = 60;

const service: ServiceAuth = {
  kind: 'service',
  issuer: ISSUER,
  clientId: 'svc',
  clientSecret: SECRET,
};

interface Sent {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

/** A scripted fetch that records every request and answers from `respond`. */
function scripted(respond: (url: string) => Response): {
  fetchFn: typeof fetch;
  sent: Sent[];
} {
  const sent: Sent[] = [];
  const fetchFn: typeof fetch = (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    sent.push({ url, init });
    return Promise.resolve(respond(url));
  };
  return { fetchFn, sent };
}

/** Discovery points the token endpoint at the same origin; the token is `token`. */
function idp(expiresIn: number | undefined, token = 'tok-1') {
  return (url: string): Response => {
    if (url.endsWith(WELL_KNOWN)) {
      return Response.json({
        token_endpoint: url.replace(WELL_KNOWN, '/token'),
      });
    }
    return Response.json(
      expiresIn === undefined
        ? { access_token: token }
        : { access_token: token, expires_in: expiresIn },
    );
  };
}

async function failureOf(run: () => Promise<unknown>): Promise<CliFailure> {
  try {
    await run();
  } catch (cause) {
    assert.ok(cause instanceof CliFailure, String(cause));
    return cause;
  }
  assert.fail('expected a CliFailure');
}

function tokenCalls(sent: readonly Sent[]): Sent[] {
  return sent.filter((call) => call.url === TOKEN_URL);
}

function discoveryCalls(sent: readonly Sent[]): Sent[] {
  return sent.filter((call) => call.url.endsWith(WELL_KNOWN));
}

void test('V14(a,b): one discovery and one token fetch inside expires_in, a second token fetch after it', async () => {
  let clock = 0;
  const { fetchFn, sent } = scripted(idp(EXPIRES_IN));
  const tokens = createServiceTokens(fetchFn, () => clock, LOOPBACK);

  assert.equal(await tokens.get(service), 'tok-1');
  clock = (EXPIRES_IN - 1) * 1000;
  assert.equal(await tokens.get(service), 'tok-1');
  assert.equal(discoveryCalls(sent).length, 1);
  assert.equal(tokenCalls(sent).length, 1);

  clock = EXPIRES_IN * 1000;
  assert.equal(await tokens.get(service), 'tok-1');
  assert.equal(tokenCalls(sent).length, 2);
});

void test('V14(c): an http issuer on a public host is refused before any request', async () => {
  const { fetchFn, sent } = scripted(idp(EXPIRES_IN));
  const tokens = createServiceTokens(fetchFn, () => 0, LOOPBACK);
  const failure = await failureOf(() =>
    tokens.get({ ...service, issuer: 'http://issuer.example' }),
  );
  assert.equal(failure.message, 'issuer must be https or a loopback host');
  assert.equal(sent.length, 0);
});

void test('V14(d): loopback http issuers are accepted', async () => {
  for (const issuer of [
    `http://${LOOPBACK}:9`,
    'http://localhost:9',
    'http://[::1]:9',
  ]) {
    const { fetchFn } = scripted(idp(EXPIRES_IN));
    const tokens = createServiceTokens(fetchFn, () => 0, LOOPBACK);
    assert.equal(await tokens.get({ ...service, issuer }), 'tok-1', issuer);
  }
});

void test('V14(e): a discovery 500 fails with the status only, never the body', async () => {
  const { fetchFn } = scripted(
    () => new Response(`upstream said ${SECRET}`, { status: 500 }),
  );
  const tokens = createServiceTokens(fetchFn, () => 0, LOOPBACK);
  const failure = await failureOf(() => tokens.get(service));
  assert.equal(failure.message, 'issuer discovery failed: HTTP 500');
  assert.equal(failure.message.includes(SECRET), false);
});

void test('V14(f): a token 401 fails with the status only, never the body', async () => {
  const { fetchFn } = scripted((url) =>
    url.endsWith(WELL_KNOWN)
      ? Response.json({ token_endpoint: TOKEN_URL })
      : new Response(
          JSON.stringify({ error: 'invalid_client', detail: SECRET }),
          {
            status: 401,
          },
        ),
  );
  const tokens = createServiceTokens(fetchFn, () => 0, LOOPBACK);
  const failure = await failureOf(() => tokens.get(service));
  assert.equal(failure.message, 'token request failed: HTTP 401');
  assert.equal(failure.message.includes(SECRET), false);
});

void test('V14(g): concurrent first calls make one token fetch', async () => {
  const { fetchFn, sent } = scripted(idp(EXPIRES_IN));
  const tokens = createServiceTokens(fetchFn, () => 0, LOOPBACK);
  const results = await Promise.all([
    tokens.get(service),
    tokens.get(service),
    tokens.get(service),
  ]);
  assert.deepEqual(results, ['tok-1', 'tok-1', 'tok-1']);
  assert.equal(tokenCalls(sent).length, 1);
});

void test('V14: the token request uses Basic base64(id:secret) and keeps the secret out of the body', async () => {
  const { fetchFn, sent } = scripted(idp(EXPIRES_IN));
  const tokens = createServiceTokens(fetchFn, () => 0, LOOPBACK);
  await tokens.get(service);
  const [call] = tokenCalls(sent);
  assert.ok(call);
  const headers = new Headers(call.init?.headers);
  assert.equal(
    headers.get('authorization'),
    `Basic ${Buffer.from(`svc:${SECRET}`).toString('base64')}`,
  );
  const body = call.init?.body;
  assert.ok(body instanceof URLSearchParams);
  assert.equal(body.toString(), 'grant_type=client_credentials');
});

void test('V14: a token response with no expires_in is refused', async () => {
  const { fetchFn } = scripted(idp(undefined));
  const tokens = createServiceTokens(fetchFn, () => 0, LOOPBACK);
  const failure = await failureOf(() => tokens.get(service));
  assert.equal(failure.message, 'token response has a bad shape');
});

void test('V14: a network failure names no cause', async () => {
  const failing: typeof fetch = () => Promise.reject(new Error(SECRET));
  const tokens = createServiceTokens(failing, () => 0, LOOPBACK);
  const failure = await failureOf(() => tokens.get(service));
  assert.equal(failure.message, 'issuer discovery unreachable');
  assert.equal(failure.message.includes(SECRET), false);
});
