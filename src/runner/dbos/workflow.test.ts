import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MessageStatus } from '../../runtime/status.ts';
import type { LoadedTurn } from '../../runtime/workflow-types.ts';
import { runTurn, type End, type TurnPorts } from './workflow.ts';

const RUN: LoadedTurn = {
  kind: 'run',
  nextStep: 0,
  pending: [],
  maxSteps: 3,
  toolCallConcurrency: 2,
  waiting: false,
};

function ports(over: Partial<TurnPorts> = {}) {
  const finished: End[] = [];
  const events: MessageStatus[] = [];
  const p: TurnPorts = {
    workflowId: 'wf1',
    loadTurn: () => Promise.resolve(RUN),
    currentStatus: () => Promise.resolve(MessageStatus.succeeded),
    checkStop: () => Promise.resolve('none'),
    modelStep: () => Promise.resolve({ runnable: [], done: true }),
    toolPool: () => Promise.resolve(false),
    pauseTurn: () => Promise.resolve({ pausedSeq: 1, expiresAtEpochMs: 9 }),
    waitForDecision: () => Promise.resolve('resume'),
    finishTurn: (end) => {
      finished.push(end);
      return Promise.resolve();
    },
    setStatus: (s) => {
      events.push(s);
      return Promise.resolve();
    },
    ...over,
  };
  return { p, finished, events };
}

void test('done step finishes succeeded and sets the event (D3, D7)', async () => {
  const { p, finished, events } = ports();
  assert.equal(await runTurn(p), MessageStatus.succeeded);
  assert.deepEqual(finished, [{ status: 'succeeded', reason: null }]);
  assert.deepEqual(events, ['succeeded']);
});

void test('already finished writes nothing', async () => {
  const { p, finished, events } = ports({
    loadTurn: () => Promise.resolve({ kind: 'finished' }),
  });
  assert.equal(await runTurn(p), MessageStatus.succeeded);
  assert.deepEqual([finished, events], [[], []]);
});

void test('V2: non-retryable model error still finishes, errored/model_refused (D4)', async () => {
  const { p, finished } = ports({
    modelStep: () =>
      Promise.reject(Object.assign(new Error('x'), { nonRetryable: true })),
  });
  assert.equal(await runTurn(p), MessageStatus.errored);
  assert.deepEqual(finished, [{ status: 'errored', reason: 'model_refused' }]);
});

void test('V2: failing non-model step is caught and finished errored', async () => {
  const { p, finished } = ports({
    checkStop: () => Promise.reject(new Error('boom')),
  });
  assert.equal(await runTurn(p), MessageStatus.errored);
  assert.equal(finished[0]?.reason, 'workflow_failed');
});

void test('model failure without flag is model_failed', async () => {
  const { p, finished } = ports({
    modelStep: () => Promise.reject(new Error('x')),
  });
  await runTurn(p);
  assert.equal(finished[0]?.reason, 'model_failed');
});

void test('stop kinds map to terminal statuses', async () => {
  for (const [stop, status] of [
    ['cancel', 'cancelled'],
    ['interrupt', 'interrupted'],
    ['graceful', 'gracefully_stopped'],
  ] as const) {
    const { p } = ports({ checkStop: () => Promise.resolve(stop) });
    assert.equal(await runTurn(p), status);
  }
});

void test('max steps', async () => {
  const { p } = ports({
    modelStep: () => Promise.resolve({ runnable: [], done: false }),
  });
  assert.equal(await runTurn(p), MessageStatus.max_steps);
});

void test('tool blocks → pause, event paused, resume loops, then succeeds', async () => {
  let blocks = 1;
  const { p, events } = ports({
    modelStep: () =>
      Promise.resolve({
        runnable: [{ actionId: 'a', attempts: 1 }],
        done: false,
      }),
    toolPool: () => Promise.resolve(blocks-- > 0),
    loadTurn: (() => {
      let n = 0;
      return () => Promise.resolve(n++ === 0 ? RUN : { ...RUN, nextStep: 3 });
    })(),
  });
  // first loop: step 0 blocks → pause → resume → reload at maxSteps → max_steps
  assert.equal(await runTurn(p), MessageStatus.max_steps);
  assert.deepEqual(events, ['paused', 'max_steps']);
});

void test('pause expiry finishes expired', async () => {
  const { p, finished } = ports({
    modelStep: () =>
      Promise.resolve({ runnable: [], done: false, waiting: true }),
    waitForDecision: () => Promise.resolve('expired'),
  });
  assert.equal(await runTurn(p), MessageStatus.expired);
  assert.equal(finished[0]?.reason, 'pause_timeout');
});

void test('pause then stop decision', async () => {
  const { p } = ports({
    modelStep: () =>
      Promise.resolve({ runnable: [], done: false, waiting: true }),
    waitForDecision: () => Promise.resolve('cancel'),
  });
  assert.equal(await runTurn(p), MessageStatus.cancelled);
});

void test('runKey is the workflow id (D6)', async () => {
  const keys: string[] = [];
  const { p } = ports({
    modelStep: (_i, k) => {
      keys.push(k);
      return Promise.resolve({ runnable: [], done: true });
    },
  });
  await runTurn(p);
  assert.deepEqual(keys, ['wf1']);
});
