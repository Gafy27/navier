import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CoreConfigSchema,
  DatabaseConfigSchema,
  loadConfig,
} from './config.ts';

const valid = { SHUTDOWN_TIMEOUT_MS: '5000' };

function failure(env: Record<string, string | undefined>): {
  code: string;
  message: string;
} {
  const r = loadConfig(CoreConfigSchema, env);
  assert.equal(r.ok, false);
  return r.error;
}

void test('empty map and empty-string value are missing', () => {
  const expected = 'invalid configuration: SHUTDOWN_TIMEOUT_MS (missing)';
  for (const env of [{}, { SHUTDOWN_TIMEOUT_MS: '' }]) {
    const e = failure(env);
    assert.equal(e.code, 'invalid_argument');
    assert.equal(e.message, expected);
  }
});

void test('a valid map loads', () => {
  const r = loadConfig(CoreConfigSchema, valid);
  assert.equal(r.ok, true);
  assert.equal(r.value.SHUTDOWN_TIMEOUT_MS, 5000);
});

void test('names are sorted and de-duplicated with the exact format', () => {
  const e = failure({ START_GRACE_MS: 'x', LOG_LEVEL: 'loud' });
  assert.equal(
    e.message,
    'invalid configuration: LOG_LEVEL (invalid), SHUTDOWN_TIMEOUT_MS (missing), START_GRACE_MS (invalid)',
  );
});

void test('no value reaches the error, serialized or inspected', async () => {
  const { inspect } = await import('node:util');
  const secret = 'hunter2-s3cr3t';
  for (const env of [
    { SHUTDOWN_TIMEOUT_MS: secret },
    { ...valid, LOG_LEVEL: secret },
  ]) {
    const e = failure(env);
    assert.match(e.message, /\(invalid\)/);
    assert.equal('cause' in e, false);
    assert.equal(JSON.stringify(e).includes(secret), false);
    assert.equal(inspect(e, { depth: null }).includes(secret), false);
  }
});

void test('undeclared keys are projected away', () => {
  const r = loadConfig(CoreConfigSchema, {
    ...valid,
    DATABASE_PASSWORD: 'p',
    OTHER: 'o',
  });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.value).sort(), [
    'LOG_LEVEL',
    'SHUTDOWN_TIMEOUT_MS',
    'START_GRACE_MS',
  ]);
});

void test('numeric coercion edges', () => {
  const load = (v: string) =>
    loadConfig(CoreConfigSchema, { SHUTDOWN_TIMEOUT_MS: v });
  const one = load('1');
  assert.equal(one.ok, true);
  const exp = load('1e3');
  assert.equal(exp.ok && exp.value.SHUTDOWN_TIMEOUT_MS, 1000);
  for (const bad of ['0', '1.5', ' ', 'Infinity'])
    assert.equal(load(bad).ok, false, bad);
});

void test('fallbacks apply', () => {
  const r = loadConfig(CoreConfigSchema, valid);
  assert.equal(r.ok, true);
  assert.equal(r.value.LOG_LEVEL, 'info');
  assert.equal(r.value.START_GRACE_MS, 60000);
  assert.equal('MAX_HISTORY_LENGTH' in r.value, false);
});

void test('START_GRACE_MS and MAX_HISTORY_LENGTH accept 1 and reject 0', () => {
  for (const key of ['START_GRACE_MS', 'MAX_HISTORY_LENGTH']) {
    assert.equal(
      loadConfig(CoreConfigSchema, { ...valid, [key]: '1' }).ok,
      true,
      key,
    );
    assert.equal(
      loadConfig(CoreConfigSchema, { ...valid, [key]: '0' }).ok,
      false,
      key,
    );
  }
});

void test('loadConfig does not mutate env', () => {
  const env = { ...valid, EXTRA: 'x' };
  loadConfig(CoreConfigSchema, env);
  assert.deepEqual(env, { SHUTDOWN_TIMEOUT_MS: '5000', EXTRA: 'x' });
});

const url = 'postgres://u@localhost/d';

void test('the pool bound falls back to 10', () => {
  const r = loadConfig(DatabaseConfigSchema, { DATABASE_URL: url });
  assert.equal(r.ok && r.value.DATABASE_POOL_MAX, 10);
});

void test('the pool bound accepts 1 and rejects 0', () => {
  const one = loadConfig(DatabaseConfigSchema, {
    DATABASE_URL: url,
    DATABASE_POOL_MAX: '1',
  });
  assert.equal(one.ok, true);
  const zero = loadConfig(DatabaseConfigSchema, {
    DATABASE_URL: url,
    DATABASE_POOL_MAX: '0',
  });
  assert.equal(zero.ok, false);
});

void test('a missing or bad URL names the variable and not the value', () => {
  const missing = loadConfig(DatabaseConfigSchema, {});
  assert.equal(
    !missing.ok && missing.error.message.includes('DATABASE_URL'),
    true,
  );
  const bad = loadConfig(DatabaseConfigSchema, { DATABASE_URL: 'not a url' });
  assert.equal(!bad.ok && bad.error.message.includes('not a url'), false);
});
