import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../../index.ts';
import { LoginConfigSchema } from './login-config.ts';

const env: Record<string, string> = {
  IDP_AUTHORIZE_URL: 'https://idp.example/authorize',
  IDP_TOKEN_URL: 'https://idp.example/token',
  IDP_CLIENT_ID: 'client-1',
  IDP_CLIENT_SECRET_FILE: '/run/secrets/idp-client',
  IDP_REDIRECT_URL: 'https://app.example/api/v1/auth/callback',
  IDP_SCOPES: 'scope-a scope-b',
  LOGIN_STATE_TTL_MS: '600000',
  LOGIN_STATE_DELETE_MAX: '100',
  LOGIN_HANDOFF_TTL_MS: '120000',
  SESSION_IDLE_MS: '86400000',
  SESSION_RECHECK_MS: '3600000',
};

const load = (over: Record<string, string | undefined>) =>
  loadConfig(LoginConfigSchema, { ...env, ...over });

void test('PD3: the eleven login variables load', () => {
  const loaded = load({});
  assert.ok(loaded.ok);
  assert.equal(loaded.value.LOGIN_STATE_TTL_MS, 600000);
  assert.equal(loaded.value.IDP_SCOPES, 'scope-a scope-b');
});

void test('PD3: each missing variable fails and is named', () => {
  for (const name of Object.keys(env)) {
    const loaded = load({ [name]: undefined });
    assert.ok(!loaded.ok, name);
    assert.ok(loaded.error.message.includes(`${name} (missing)`), name);
  }
});

void test('PD3: an http IdP URL loads only when NODE_ENV is test', () => {
  for (const name of ['IDP_TOKEN_URL', 'IDP_AUTHORIZE_URL']) {
    const http = { [name]: 'http://127.0.0.1:9999/x' };
    const loaded = load(http);
    assert.ok(!loaded.ok, name);
    assert.ok(loaded.error.message.includes(`${name} (invalid)`), name);
    assert.ok(load({ ...http, NODE_ENV: 'test' }).ok, name);
  }
});

void test('PD3: limits are positive integers', () => {
  for (const name of [
    'LOGIN_STATE_TTL_MS',
    'LOGIN_STATE_DELETE_MAX',
    'LOGIN_HANDOFF_TTL_MS',
    'SESSION_IDLE_MS',
    'SESSION_RECHECK_MS',
  ]) {
    for (const bad of ['0', '-1', '1.5', 'x']) {
      assert.equal(load({ [name]: bad }).ok, false, `${name}=${bad}`);
    }
  }
});

void test('PD3: SESSION_RECHECK_MS must stay below SESSION_IDLE_MS', () => {
  assert.ok(!load({ SESSION_RECHECK_MS: '86400000' }).ok);
  assert.ok(
    !load({ SESSION_RECHECK_MS: '86400000', SESSION_IDLE_MS: '86400000' }).ok,
  );
  assert.ok(load({ SESSION_RECHECK_MS: '3600000' }).ok);
});
