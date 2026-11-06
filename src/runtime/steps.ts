import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { withTransaction } from '../db/index.ts';
import type { Db, OrgId } from '../db/index.ts';
import { loadVersion, pauseTimeoutSeconds } from '../agents/index.ts';
import type { Authz } from '../identity/index.ts';
import type { ModelAdapter } from '../llm/index.ts';
import { closeTurn, pauseMessage } from './close.ts';
import { loadAgentMessage, newestMessageStatus } from './messages.ts';
import { readCommitted, runModelStep } from './model-step.ts';
import type { StepGuard } from './model-step.ts';
import { openPendingPlans } from './pending.ts';
import { StepContentSchema } from './prompt.ts';
import { MessageStatus } from './status.ts';
import { StopRowKindSchema, type StopKind } from './stop.ts';
import type {
  ClosedTurn,
  FinishArgs,
  LoadTurnArgs,
  PauseArgs,
  PausedTurn,
  TurnSteps,
} from './step-contract.ts';
import { runtimeView } from './tables.ts';
import { failAction, runToolCall } from './tool-call.ts';
import type { ToolRegistry } from './tools.ts';
import type { LoadedTurn } from './workflow-types.ts';

export { STORED_ATTEMPT } from './step-contract.ts';
export type {
  ClosedTurn,
  FailActionArgs,
  FinishArgs,
  LoadTurnArgs,
  ModelStepArgs,
  ModelStepResult,
  PauseArgs,
  PausedTurn,
  StepAttempt,
  ToolCallArgs,
  TurnSteps,
} from './step-contract.ts';

export interface TurnStepsDeps {
  readonly db: Db;
  readonly authz: Authz;
  readonly model: ModelAdapter;
  readonly tools: ToolRegistry;
  /**
   * D6: starts the promoted message after its close committed. The runner
   * supplies it, so this file names no runner. A failure never fails `finishTurn`.
   */
  readonly startPromoted: (org: OrgId, agentMessageId: string) => Promise<void>;
  /** D3: the runner's step guard. Only Temporal passes one. */
  readonly guard?: StepGuard;
}

async function loadTurn(
  db: Db,
  args: LoadTurnArgs,
): Promise<Result<LoadedTurn>> {
  const { org, agentMessageId } = args;
  const newest = await newestMessageStatus(db, org, agentMessageId);
  if (!newest.ok) return newest;
  if (newest.value.status !== MessageStatus.created) {
    return ok({ kind: 'finished' });
  }
  const pin = await loadAgentMessage(db, org, agentMessageId);
  if (!pin.ok) return pin;
  const version = await loadVersion(
    db,
    org,
    pin.value.agentId,
    pin.value.agentVersion,
  );
  if (!version.ok) return version;
  const { definition } = version.value;
  const last = await runtimeView(db)
    .selectFrom('step')
    .select(['step_index', 'content'])
    .where('org_id', '=', org)
    .where('message_id', '=', agentMessageId)
    .orderBy('step_index', 'desc')
    .limit(1)
    .executeTakeFirst();
  const base = {
    kind: 'run',
    maxSteps: pin.value.maxSteps ?? definition.limits.maxSteps,
    toolCallConcurrency: definition.limits.toolCallConcurrency,
  } as const;
  if (last === undefined) {
    return ok({ ...base, nextStep: 0, pending: [], waiting: false });
  }

  const content = StepContentSchema.safeParse(last.content);
  if (!content.success) {
    return err(appError(ErrorCode.internal, 'stored step is invalid'));
  }
  // A last step with no tool calls is the answer: the next run reads it back and ends `succeeded`.
  const answered = content.data.toolCalls.length === 0;
  const read = await readCommitted(db, org, agentMessageId, last.step_index);
  if (read === undefined) {
    return err(appError(ErrorCode.internal, 'stored step is missing'));
  }
  if (!read.ok) return read;
  return ok({
    ...base,
    nextStep: answered ? last.step_index : last.step_index + 1,
    pending: read.value.runnable,
    waiting: read.value.waiting,
  });
}

async function pauseTurn(db: Db, args: PauseArgs): Promise<Result<PausedTurn>> {
  const { org, agentMessageId } = args;
  const pin = await loadAgentMessage(db, org, agentMessageId);
  if (!pin.ok) return pin;
  const version = await loadVersion(
    db,
    org,
    pin.value.agentId,
    pin.value.agentVersion,
  );
  if (!version.ok) return version;
  const seconds = pauseTimeoutSeconds(
    version.value.definition.limits.pauseTimeout,
  );
  const paused = await withTransaction(db, (tx) =>
    pauseMessage(tx, org, agentMessageId, seconds),
  );
  if (!paused.ok) return paused;
  return ok({ seconds });
}

async function finishTurn(
  deps: TurnStepsDeps,
  args: FinishArgs,
): Promise<Result<ClosedTurn>> {
  const { org, agentMessageId, status, reason } = args;
  const closed = await withTransaction(deps.db, (tx) =>
    closeTurn(tx, org, agentMessageId, status, reason, MessageStatus.created),
  );
  if (!closed.ok) return closed;
  if (closed.value.promotedAgentMessageId !== undefined) {
    await deps.startPromoted(org, closed.value.promotedAgentMessageId);
  }
  return closed;
}

/** D3: the ids a boundary check reads by. */
export interface CheckStopArgs {
  readonly org: OrgId;
  readonly agentMessageId: string;
  readonly threadId: string;
}

/** D3: a stop row wins; else an open pending message of the thread is a graceful stop. */
export type StopBoundary = 'none' | StopKind | 'graceful';

async function checkStop(
  db: Db,
  args: CheckStopArgs,
): Promise<Result<StopBoundary>> {
  const { org, agentMessageId, threadId } = args;
  const view = runtimeView(db);
  const row = await view
    .selectFrom('stop_requested')
    .select('kind')
    .where('org_id', '=', org)
    .where('message_id', '=', agentMessageId)
    .executeTakeFirst();
  if (row !== undefined) return ok(StopRowKindSchema.parse(row.kind));
  const open = await openPendingPlans(view, org, threadId);
  return ok(open.length > 0 ? 'graceful' : 'none');
}

/** `checkStop` is runner-neutral (PD3) and not part of `TurnSteps`, which both runners already implement. */
export type TurnStepsWithStop = TurnSteps & {
  checkStop(args: CheckStopArgs): Promise<Result<StopBoundary>>;
};

/** Binds the step bodies to their dependencies. */
export function createTurnSteps(deps: TurnStepsDeps): TurnStepsWithStop {
  const { db, model, guard } = deps;
  return {
    checkStop: (args) => checkStop(db, args),
    loadTurn: (args) => loadTurn(db, args),
    modelStep: (args, signal) =>
      runModelStep(
        { db, model, ...(guard === undefined ? {} : { guard }) },
        { ...args, signal },
      ),
    toolCall: (args, signal) => runToolCall(deps, { ...args, signal }),
    failAction: async (args) => {
      await failAction(db, args.org, args.actionId, args.reason);
      return ok(undefined);
    },
    pauseTurn: (args) => pauseTurn(db, args),
    finishTurn: (args) => finishTurn(deps, args),
  };
}
