import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../config.ts';
import { parseOrgId } from '../db/index.ts';
import {
  checkSystemDatabase,
  RunnerConfigSchema,
  sameDatabase,
  startOn,
} from './config.ts';

const base = { DBOS_APP_VERSION: 'v1' };
const app = 'postgres://app:pw@db.local:5432/navier';

const load = (env: Record<string, string>) => {
  const r = loadConfig(RunnerConfigSchema, { ...base, ...env });
  assert.ok(r.ok);
  return r.value;
};

const org = (raw: string) => {
  const r = parseOrgId(raw);
  assert.ok(r.ok);
  return r.value;
};

void test('defaults: dbos, no listed orgs, no system URL', () => {
  const c = load({});
  assert.equal(c.RUNNER_DEFAULT, 'dbos');
  assert.deepEqual(c.RUNNER_TEMPORAL_ORGS, []);
  assert.equal(c.DBOS_SYSTEM_DATABASE_URL, undefined);
});

void test('DBOS_APP_VERSION is required; a bad runner or org id is invalid', () => {
  const missing = loadConfig(RunnerConfigSchema, {});
  assert.ok(!missing.ok);
  assert.equal(
    missing.error.message,
    'invalid configuration: DBOS_APP_VERSION (missing)',
  );
  const bad = loadConfig(RunnerConfigSchema, {
    ...base,
    RUNNER_DEFAULT: 'x',
    RUNNER_TEMPORAL_ORGS: 'a b',
  });
  assert.ok(!bad.ok);
  assert.equal(
    bad.error.message,
    'invalid configuration: RUNNER_DEFAULT (invalid), RUNNER_TEMPORAL_ORGS (invalid)',
  );
});

void test('V2: a listed org starts on Temporal, others on the default', () => {
  const pick = startOn(load({ RUNNER_TEMPORAL_ORGS: ' org-a, ,org-b' }));
  assert.equal(pick(org('org-a')), 'temporal');
  assert.equal(pick(org('org-b')), 'temporal');
  assert.equal(pick(org('org-c')), 'dbos');
  assert.equal(
    startOn(load({ RUNNER_DEFAULT: 'temporal' }))(org('org-c')),
    'temporal',
  );
});

void test('sameDatabase compares host, port and database; user and params may differ', () => {
  assert.ok(
    sameDatabase(app, 'postgres://other@DB.local/navier?sslmode=require'),
  );
  assert.ok(!sameDatabase(app, 'postgres://app@db.local:5433/navier'));
  assert.ok(!sameDatabase(app, 'postgres://app@db2.local:5432/navier'));
  assert.ok(!sameDatabase(app, 'postgres://app@db.local:5432/dbos'));
  assert.ok(!sameDatabase(app, 'not a url'));
});

void test('V1: boot refuses a different system database and never echoes a URL', () => {
  const other = 'postgres://app:secret@db.local:5432/dbos_sys';
  const bad = checkSystemDatabase({ DBOS_SYSTEM_DATABASE_URL: other }, app);
  assert.ok(!bad.ok);
  assert.equal(bad.error.code, 'invalid_argument');
  assert.ok(!bad.error.message.includes('secret'));
  assert.ok(!bad.error.message.includes('dbos_sys'));
  for (const url of [undefined, app]) {
    assert.ok(checkSystemDatabase({ DBOS_SYSTEM_DATABASE_URL: url }, app).ok);
  }
});
