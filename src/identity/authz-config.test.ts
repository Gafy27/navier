import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../index.ts';
import { AuthzConfigSchema } from './authz-config.ts';

const base = {
  AUTHZ_API_URL: 'https://authz.test',
  AUTHZ_TIMEOUT_MS: '1',
  AUTHZ_CHECK_MAX_ITEMS: '10',
  AUTHZ_TOKEN_URL: 'https://idp.test/oauth/token',
  AUTHZ_CLIENT_ID: 'svc',
  AUTHZ_CLIENT_SECRET_FILE: '/run/secrets/authz',
};

void test('AUTHZ_CHECK_MAX_ITEMS has no default: unset, 0, 1.5 and abc are refused; 1 loads', () => {
  const rest: Record<string, string> = { ...base };
  delete rest['AUTHZ_CHECK_MAX_ITEMS'];
  assert.equal(loadConfig(AuthzConfigSchema, rest).ok, false);
  for (const bad of ['0', '1.5', 'abc']) {
    const r = loadConfig(AuthzConfigSchema, {
      ...base,
      AUTHZ_CHECK_MAX_ITEMS: bad,
    });
    assert.equal(r.ok, false, bad);
  }
  assert.equal(
    loadConfig(AuthzConfigSchema, { ...base, AUTHZ_CHECK_MAX_ITEMS: '1' }).ok,
    true,
  );
});

void test('AUTHZ_TIMEOUT_MS of 1 loads; 0 and -1 are rejected', () => {
  assert.equal(loadConfig(AuthzConfigSchema, base).ok, true);
  for (const bad of ['0', '-1']) {
    const r = loadConfig(AuthzConfigSchema, { ...base, AUTHZ_TIMEOUT_MS: bad });
    assert.equal(r.ok, false);
  }
});

void test('AUTHZ_TIMEOUT_MS is required', () => {
  const rest: Record<string, string> = { ...base };
  delete rest['AUTHZ_TIMEOUT_MS'];
  assert.equal(loadConfig(AuthzConfigSchema, rest).ok, false);
});

void test('a plain http url needs AUTHZ_TLS=false', () => {
  const plain = { ...base, AUTHZ_API_URL: 'http://authz.test' };
  assert.equal(loadConfig(AuthzConfigSchema, plain).ok, false);
  assert.equal(
    loadConfig(AuthzConfigSchema, { ...plain, AUTHZ_TLS: 'false' }).ok,
    true,
  );
});
