import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Logger, Result } from '../index.ts';
import { parseOrgId } from '../db/index.ts';
import type { Db } from '../db/index.ts';
import { createRunners } from '../runner/index.ts';
import type { TurnRef, TurnRunner } from '../runner/index.ts';
import { startCommitted, StartRefusal, turnWorkflowId } from './start.ts';

const parsed = parseOrgId('org-a');
assert.ok(parsed.ok);
const org = parsed.value;
const ids = { threadId: 't1', agentMessageId: 'm1' };

const db = {
  startTransaction: () => ({
    execute: () =>
      Promise.resolve({
        commit: () => ({ execute: () => Promise.resolve() }),
        rollback: () => ({ execute: () => Promise.resolve() }),
      }),
  }),
} as unknown as Db;

function fixture(start: (ref: TurnRef) => Promise<Result<void>>) {
  const started: TurnRef[] = [];
  const warned: string[] = [];
  const runner = {
    name: 'temporal',
    start: (_tx, ref) => {
      started.push(ref);
      return start(ref);
    },
  } as TurnRunner;
  const log = {
    warn: (_fields: unknown, message: string) => {
      warned.push(message);
    },
  } as unknown as Logger;
  return {
    started,
    warned,
    deps: { db, log, runners: createRunners({ temporal: runner }) },
  };
}

void test('V1: startCommitted starts through the org runner with ids and trace', async () => {
  const f = fixture(() => Promise.resolve(ok(undefined)));
  const result = await startCommitted(f.deps, org, ids, 'trace-1');
  assert.deepEqual(result, {
    ok: true,
    value: {
      workflowId: turnWorkflowId(org, 't1', 'm1'),
      agentMessageId: 'm1',
      traceId: 'trace-1',
    },
  });
  assert.deepEqual(f.started, [{ org, ...ids, traceId: 'trace-1' }]);
  assert.deepEqual(f.warned, []);
});

void test('a live run is already_exists already_running', async () => {
  const f = fixture(() =>
    Promise.resolve(err(appError(ErrorCode.already_exists, 'x'))),
  );
  const result = await startCommitted(f.deps, org, ids, 't');
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: ErrorCode.already_exists,
      message: StartRefusal.enum.already_running,
    },
  });
});

void test('any other start failure is logged and still ok', async () => {
  const unavailable = fixture(() =>
    Promise.resolve(err(appError(ErrorCode.unavailable, 'down'))),
  );
  assert.ok((await startCommitted(unavailable.deps, org, ids, 't')).ok);
  assert.deepEqual(unavailable.warned, ['turn start failed after commit']);

  const thrown = fixture(() => Promise.reject(new Error('boom')));
  assert.ok((await startCommitted(thrown.deps, org, ids, 't')).ok);
  assert.deepEqual(thrown.warned, ['turn start failed after commit']);
});

void test('a runner that is not configured is logged and still ok', async () => {
  const warned: string[] = [];
  const result = await startCommitted(
    {
      db,
      log: {
        warn: (_f: unknown, m: string) => warned.push(m),
      } as unknown as Logger,
      runners: createRunners({}),
    },
    org,
    ids,
    't',
  );
  assert.ok(result.ok);
  assert.deepEqual(warned, ['turn start failed after commit']);
});
