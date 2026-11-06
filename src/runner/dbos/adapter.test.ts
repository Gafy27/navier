import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OrgId } from '../../db/index.ts';
import { ok } from '../../index.ts';
import { turnWorkflowId } from '../../runtime/workflow-id.ts';
import { createDbosRunner, type DbosReader } from './adapter.ts';

const ref = { org: 'o1' as OrgId, threadId: 't1', agentMessageId: 'm1' };
const id = turnWorkflowId(ref.org, ref.threadId, ref.agentMessageId);
const writes = {
  start: () => Promise.resolve(ok(undefined)),
  wakeStop: () => Promise.resolve(ok(undefined)),
  wakeDecision: () => Promise.resolve(ok(undefined)),
};

function reader(events: unknown[], over: Partial<DbosReader> = {}) {
  const calls: string[] = [];
  const r: DbosReader = {
    isInitialized: () => true,
    getEvent: (wf, key) => {
      calls.push(`event:${wf}:${key}`);
      return Promise.resolve(events.length > 1 ? events.shift() : events[0]);
    },
    result: (wf) => {
      calls.push(`result:${wf}`);
      return Promise.resolve('succeeded');
    },
    shutdown: () => {
      calls.push('shutdown');
      return Promise.resolve();
    },
    ...over,
  };
  return { r, calls };
}

void test('V4: awaitEnd on a finished turn returns at once', async () => {
  const { r, calls } = reader(['succeeded']);
  const out = await createDbosRunner(writes, r).awaitEnd(
    ref,
    new AbortController().signal,
  );
  assert.deepEqual(out, { ok: true, value: 'succeeded' });
  assert.deepEqual(calls, [`event:${id}:status`, `result:${id}`]);
});

void test('awaitEnd keeps waiting through null, created and paused', async () => {
  const { r, calls } = reader([null, 'created', 'paused', 'errored']);
  await createDbosRunner(writes, r).awaitEnd(ref, new AbortController().signal);
  assert.equal(calls.filter((c) => c.startsWith('event')).length, 4);
});

void test('awaitEnd aborts', async () => {
  const { r } = reader([null], {
    getEvent: () => new Promise(() => undefined),
  });
  const ac = new AbortController();
  const p = createDbosRunner(writes, r).awaitEnd(ref, ac.signal);
  ac.abort();
  const out = await p;
  assert.equal(!out.ok && out.error.code, 'aborted');
});

void test('awaitEnd maps a throw to unavailable', async () => {
  const { r } = reader([], { getEvent: () => Promise.reject(new Error('db')) });
  const out = await createDbosRunner(writes, r).awaitEnd(
    ref,
    new AbortController().signal,
  );
  assert.equal(!out.ok && out.error.code, 'unavailable');
});

void test('probe follows launch; close shuts down', async () => {
  const live = reader([]);
  const runner = createDbosRunner(writes, live.r);
  assert.equal(await runner.probe().check(new AbortController().signal), true);
  await runner.close();
  assert.deepEqual(live.calls, ['shutdown']);
  const cold = reader([], { isInitialized: () => false });
  assert.equal(
    await createDbosRunner(writes, cold.r)
      .probe()
      .check(new AbortController().signal),
    false,
  );
});
