import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  WorkflowExecutionAlreadyStartedError,
  WorkflowNotFoundError,
} from '@temporalio/client';
import { ErrorCode, ok } from '../../index.ts';
import { parseOrgId } from '../../db/index.ts';
import type { Tx } from '../../db/index.ts';
import type { TemporalHandle } from './index.ts';
import { MessageStatus } from '../../runtime/status.ts';
import { turnWorkflowId } from '../../runtime/workflow-id.ts';
import type { TurnRef } from '../types.ts';
import { createTemporalRunner, WORKFLOW_NAME } from './adapter.ts';

const parsed = parseOrgId('org-a');
assert.ok(parsed.ok);
const ref: TurnRef = {
  org: parsed.value,
  threadId: 't1',
  agentMessageId: 'm1',
  traceId: 'trace-1',
};
const workflowId = turnWorkflowId(ref.org, ref.threadId, ref.agentMessageId);
const tx = {} as Tx;
const config = {
  TEMPORAL_TASK_QUEUE: 'q',
  MODEL_CALL_TIMEOUT_MS: 1,
  MODEL_ATTEMPTS: 2,
  TOOL_CALL_TIMEOUT_MS: 3,
  STORE_CALL_TIMEOUT_MS: 4,
  START_GRACE_MS: 5,
};

interface Fake {
  startError?: Error;
  signalError?: Error;
  result: () => Promise<unknown>;
}

function build(fake: Fake) {
  const calls: string[] = [];
  const handle = {
    client: {
      workflow: {
        start: (name: string, options: { workflowId: string }) => {
          calls.push(`start:${name}:${options.workflowId}`);
          return fake.startError === undefined
            ? Promise.resolve({})
            : Promise.reject(fake.startError);
        },
        getHandle: (id: string) => ({
          signal: (name: string) => {
            calls.push(`signal:${id}:${name}`);
            return fake.signalError === undefined
              ? Promise.resolve()
              : Promise.reject(fake.signalError);
          },
          result: fake.result,
        }),
      },
    },
    close: () => Promise.resolve(),
  } as unknown as TemporalHandle;
  const runner = createTemporalRunner(handle, {
    config,
    readStatus: () => Promise.resolve(ok(MessageStatus.succeeded)),
  });
  return { runner, calls };
}

const never = () => new Promise<unknown>(() => undefined);

void test('start sends the turn workflow; a live run is already_exists', async () => {
  const f = build({ result: never });
  assert.deepEqual(await f.runner.start(tx, ref), ok(undefined));
  assert.deepEqual(f.calls, [`start:${WORKFLOW_NAME}:${workflowId}`]);

  const live = build({
    result: never,
    startError: new WorkflowExecutionAlreadyStartedError(
      'x',
      workflowId,
      WORKFLOW_NAME,
    ),
  });
  const refused = await live.runner.start(tx, ref);
  assert.ok(!refused.ok);
  assert.equal(refused.error.code, ErrorCode.already_exists);

  const down = build({ result: never, startError: new Error('down') });
  const failed = await down.runner.start(tx, ref);
  assert.ok(!failed.ok);
  assert.equal(failed.error.code, ErrorCode.unavailable);
});

void test('wakeStop signals the kind; graceful is graceful_stop; gone is not_found', async () => {
  const f = build({ result: never });
  await f.runner.wakeStop(tx, ref, 'cancel');
  await f.runner.wakeStop(tx, ref, 'interrupt');
  await f.runner.wakeStop(tx, ref, 'graceful');
  assert.deepEqual(f.calls, [
    `signal:${workflowId}:cancel`,
    `signal:${workflowId}:interrupt`,
    `signal:${workflowId}:graceful_stop`,
  ]);
  const gone = build({
    result: never,
    signalError: new WorkflowNotFoundError('x', workflowId, undefined),
  });
  const missing = await gone.runner.wakeStop(tx, ref, 'cancel');
  assert.ok(!missing.ok);
  assert.equal(missing.error.code, ErrorCode.not_found);
  const down = build({ result: never, signalError: new Error('down') });
  const failed = await down.runner.wakeStop(tx, ref, 'cancel');
  assert.ok(!failed.ok);
  assert.equal(failed.error.code, ErrorCode.unavailable);
});

void test('wakeDecision restarts; a live run is ok', async () => {
  const live = build({
    result: never,
    startError: new WorkflowExecutionAlreadyStartedError(
      'x',
      workflowId,
      WORKFLOW_NAME,
    ),
  });
  assert.deepEqual(await live.runner.wakeDecision(tx, ref, 'k'), ok(undefined));
  const down = build({ result: never, startError: new Error('down') });
  assert.ok(!(await down.runner.wakeDecision(tx, ref, 'k')).ok);
});

void test('awaitEnd reads the status when the run ends, even when it failed', async () => {
  const done = build({ result: () => Promise.resolve('done') });
  assert.deepEqual(
    await done.runner.awaitEnd(ref, new AbortController().signal),
    ok(MessageStatus.succeeded),
  );
  const failed = build({ result: () => Promise.reject(new Error('failed')) });
  assert.deepEqual(
    await failed.runner.awaitEnd(ref, new AbortController().signal),
    ok(MessageStatus.succeeded),
  );
});

void test('awaitEnd is aborted when its signal fires first', async () => {
  const f = build({ result: never });
  const abort = new AbortController();
  const pending = f.runner.awaitEnd(ref, abort.signal);
  abort.abort();
  const result = await pending;
  assert.ok(!result.ok);
  assert.equal(result.error.code, ErrorCode.aborted);
});
