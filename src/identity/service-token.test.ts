import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mock, test } from 'node:test';
import { createLogger, loadConfig } from '../index.ts';
import {
  createClientCredentialsToken,
  createServiceToken,
} from './service-token.ts';
import type { ClientCredentialsConfig } from './service-token.ts';
import { AuthzConfigSchema } from './authz-config.ts';

const TOKEN_URL = 'https://issuer.example/token';
const EXPIRES_IN = 120;

function secretFile(dir: string, value: string): Promise<string> {
  const path = join(dir, value);
  return writeFile(path, `${value}\n`).then(() => path);
}

function bodyText(body: unknown): string {
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  return '';
}

async function clientConfig(
  dir: string,
  secret: string,
): Promise<ClientCredentialsConfig> {
  return {
    tokenUrl: TOKEN_URL,
    clientId: 'svc-a',
    secretFile: await secretFile(dir, secret),
    timeoutMs: 5000,
  };
}

void test('V1: two suppliers read different secret files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svc-tok-'));
  const cfgA = await clientConfig(dir, 'secret-a');
  const cfgB = await clientConfig(dir, 'secret-b');
  const bodies: string[] = [];
  const fetchMock = mock.method(
    global,
    'fetch',
    (_input: unknown, init?: RequestInit) => {
      bodies.push(bodyText(init?.body));
      return Promise.resolve(
        Response.json({ access_token: 'tok', expires_in: EXPIRES_IN }),
      );
    },
  );
  const logger = createLogger('silent');
  const tokenA = createClientCredentialsToken(cfgA, logger);
  const tokenB = createClientCredentialsToken(cfgB, logger);
  assert.ok(await tokenA());
  assert.ok(await tokenB());
  assert.equal(bodies.length, 2);
  assert.match(bodies[0] ?? '', /secret-a/);
  assert.match(bodies[1] ?? '', /secret-b/);
  fetchMock.mock.restore();
});

void test('createClientCredentialsToken caches until expiry', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svc-tok-'));
  const cfg = await clientConfig(dir, 'secret-cache');
  let calls = 0;
  const fetchMock = mock.method(global, 'fetch', () => {
    calls += 1;
    return Promise.resolve(
      Response.json({ access_token: 'tok', expires_in: EXPIRES_IN }),
    );
  });
  const get = createClientCredentialsToken(cfg, createLogger('silent'));
  assert.ok(await get());
  assert.ok(await get());
  assert.equal(calls, 1);
  fetchMock.mock.restore();
});

void test('createClientCredentialsToken returns undefined on refused token response', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svc-tok-'));
  const cfg = await clientConfig(dir, 'secret-refused');
  const fetchMock = mock.method(global, 'fetch', () =>
    Promise.resolve(new Response(null, { status: 401 })),
  );
  const get = createClientCredentialsToken(cfg, createLogger('silent'));
  assert.equal(await get(), undefined);
  fetchMock.mock.restore();
});

void test('createClientCredentialsToken returns undefined on malformed token response', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svc-tok-'));
  const cfg = await clientConfig(dir, 'secret-bad-json');
  const fetchMock = mock.method(global, 'fetch', () =>
    Promise.resolve(Response.json({ access_token: 'tok' })),
  );
  const get = createClientCredentialsToken(cfg, createLogger('silent'));
  assert.equal(await get(), undefined);
  fetchMock.mock.restore();
});

void test('createServiceToken delegates to client-credentials config', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svc-tok-'));
  const secretPath = await secretFile(dir, 'authz-secret');
  const authz = loadConfig(AuthzConfigSchema, {
    AUTHZ_API_URL: 'https://authz.example',
    AUTHZ_TIMEOUT_MS: '3000',
    AUTHZ_CHECK_MAX_ITEMS: '10',
    AUTHZ_TOKEN_URL: TOKEN_URL,
    AUTHZ_CLIENT_ID: 'authz-svc',
    AUTHZ_CLIENT_SECRET_FILE: secretPath,
  });
  assert.ok(authz.ok);
  let body = '';
  const fetchMock = mock.method(
    global,
    'fetch',
    (_input: unknown, init?: RequestInit) => {
      body = bodyText(init?.body);
      return Promise.resolve(
        Response.json({ access_token: 'svc-tok', expires_in: EXPIRES_IN }),
      );
    },
  );
  const get = createServiceToken(authz.value, createLogger('silent'));
  const tok = await get();
  assert.ok(tok);
  assert.match(body, /authz-secret/);
  assert.match(body, /authz-svc/);
  fetchMock.mock.restore();
});
