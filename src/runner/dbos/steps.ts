import type { StepConfig } from '@dbos-inc/dbos-sdk';
import { ErrorCode, z } from '../../index.ts';
import type { AppError, Logger, Result } from '../../index.ts';
import type { OrgId } from '../../db/index.ts';
import type {
  LoadedTurn,
  ModelStepOutcome,
  ServiceLimits,
  ToolCallOutcome,
} from '../../runtime/workflow-types.ts';
import type { TerminalStatus } from '../../runtime/status.ts';
import { STORED_ATTEMPT } from '../../runtime/step-contract.ts';
import type {
  ClosedTurn,
  PausedTurn,
  TurnSteps,
} from '../../runtime/step-contract.ts';

export interface EndArgs {
  readonly status: TerminalStatus;
  readonly reason: string | null;
}

const PositiveInt = z.number().int().min(1);

/** D1: the limits a step config reads. Validated here because the workflow input carries them. */
export const ServiceLimitsSchema = z.object({
  modelCallTimeoutMs: PositiveInt,
  modelAttempts: PositiveInt,
  toolCallTimeoutMs: PositiveInt,
  storeCallTimeoutMs: PositiveInt,
  maxHistoryLength: PositiveInt.optional(),
});

/** D1: the store activities' retry policy; the only place these numbers live. */
export const StoreRetrySchema = z.object({
  maxAttempts: PositiveInt.default(5),
  intervalSeconds: PositiveInt.default(1),
  backoffRate: z.number().min(1).default(2),
});

export type StoreRetry = z.infer<typeof StoreRetrySchema>;

const STORE_RETRY: StoreRetry = StoreRetrySchema.parse({});

/** D2: the codes a step retries; every other code is final. */
const RetryableCodeSchema = z.enum([ErrorCode.unavailable, ErrorCode.aborted]);

/** A failed `Result` of a `TurnSteps` call, thrown so DBOS sees the step fail. */
export class StepFailure extends Error {
  readonly code: ErrorCode;
  /** Read by the workflow body to tell `model_refused` from `model_failed`. */
  readonly nonRetryable: boolean;

  constructor(error: AppError) {
    super(error.message, { cause: error.cause });
    this.name = 'StepFailure';
    this.code = error.code;
    this.nonRetryable = !RetryableCodeSchema.safeParse(error.code).success;
  }
}

/** D3: the stop hub aborted the step. Never retried. */
export class StopAbort extends Error {
  constructor() {
    super('stopped');
    this.name = 'StopAbort';
  }
}

/**
 * D2: `unavailable` and `aborted` retry, other codes and `StopAbort` do not.
 * Anything else (a DBOS step timeout, a thrown exception) retries, as a Temporal
 * activity does.
 */
export function shouldRetry(error: unknown): boolean {
  if (error instanceof StopAbort) return false;
  if (error instanceof StepFailure) return !error.nonRetryable;
  return true;
}

export type NamedStepConfig = StepConfig & { name: string };

/** D1: the three config shapes. `tool` still needs `maxAttempts` from the action. */
export function stepConfigs(
  limits: ServiceLimits,
  store: StoreRetry = STORE_RETRY,
): Record<'store' | 'model' | 'tool', StepConfig> {
  const parsed = ServiceLimitsSchema.parse(limits);
  return {
    store: {
      retriesAllowed: true,
      maxAttempts: store.maxAttempts,
      intervalSeconds: store.intervalSeconds,
      backoffRate: store.backoffRate,
      timeoutMS: parsed.storeCallTimeoutMs,
    },
    model: {
      retriesAllowed: true,
      maxAttempts: parsed.modelAttempts,
      intervalSeconds: store.intervalSeconds,
      backoffRate: store.backoffRate,
      timeoutMS: parsed.modelCallTimeoutMs,
      shouldRetry,
    },
    tool: {
      retriesAllowed: true,
      intervalSeconds: store.intervalSeconds,
      backoffRate: store.backoffRate,
      timeoutMS: parsed.toolCallTimeoutMs,
      shouldRetry,
    },
  };
}

/** PD1: the step names, readable in DBOS listings. */
export const stepName = {
  load: 'load',
  model: (i: number) => `model:${String(i)}`,
  tool: (actionId: string) => `tool:${actionId}`,
  check: (i: number) => `check:${String(i)}`,
  pause: (n: number) => `pause:${String(n)}`,
  finish: 'finish',
  fail: (actionId: string) => `fail:${actionId}`,
} as const;

/** The slice of `DBOS` this file touches; tests pass a double. */
export interface StepHost {
  runStep<T>(fn: () => Promise<T>, config: NamedStepConfig): Promise<T>;
  /** `DBOS.stepStatus`: the running step's signals. */
  stepSignals(): {
    readonly timeoutSignal?: AbortSignal | undefined;
    readonly cancelSignal: AbortSignal;
  };
}

/** D3: timeout ∪ cancel ∪ stop. */
function stepSignal(host: StepHost, stop: AbortSignal): AbortSignal {
  const { timeoutSignal, cancelSignal } = host.stepSignals();
  const all = [cancelSignal, stop];
  if (timeoutSignal !== undefined) all.push(timeoutSignal);
  return AbortSignal.any(all);
}

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new StepFailure(result.error);
  return result.value;
}

export interface StepRunnerDeps {
  readonly host: StepHost;
  readonly steps: TurnSteps;
  readonly limits: ServiceLimits;
  readonly org: OrgId;
  readonly agentMessageId: string;
  /** P2.3: the stop signal of this workflow. */
  readonly stopSignal: () => AbortSignal;
  readonly log: Logger;
}

export interface StepRunners {
  load(): Promise<LoadedTurn>;
  model(stepIndex: number, runKey: string): Promise<ModelStepOutcome>;
  /** `attempts` is `action.attempts`. */
  tool(actionId: string, attempts: number): Promise<ToolCallOutcome>;
  /** D7. */
  fail(actionId: string, reason: string): Promise<void>;
  /** A store-config step for a body another unit owns (`checkStop`). */
  store<T>(name: string, fn: () => Promise<T>): Promise<T>;
  pause(n: number): Promise<PausedTurn>;
  finish(end: EndArgs): Promise<ClosedTurn>;
}

/** PD1: one `runStep` wrapper per `TurnSteps` call. */
export function createStepRunners(deps: StepRunnerDeps): StepRunners {
  const { host, steps, org, agentMessageId } = deps;
  const configs = stepConfigs(deps.limits);
  const ids = { org, agentMessageId };

  const store = <T>(name: string, fn: () => Promise<T>): Promise<T> =>
    host.runStep(fn, { ...configs.store, name });

  return {
    store,
    load: () =>
      store(stepName.load, async () => unwrap(await steps.loadTurn(ids))),
    model: (stepIndex, runKey) =>
      host.runStep(
        async () => {
          // D4 / PD2: DBOS restarts its attempt count on recovery; runtime numbers it.
          const args = {
            org,
            messageId: agentMessageId,
            stepIndex,
            runKey,
            attempt: STORED_ATTEMPT,
            log: deps.log,
          };
          return unwrap(
            await steps.modelStep(args, stepSignal(host, deps.stopSignal())),
          );
        },
        { ...configs.model, name: stepName.model(stepIndex) },
      ),
    tool: (actionId, attempts) =>
      host.runStep(
        async () => {
          const args = { org, actionId, attempt: STORED_ATTEMPT };
          return unwrap(
            await steps.toolCall(args, stepSignal(host, deps.stopSignal())),
          );
        },
        {
          ...configs.tool,
          maxAttempts: attempts,
          name: stepName.tool(actionId),
        },
      ),
    fail: (actionId, reason) =>
      store(stepName.fail(actionId), async () => {
        const args = { org, actionId, reason };
        unwrap(await steps.failAction(args));
      }),
    pause: (n) =>
      store(stepName.pause(n), async () =>
        unwrap(await steps.pauseTurn({ org, agentMessageId })),
      ),
    finish: (end) =>
      store(stepName.finish, async () =>
        unwrap(await steps.finishTurn({ org, agentMessageId, ...end })),
      ),
  };
}
