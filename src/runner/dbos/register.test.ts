import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OrgId } from '../../db/index.ts';
import { partitionKey, TURN_QUEUE } from './queue.ts';
import {
  registerTurnQueue,
  registerTurnWorkflow,
  type DbosRegistry,
} from './register.ts';

function fake(launched: boolean) {
  const calls: string[] = [];
  const dbos: DbosRegistry = {
    isInitialized: () => launched,
    registerWorkflow: (fn, config) => (calls.push(`wf:${config.name}`), fn),
    registerQueue: (name, options) => {
      calls.push(`q:${name}:${JSON.stringify(options)}`);
      return Promise.resolve();
    },
  };
  return { dbos, calls };
}

void test('partitionKey is org~thread', () => {
  assert.equal(partitionKey('o1' as OrgId, 't1'), 'o1~t1');
});

void test('registerTurnWorkflow before launch registers navier.turn', () => {
  const { dbos, calls } = fake(false);
  registerTurnWorkflow(() => Promise.resolve('completed' as never), dbos);
  assert.deepEqual(calls, ['wf:navier.turn']);
});

void test('registerTurnWorkflow after launch throws (wrong order)', () => {
  const { dbos } = fake(true);
  assert.throws(
    () =>
      registerTurnWorkflow(() => Promise.resolve('completed' as never), dbos),
    /before DBOS.launch/,
  );
});

void test('registerTurnQueue after launch registers partitioned queue', async () => {
  const { dbos, calls } = fake(true);
  await registerTurnQueue({ workerConcurrency: 4 }, dbos);
  assert.deepEqual(calls, [
    `q:${TURN_QUEUE}:{"workerConcurrency":4,"partitionConcurrency":1,"onConflict":"update_if_latest_version"}`,
  ]);
});

void test('registerTurnQueue before launch fails fast (Q2)', async () => {
  const { dbos } = fake(false);
  await assert.rejects(
    registerTurnQueue({ workerConcurrency: 1 }, dbos),
    /after DBOS.launch/,
  );
});
