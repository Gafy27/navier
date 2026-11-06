import {
  ActivityCancellationType,
  ActivityFailure,
  ApplicationFailure,
  CancellationScope,
  continueAsNew,
  isCancellation,
  proxyActivities,
  workflowInfo,
} from '@temporalio/workflow';
import { MessageStatus } from '../../runtime/status.ts';
import type { TerminalStatus } from '../../runtime/status.ts';
import type {
  RunnableAction,
  ServiceLimits,
  TurnActivities,
  TurnWorkflowInput,
} from '../../runtime/workflow-types.ts';

/** The three stop signals, by the name each signal carries. */
export type StopSignalKind = 'cancel' | 'graceful_stop' | 'interrupt';

/** The first stop signal received, and the scope that wraps the loop (D5). */
export interface Stop {
  kind: StopSignalKind | undefined;
  readonly scope: CancellationScope;
}

export function newStop(): Stop {
  return { kind: undefined, scope: new CancellationScope() };
}

/** Records the first signal and ignores later ones. `cancel` and `interrupt` also cancel the loop. */
export function recordStop(stop: Stop, kind: StopSignalKind): void {
  if (stop.kind !== undefined) return;
  stop.kind = kind;
  if (kind !== 'graceful_stop') stop.scope.cancel();
}

interface End {
  readonly status: TerminalStatus;
  readonly reason: string | null;
}

type Store = Pick<
  TurnActivities,
  'loadTurn' | 'failAction' | 'finishTurn' | 'pauseTurn'
>;

/** The loop ended on a block: the run pauses unless a stop was recorded first (D4). */
const PAUSED = 'paused';
type LoopEnd = End | typeof PAUSED;

const STATUS_OF_STOP: Readonly<Record<StopSignalKind, TerminalStatus>> = {
  cancel: MessageStatus.cancelled,
  graceful_stop: MessageStatus.gracefully_stopped,
  interrupt: MessageStatus.interrupted,
};

function stoppedEnd(stop: Stop): End | undefined {
  return stop.kind === undefined
    ? undefined
    : { status: STATUS_OF_STOP[stop.kind], reason: null };
}

/** A model step that failed after its attempts: `model_refused` if the failure was not retryable. */
function modelFailureEnd(e: unknown): End {
  const refused =
    e instanceof ActivityFailure &&
    e.cause instanceof ApplicationFailure &&
    e.cause.nonRetryable;
  return {
    status: MessageStatus.errored,
    reason: refused ? 'model_refused' : 'model_failed',
  };
}

/** Continue-as-new is for a step boundary, and only after this run made progress. */
function historyIsFull(service: ServiceLimits, progressed: boolean): boolean {
  if (!progressed) return false;
  const info = workflowInfo();
  return (
    info.continueAsNewSuggested ||
    (service.maxHistoryLength !== undefined &&
      info.historyLength > service.maxHistoryLength)
  );
}

/**
 * D6: actions start in call order, at most `concurrency` in flight. The order
 * and the bound come from activity results, so the pool is deterministic.
 * Returns true when an action blocked: no new action starts, in-flight ones finish.
 */
async function runActions(
  input: TurnWorkflowInput,
  store: Store,
  actions: readonly RunnableAction[],
  concurrency: number,
): Promise<boolean> {
  const { org, service } = input;
  const inFlight = new Set<Promise<void>>();
  const seen: { blocked: boolean } = { blocked: false };

  async function runOne(action: RunnableAction): Promise<void> {
    const tools = proxyActivities<Pick<TurnActivities, 'toolCall'>>({
      startToCloseTimeout: service.toolCallTimeoutMs,
      retry: { maximumAttempts: action.attempts },
      cancellationType: ActivityCancellationType.TRY_CANCEL,
    });
    try {
      const outcome = await tools.toolCall({ org, actionId: action.actionId });
      if (outcome.kind === 'blocked') seen.blocked = true;
    } catch (e) {
      if (isCancellation(e)) throw e;
      await store.failAction({
        org,
        actionId: action.actionId,
        reason: 'interrupted',
      });
    }
  }

  for (const action of actions) {
    if (inFlight.size >= concurrency) await Promise.race(inFlight);
    if (seen.blocked) break;
    const running: Promise<void> = runOne(action).finally(() => {
      inFlight.delete(running);
    });
    inFlight.add(running);
  }
  await Promise.all(inFlight);
  return seen.blocked;
}

/** D4: the loop. `undefined` means the message was already finished and nothing is written. */
async function loop(
  input: TurnWorkflowInput,
  stop: Stop,
  store: Store,
): Promise<LoopEnd | undefined> {
  const { org, agentMessageId, service } = input;
  const loaded = await store.loadTurn({ org, agentMessageId });
  if (loaded.kind === 'finished') return undefined;
  const { maxSteps, toolCallConcurrency } = loaded;
  const models = proxyActivities<Pick<TurnActivities, 'modelStep'>>({
    startToCloseTimeout: service.modelCallTimeoutMs,
    retry: { maximumAttempts: service.modelAttempts },
    cancellationType: ActivityCancellationType.TRY_CANCEL,
  });
  const runKey = workflowInfo().firstExecutionRunId;

  const pendingBlocked = await runActions(
    input,
    store,
    loaded.pending,
    toolCallConcurrency,
  );
  if (pendingBlocked || loaded.waiting === true) return PAUSED;

  let stepIndex = loaded.nextStep;
  let progressed = false;
  while (stepIndex < maxSteps) {
    const stopped = stoppedEnd(stop);
    if (stopped !== undefined) return stopped;
    if (historyIsFull(service, progressed)) await continueAsNew(input);

    let step;
    try {
      step = await models.modelStep({ org, agentMessageId, stepIndex, runKey });
    } catch (e) {
      if (isCancellation(e)) throw e;
      return modelFailureEnd(e);
    }
    if (step.done) return { status: MessageStatus.succeeded, reason: null };

    if (step.waiting === true) return PAUSED;

    const toolsBlocked = await runActions(
      input,
      store,
      step.runnable,
      toolCallConcurrency,
    );
    if (toolsBlocked) return PAUSED;
    progressed = true;
    stepIndex = stepIndex + 1;
  }
  return { status: MessageStatus.max_steps, reason: null };
}

/** One turn. Every end but "already finished" runs `finishTurn` in a non-cancellable scope. */
export async function runTurn(
  input: TurnWorkflowInput,
  stop: Stop,
): Promise<void> {
  const { org, agentMessageId } = input;
  const store = proxyActivities<Store>({
    startToCloseTimeout: input.service.storeCallTimeoutMs,
  });
  let end: LoopEnd | undefined;
  try {
    end = await stop.scope.run(() => loop(input, stop, store));
  } catch (e) {
    if (!isCancellation(e)) throw e;
    end = {
      status:
        stop.kind === 'interrupt'
          ? MessageStatus.interrupted
          : MessageStatus.cancelled,
      reason: null,
    };
  }
  if (end === undefined) return;
  if (end === PAUSED) {
    const stopped = stoppedEnd(stop);
    if (stopped === undefined) {
      await CancellationScope.nonCancellable(() =>
        store.pauseTurn({ org, agentMessageId }),
      );
      return;
    }
    end = stopped;
  }
  const { status, reason } = end;
  await CancellationScope.nonCancellable(() =>
    store.finishTurn({ org, agentMessageId, status, reason }),
  );
}
