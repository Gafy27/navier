import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../../index.ts';
import { ApiConfigSchema } from './config.ts';

const env = {
  API_HOST: '127.0.0.1',
  API_PORT: '8080',
  API_BODY_MAX_BYTES: '1000',
  STREAM_READ_BATCH_SIZE: '100',
};

void test('PD5: the API variables load, and the verify timeout falls back', () => {
  const loaded = loadConfig(ApiConfigSchema, env);
  assert.ok(loaded.ok);
  assert.deepEqual(loaded.value, {
    API_HOST: '127.0.0.1',
    API_PORT: 8080,
    API_BODY_MAX_BYTES: 1000,
    PROVIDER_VERIFY_TIMEOUT_MS: 10_000,
    STREAM_READ_BATCH_SIZE: 100,
  });
});

void test('PD5: the stream read batch has no fallback and must be positive', () => {
  const missing = loadConfig(ApiConfigSchema, {
    ...env,
    STREAM_READ_BATCH_SIZE: undefined,
  });
  assert.ok(!missing.ok);
  assert.ok(missing.error.message.includes('STREAM_READ_BATCH_SIZE (missing)'));
  for (const bad of ['0', '-1', '1.5']) {
    const loaded = loadConfig(ApiConfigSchema, {
      ...env,
      STREAM_READ_BATCH_SIZE: bad,
    });
    assert.ok(!loaded.ok, bad);
  }
});

void test('V5: lookup max parses when set, rejects below 1, and has no fallback', () => {
  const set = loadConfig(ApiConfigSchema, {
    ...env,
    IDP_DIRECTORY_LOOKUP_MAX: '4',
  });
  assert.ok(set.ok);
  assert.equal(set.value.IDP_DIRECTORY_LOOKUP_MAX, 4);

  const unset = loadConfig(ApiConfigSchema, env);
  assert.ok(unset.ok);
  assert.equal(Object.hasOwn(unset.value, 'IDP_DIRECTORY_LOOKUP_MAX'), false);

  for (const bad of ['0', '-1', '1.5']) {
    const loaded = loadConfig(ApiConfigSchema, {
      ...env,
      IDP_DIRECTORY_LOOKUP_MAX: bad,
    });
    assert.ok(!loaded.ok, bad);
    assert.ok(
      loaded.error.message.includes('IDP_DIRECTORY_LOOKUP_MAX (invalid)'),
      bad,
    );
  }
});

void test('PD5: each missing variable fails and is named', () => {
  for (const name of Object.keys(env)) {
    const loaded = loadConfig(ApiConfigSchema, { ...env, [name]: undefined });
    assert.ok(!loaded.ok, name);
    assert.ok(loaded.error.message.includes(`${name} (missing)`), name);
  }
});
