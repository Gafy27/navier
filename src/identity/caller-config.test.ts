import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../index.ts';
import { CallerConfigSchema } from './caller-config.ts';

const valid: Record<string, string> = {
  IDP_ISSUER: 'https://idp.example/',
  IDP_AUDIENCE: 'https://authz.example',
  IDP_JWKS_URI: 'https://idp.example/jwks.json',
  IDP_ALGORITHMS: 'RS256',
  IDP_JWKS_TIMEOUT_MS: '2000',
  IDP_CLOCK_TOLERANCE_S: '30',
  PRINCIPAL_NAMESPACE: 'corp',
  SERVICE_SUBJECT_CLAIM: 'gty=client-credentials',
};

function load(over: Record<string, string | undefined>) {
  return loadConfig(CallerConfigSchema, { ...valid, ...over });
}

void test('a valid env loads', () => {
  const r = load({});
  assert.ok(r.ok);
  assert.deepEqual(r.value.IDP_ALGORITHMS, ['RS256']);
  assert.equal(r.value.IDP_CLOCK_TOLERANCE_S, 30);
});

void test('suffix mode loads', () => {
  const r = load({
    SERVICE_SUBJECT_CLAIM: undefined,
    SERVICE_SUBJECT_SUFFIX: '@clients',
  });
  assert.ok(r.ok);
});

void test('none and HMAC algorithms are rejected', () => {
  for (const alg of ['none', 'NONE', 'HS256', 'RS256,HS512', 'RS256,', '']) {
    assert.equal(load({ IDP_ALGORITHMS: alg }).ok, false, alg);
  }
  assert.ok(load({ IDP_ALGORITHMS: 'RS256, ES256' }).ok);
});

void test('exactly one service mode', () => {
  const both = load({ SERVICE_SUBJECT_SUFFIX: '@clients' });
  assert.equal(both.ok, false);
  assert.equal(load({ SERVICE_SUBJECT_CLAIM: undefined }).ok, false, 'neither');
});

void test('tolerance and timeout bounds', () => {
  for (const [name, value, ok] of [
    ['IDP_CLOCK_TOLERANCE_S', '-1', false],
    ['IDP_CLOCK_TOLERANCE_S', '0', true],
    ['IDP_CLOCK_TOLERANCE_S', '300', true],
    ['IDP_CLOCK_TOLERANCE_S', '301', false],
    ['IDP_JWKS_TIMEOUT_MS', '0', false],
    ['IDP_JWKS_TIMEOUT_MS', '-1', false],
    ['IDP_JWKS_TIMEOUT_MS', '1', true],
  ] as const) {
    assert.equal(load({ [name]: value }).ok, ok, `${name}=${value}`);
  }
});

void test('namespace and service claim shape', () => {
  assert.equal(load({ PRINCIPAL_NAMESPACE: 'Corp' }).ok, false);
  assert.equal(load({ PRINCIPAL_NAMESPACE: '' }).ok, false);
  assert.equal(load({ SERVICE_SUBJECT_CLAIM: 'gty' }).ok, false);
});

void test('a plain http JWKS uri needs NODE_ENV=test', () => {
  const http = { IDP_JWKS_URI: 'http://127.0.0.1:1/jwks.json' };
  assert.equal(load(http).ok, false);
  assert.ok(load({ ...http, NODE_ENV: 'test' }).ok);
});

void test('the error names variables and never a value', () => {
  const r = load({ IDP_ALGORITHMS: 'HS256', IDP_ISSUER: undefined });
  assert.ok(!r.ok);
  assert.equal(
    r.error.message,
    'invalid configuration: IDP_ALGORITHMS (invalid), IDP_ISSUER (missing)',
  );
});
