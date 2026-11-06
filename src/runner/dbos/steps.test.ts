import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Result } from '../../index.ts';
import type { OrgId } from '../../db/index.ts';
import type { ServiceLimits } from '../../runtime/workflow-types.ts';
import { STORED_ATTEMPT } from '../../runtime/step-contract.ts';
import type { StepAttempt, TurnSteps } from '../../runtime/step-contract.ts';
import {
  createStepRunners,
  shouldRetry,
  StepFailure,
  stepConfigs,
  stepName,
  StopAbort,
  StoreRetrySchema,
  type NamedStepConfig,
  type StepHost,
} from './steps.ts';

const LIMITS: ServiceLimits = {
  modelCallTimeoutMs: 11,
  modelAttempts: 4,
  toolCallTimeoutMs: 22,
  storeCallTimeoutMs: 33,
};
const ORG = 'org' as OrgId;
const STORE = StoreRetrySchema.parse({});

/** A host that retries like DBOS: up to `maxAttempts`, gated by `shouldRetry`. */
function host() {
  const calls: NamedStepConfig[] = [];
  const cancel = new AbortController();
  const timeout = new AbortController();
  const h: StepHost = {
    async runStep(fn, config) {
      calls.push(config);
      const max =
        config.retriesAllowed === true ? (config.maxAttempts ?? 1) : 1;
      for (let attempt = 1; ; attempt += 1) {
        try {
          return await fn();
        } catch (e) {
          const again =
            attempt < max && (config.shouldRetry?.(e) ?? true) === true;
          if (!again) throw e;
        }
      }
    },
    stepSignals: () => ({
      timeoutSignal: timeout.signal,
      cancelSignal: cancel.signal,
    }),
  };
  return { h, calls, cancel, timeout };
}

function runners(
  over: Partial<TurnSteps>,
  h: StepHost,
  stop = new AbortController(),
) {
  const steps = {
    loadTurn: () => Promise.resolve(ok({ kind: 'finished' as const })),
    ...over,
  } as TurnSteps;
  return createStepRunners({
    host: h,
    steps,
    limits: LIMITS,
    org: ORG,
    agentMessageId: 'm1',
    stopSignal: () => stop.signal,
    log: { warn: () => undefined } as never,
  });
}

void test('D1: configs mirror the limits and the store retry policy', () => {
  const c = stepConfigs(LIMITS);
  assert.deepEqual(
    { ...c.store },
    {
      retriesAllowed: true,
      maxAttempts: STORE.maxAttempts,
      intervalSeconds: STORE.intervalSeconds,
      backoffRate: STORE.backoffRate,
      timeoutMS: 33,
    },
  );
  assert.equal(c.model.maxAttempts, 4);
  assert.equal(c.model.timeoutMS, 11);
  assert.equal(c.tool.timeoutMS, 22);
  assert.equal(c.model.shouldRetry, shouldRetry);
});

void test('D1: invalid limits are rejected, not defaulted', () => {
  assert.throws(() => stepConfigs({ ...LIMITS, modelAttempts: 0 }));
});

void test('D2: only unavailable and aborted retry', () => {
  const retry = (code: (typeof ErrorCode)[keyof typeof ErrorCode]) =>
    shouldRetry(new StepFailure(appError(code, 'x')));
  assert.equal(retry(ErrorCode.unavailable), true);
  assert.equal(retry(ErrorCode.aborted), true);
  assert.equal(retry(ErrorCode.invalid_argument), false);
  assert.equal(retry(ErrorCode.internal), false);
  assert.equal(shouldRetry(new StopAbort()), false);
  assert.equal(shouldRetry(new Error('step timeout')), true);
});

void test('V1: a model step returning invalid is not retried and is nonRetryable', async () => {
  const { h } = host();
  let calls = 0;
  const r = runners(
    {
      modelStep: () => {
        calls += 1;
        return Promise.resolve(
          err(appError(ErrorCode.invalid_argument, 'bad')) as Result<never>,
        );
      },
    },
    h,
  );
  await assert.rejects(r.model(0, 'k'), (e: unknown) => {
    assert.ok(e instanceof StepFailure);
    assert.equal(e.nonRetryable, true);
    return true;
  });
  assert.equal(calls, 1);
});

void test('V1: an unavailable model step retries up to modelAttempts', async () => {
  const { h } = host();
  let calls = 0;
  const r = runners(
    {
      modelStep: () => {
        calls += 1;
        return Promise.resolve(
          err(appError(ErrorCode.unavailable, 'down')) as Result<never>,
        );
      },
    },
    h,
  );
  await assert.rejects(r.model(0, 'k'));
  assert.equal(calls, LIMITS.modelAttempts);
});

void test('PD1: step names and tool maxAttempts come from the action', async () => {
  const { h, calls } = host();
  const r = runners(
    {
      toolCall: () => Promise.resolve(ok({ kind: 'done' as const })),
      pauseTurn: () => Promise.resolve(ok({ seconds: 1 })),
    },
    h,
  );
  await r.load();
  await r.model(2, 'k').catch(() => undefined);
  await r.tool('a1', 2);
  await r.pause(1);
  assert.deepEqual(
    calls.map((c) => c.name),
    [stepName.load, stepName.model(2), stepName.tool('a1'), stepName.pause(1)],
  );
  assert.equal(calls[2]?.maxAttempts, 2);
});

void test('D4: DBOS passes the stored attempt to tool and model steps', async () => {
  const { h } = host();
  let tool: StepAttempt = 0;
  let model: StepAttempt = 0;
  const r = runners(
    {
      toolCall: (a) => {
        tool = a.attempt;
        return Promise.resolve(ok({ kind: 'done' as const }));
      },
      modelStep: (a) => {
        model = a.attempt;
        return Promise.resolve(
          ok({ runnable: [], done: true, waiting: false }),
        );
      },
    },
    h,
  );
  await r.tool('a1', 1);
  await r.model(0, 'k');
  assert.equal(tool, STORED_ATTEMPT);
  assert.equal(model, STORED_ATTEMPT);
});

void test('D3: the signal aborts on stop, cancel and timeout', async () => {
  for (const source of ['stop', 'cancel', 'timeout'] as const) {
    const stop = new AbortController();
    const { h, cancel, timeout } = host();
    const seen: AbortSignal[] = [];
    const r = runners(
      {
        toolCall: (_a, signal) => {
          seen.push(signal);
          return Promise.resolve(ok({ kind: 'done' as const }));
        },
      },
      h,
      stop,
    );
    await r.tool('a1', 1);
    const signal = seen[0];
    assert.ok(signal);
    assert.equal(signal.aborted, false);
    ({ stop, cancel, timeout })[source].abort();
    assert.equal(signal.aborted, true, source);
  }
});

void test('a failed fail/finish result throws', async () => {
  const { h } = host();
  const r = runners(
    {
      failAction: () =>
        Promise.resolve(err(appError(ErrorCode.internal, 'x')) as Result<void>),
    },
    h,
  );
  await assert.rejects(r.fail('a1', 'interrupted'), StepFailure);
});
