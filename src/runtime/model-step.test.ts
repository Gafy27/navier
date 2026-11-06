import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { ErrorCode, ok } from '../index.ts';
import { parseOrgId } from '../db/index.ts';
import type { Db } from '../db/index.ts';
import type { Logger } from '../index.ts';
import type { ModelAdapter } from '../llm/index.ts';
import { runModelStep } from './model-step.ts';
import type { StepGuard, StepKey } from './model-step.ts';
import { STORED_ATTEMPT } from './step-contract.ts';

const parsed = parseOrgId('org-a');
assert.ok(parsed.ok);
const args = {
  org: parsed.value,
  messageId: 'm1',
  stepIndex: 0,
  runKey: 'r1',
  attempt: 2,
  log: {} as Logger,
};

/** A Db that answers every query with no rows and records the SQL it ran. */
function recordingDb(): { db: Db; sql: string[] } {
  const sql: string[] = [];
  const db: Db = new Kysely({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (k) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    log: (event) => {
      sql.push(event.query.sql);
    },
  });
  return { db, sql };
}

const model = {} as ModelAdapter;

void test('V3: a model step without a guard writes no step_claim row', async () => {
  const { db, sql } = recordingDb();
  await runModelStep({ db, model }, args);
  assert.ok(sql.length > 0, 'the step ran queries');
  assert.deepEqual(
    sql.filter((text) => text.includes('step_claim')),
    [],
  );
});

void test('a guard is asked once with the step key and the attempt', async () => {
  const { db } = recordingDb();
  const calls: { key: StepKey; attempt: number }[] = [];
  const guard: StepGuard = {
    claim: (_tx, key, attempt) => {
      calls.push({ key, attempt });
      return Promise.resolve(ok('claimed'));
    },
  };
  await runModelStep({ db, model, guard }, args);
  assert.deepEqual(calls, [
    { key: { org: args.org, messageId: 'm1', stepIndex: 0 }, attempt: 2 },
  ]);
});

void test('a taken step is aborted before the model is called', async () => {
  const { db } = recordingDb();
  const guard: StepGuard = { claim: () => Promise.resolve(ok('taken')) };
  const result = await runModelStep({ db, model, guard }, args);
  assert.ok(!result.ok);
  assert.equal(result.error.code, ErrorCode.aborted);
});

void test('V8: a stored attempt with a guard is internal, and nothing is claimed', async () => {
  const { db, sql } = recordingDb();
  let claims = 0;
  const guard: StepGuard = {
    claim: () => {
      claims += 1;
      return Promise.resolve(ok('claimed'));
    },
  };
  const result = await runModelStep(
    { db, model, guard },
    { ...args, attempt: STORED_ATTEMPT },
  );
  assert.ok(!result.ok);
  assert.equal(result.error.code, ErrorCode.internal);
  assert.equal(claims, 0);
  assert.deepEqual(sql, []);
});

void test('PD2: a stored attempt without a guard runs the step', async () => {
  const { db, sql } = recordingDb();
  await runModelStep({ db, model }, { ...args, attempt: STORED_ATTEMPT });
  assert.ok(sql.length > 0, 'the step ran queries');
});
