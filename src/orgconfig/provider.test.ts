import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseProviderInput } from './provider.ts';

const secret = 'super-secret-base';
const allowed = ['stub'];
const httpsUrl = `https://example.test/${secret}`;
const httpUrl = `http://example.test/${secret}`;

function withEnv<T>(nodeEnv: string | undefined, body: () => T): T {
  // V8 sets NODE_ENV around the check. The signature does not carry it.
  // eslint-disable-next-line no-restricted-syntax
  const env = process.env;
  const previous = env['NODE_ENV'];
  if (nodeEnv === undefined) delete env['NODE_ENV'];
  else env['NODE_ENV'] = nodeEnv;
  try {
    return body();
  } finally {
    if (previous === undefined) delete env['NODE_ENV'];
    else env['NODE_ENV'] = previous;
  }
}

function refused(raw: unknown, field: string, env: string | undefined): void {
  const parsed = withEnv(env, () => parseProviderInput(raw, allowed));
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, 'invalid_argument');
  assert.equal(parsed.error.message, `${field}: invalid`);
  assert.equal(parsed.error.message.includes(secret), false);
}

void test('V8: adapter and baseUrl failures name the field and hide the URL', () => {
  refused(
    { provider: 'p', adapter: 'other', baseUrl: httpsUrl },
    'adapter',
    undefined,
  );
  refused({ provider: 'p', adapter: 'stub' }, 'baseUrl', undefined);
  refused(
    { provider: 'p', adapter: 'stub', baseUrl: httpUrl },
    'baseUrl',
    undefined,
  );
  refused(
    { provider: 'p', adapter: 'stub', baseUrl: httpUrl },
    'baseUrl',
    'production',
  );
  refused(
    { provider: 'p', adapter: 'stub', baseUrl: `/${secret}` },
    'baseUrl',
    undefined,
  );
  refused(
    { provider: 'p', adapter: 'stub', baseUrl: `ftp://example.test/${secret}` },
    'baseUrl',
    'test',
  );
});

void test('V8: https is accepted, and http only when NODE_ENV is test', () => {
  const https = withEnv(undefined, () =>
    parseProviderInput(
      { provider: 'p', adapter: 'stub', baseUrl: httpsUrl },
      allowed,
    ),
  );
  assert.deepEqual(https, {
    ok: true,
    value: { provider: 'p', adapter: 'stub', baseUrl: httpsUrl },
  });
  const http = withEnv('test', () =>
    parseProviderInput(
      { provider: 'q', adapter: 'stub', baseUrl: httpUrl },
      allowed,
    ),
  );
  assert.deepEqual(http, {
    ok: true,
    value: { provider: 'q', adapter: 'stub', baseUrl: httpUrl },
  });
});
