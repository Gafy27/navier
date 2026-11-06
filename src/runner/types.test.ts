import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { ok } from '../index.ts';
import { parseOrgId } from '../db/index.ts';
import { MessageStatus } from '../runtime/index.ts';
import { StopWake } from './types.ts';
import type { TurnRef, TurnRunner } from './types.ts';

void test('TurnRunner contract: StopWake kinds and six operations', async () => {
  assert.deepEqual(Object.values(StopWake).sort(), [
    'cancel',
    'graceful',
    'interrupt',
  ]);
  const org = parseOrgId('org-a');
  assert.ok(org.ok);
  const ref: TurnRef = {
    org: org.value,
    threadId: 't1',
    agentMessageId: 'm1',
  };
  const calls: string[] = [];
  const runner: TurnRunner = {
    name: 'temporal',
    start: (_tx, r) => {
      calls.push(`start:${r.agentMessageId}`);
      return Promise.resolve(ok(undefined));
    },
    wakeStop: (_tx, _ref, kind) => {
      calls.push(`wakeStop:${kind}`);
      return Promise.resolve(ok(undefined));
    },
    wakeDecision: (_tx, _ref, key) => {
      calls.push(`wakeDecision:${key}`);
      return Promise.resolve(ok(undefined));
    },
    awaitEnd: () => Promise.resolve(ok(MessageStatus.succeeded)),
    probe: () => ({ name: 'fake', check: () => Promise.resolve(true) }),
    close: () => {
      calls.push('close');
      return Promise.resolve();
    },
  };
  const tx = {} as never;
  assert.ok((await runner.start(tx, ref)).ok);
  assert.ok((await runner.wakeStop(tx, ref, StopWake.graceful)).ok);
  assert.ok((await runner.wakeDecision(tx, ref, 'k')).ok);
  assert.deepEqual(
    await runner.awaitEnd(ref, new AbortController().signal),
    ok(MessageStatus.succeeded),
  );
  assert.equal(await runner.probe().check(new AbortController().signal), true);
  await runner.close();
  assert.deepEqual(calls, [
    'start:m1',
    'wakeStop:graceful',
    'wakeDecision:k',
    'close',
  ]);
});

void test('V1: types.ts imports no runner SDK', async () => {
  const source = await readFile(new URL('./types.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /@temporalio|@dbos-inc/);
});
