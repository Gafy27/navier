import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createOidcClient } from './oidc.ts';
import type { LoginConfig } from './login-config.ts';

const dir = mkdtempSync(join(tmpdir(), 'oidc-'));
const secretFile = join(dir, 'secret');
writeFileSync(secretFile, 'the-secret\n');
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

const config: LoginConfig = {
  IDP_AUTHORIZE_URL: 'https://idp.example/authorize?tenant=t1',
  IDP_TOKEN_URL: 'https://idp.example/token',
  IDP_CLIENT_ID: 'client-1',
  IDP_CLIENT_SECRET_FILE: secretFile,
  IDP_REDIRECT_URL: 'https://app.example/api/v1/auth/callback',
  IDP_SCOPES: 'scope-a scope-b',
  LOGIN_STATE_TTL_MS: 1000,
  LOGIN_HANDOFF_TTL_MS: 1000,
  LOGIN_STATE_DELETE_MAX: 1,
  SESSION_IDLE_MS: 1000,
  SESSION_RECHECK_MS: 500,
};

void test('L1: the authorize URL carries config, state, and an S256 challenge', () => {
  const client = createOidcClient(config);
  assert.ok(client.ok);
  const url = client.value.authorizeUrl('st', 'ch');
  assert.equal(url.origin + url.pathname, 'https://idp.example/authorize');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    tenant: 't1',
    response_type: 'code',
    client_id: 'client-1',
    redirect_uri: config.IDP_REDIRECT_URL,
    scope: 'scope-a scope-b',
    state: 'st',
    code_challenge: 'ch',
    code_challenge_method: 'S256',
  });
});

void test('a missing secret file fails naming the variable, not the path', () => {
  const missing = join(dir, 'missing');
  const client = createOidcClient({
    ...config,
    IDP_CLIENT_SECRET_FILE: missing,
  });
  assert.ok(!client.ok);
  assert.match(client.error.message, /IDP_CLIENT_SECRET_FILE/);
  assert.equal(client.error.message.includes(missing), false);
});
