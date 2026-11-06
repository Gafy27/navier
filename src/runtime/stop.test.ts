import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Logger, Result } from '../index.ts';
import { parseOrgId } from '../db/index.ts';
import { createRunners } from '../runner/index.ts';
import type { StopWake, TurnRef, TurnRunner } from '../runner/index.ts';
import type { Db } from '../db/index.ts';
import { signalGracefulStop } from './stop.ts';

const db = {
  startTransaction: () => ({
    execute: () =>
      Promise.resolve({
        commit: () => ({ execute: () => Promise.resolve() }),
        rollback: () => ({ execute: () => Promise.resolve() }),
      }),
  }),
} as unknown as Db;

const parsed = parseOrgId('org-a');
assert.ok(parsed.ok);
const org = parsed.value;

function fixture(wake: () => Promise<Result<void>>) {
  const woken: string[] = [];
  const warned: string[] = [];
  const runner = {
    name: 'temporal',
    wakeStop: (_tx: unknown, ref: TurnRef, kind: StopWake) => {
      woken.push(`${ref.agentMessageId}:${kind}`);
      return wake();
    },
  } as TurnRunner;
  const log = {
    warn: (_fields: unknown, message: string) => {
      warned.push(message);
    },
  } as unknown as Logger;
  return {
    woken,
    warned,
    log,
    deps: { db, runners: createRunners({ temporal: runner }) },
  };
}

void test('signalGracefulStop wakes the owner with graceful', async () => {
  const f = fixture(() => Promise.resolve(ok(undefined)));
  assert.equal(await signalGracefulStop(f.deps, f.log, org, 't1', 'm1'), true);
  assert.deepEqual(f.woken, ['m1:graceful']);
  assert.deepEqual(f.warned, []);
});

void test('a workflow that is gone is false without a log', async () => {
  const f = fixture(() =>
    Promise.resolve(err(appError(ErrorCode.not_found, 'gone'))),
  );
  assert.equal(await signalGracefulStop(f.deps, f.log, org, 't1', 'm1'), false);
  assert.deepEqual(f.warned, []);
});

void test('any other failure is false and logged, never thrown', async () => {
  const down = fixture(() =>
    Promise.resolve(err(appError(ErrorCode.unavailable, 'down'))),
  );
  assert.equal(
    await signalGracefulStop(down.deps, down.log, org, 't1', 'm1'),
    false,
  );
  assert.deepEqual(down.warned, ['graceful stop signal not sent']);
  const thrown = fixture(() => Promise.reject(new Error('boom')));
  assert.equal(
    await signalGracefulStop(thrown.deps, thrown.log, org, 't1', 'm1'),
    false,
  );
  assert.deepEqual(thrown.warned, ['graceful stop signal not sent']);
});

void test('V2: stop and decide name no Temporal type', async () => {
  for (const file of ['./stop.ts', './decide.ts']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /TemporalHandle|@temporalio/, file);
  }
});
