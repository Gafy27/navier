import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../../index.ts';
import { IdpDirectoryConfigSchema } from './idp-directory-config.ts';

const env: Record<string, string> = {
  IDP_DIRECTORY_USER_URL: 'https://idp.example/users/{subject}',
  IDP_DIRECTORY_TOKEN_URL: 'https://idp.example/token',
  IDP_DIRECTORY_CLIENT_ID: 'dir-client',
  IDP_DIRECTORY_CLIENT_SECRET_FILE: '/run/secrets/idp-directory',
  IDP_DIRECTORY_TIMEOUT_MS: '3000',
};

const load = (over: Record<string, string | undefined>) =>
  loadConfig(IdpDirectoryConfigSchema, { ...env, ...over });

void test('V5: a full directory record loads, including an optional audience', () => {
  const loaded = load({ IDP_DIRECTORY_AUDIENCE: 'api://directory' });
  assert.ok(loaded.ok);
  assert.equal(loaded.value.IDP_DIRECTORY_TIMEOUT_MS, 3000);
  assert.equal(loaded.value.IDP_DIRECTORY_AUDIENCE, 'api://directory');
  assert.equal(loaded.value.IDP_DIRECTORY_USER_URL.includes('{subject}'), true);
});

void test('V5: each required directory field missing is named', () => {
  for (const name of Object.keys(env)) {
    const loaded = load({ [name]: undefined });
    assert.ok(!loaded.ok, name);
    assert.ok(loaded.error.message.includes(`${name} (missing)`), name);
  }
});

void test('V5: http directory URLs load only when NODE_ENV is test', () => {
  for (const name of ['IDP_DIRECTORY_TOKEN_URL', 'IDP_DIRECTORY_USER_URL']) {
    const http = {
      [name]:
        name === 'IDP_DIRECTORY_USER_URL'
          ? 'http://127.0.0.1:9/users/{subject}'
          : 'http://127.0.0.1:9/token',
    };
    const loaded = load(http);
    assert.ok(!loaded.ok, name);
    assert.ok(loaded.error.message.includes(`${name} (invalid)`), name);
    assert.ok(load({ ...http, NODE_ENV: 'test' }).ok, name);
  }
});

void test('V5: the user URL contains {subject} once, and timeout has no fallback', () => {
  assert.ok(!load({ IDP_DIRECTORY_USER_URL: 'https://idp.example/users' }).ok);
  assert.ok(
    !load({
      IDP_DIRECTORY_USER_URL: 'https://idp.example/users/{subject}/{subject}',
    }).ok,
  );
  for (const bad of ['0', '-1', '1.5']) {
    assert.equal(load({ IDP_DIRECTORY_TIMEOUT_MS: bad }).ok, false, bad);
  }
});
