import { ApplicationFailure } from '@temporalio/common';
import { ErrorCode, z } from '../../index.ts';
import type { AppError, Logger, Result } from '../../index.ts';
import { parseOrgId } from '../../db/index.ts';
import type { Db, OrgId } from '../../db/index.ts';
import { activityContext } from './index.ts';
import type { Runners } from '../index.ts';
import type { Authz } from '../../identity/index.ts';
import type { ModelAdapter } from '../../llm/index.ts';
import { loadAgentMessage } from '../../runtime/messages.ts';
import { startCommitted } from '../../runtime/start.ts';
import type { StartConfig } from '../../runtime/start.ts';
import { MessageStatus } from '../../runtime/status.ts';
import { createTurnSteps } from '../../runtime/steps.ts';
import { stepClaimGuard } from './step-claim.ts';
import type { ToolRegistry } from '../../runtime/tools.ts';
import type {
  ModelStepOutcome,
  ToolCallOutcome,
  TurnActivities,
} from '../../runtime/workflow-types.ts';

export interface RuntimeActivityDeps {
  readonly db: Db;
  readonly authz: Authz;
  readonly model: ModelAdapter;
  readonly tools: ToolRegistry;
  readonly runners: Runners;
  readonly config: StartConfig;
  readonly log: Logger;
}

export const orgId = z.string().transform((value, ctx): OrgId => {
  const parsed = parseOrgId(value);
  if (parsed.ok) return parsed.value;
  ctx.addIssue({ code: 'custom', message: 'invalid org id' });
  return z.NEVER;
});

const nonEmpty = z.string().min(1);
const orgMessage = z.strictObject({ org: orgId, agentMessageId: nonEmpty });

const ModelStepArgs = orgMessage.extend({
  stepIndex: z.number().int().min(0),
  runKey: nonEmpty,
});
const ToolCallArgs = z.strictObject({ org: orgId, actionId: nonEmpty });
const FailActionArgs = ToolCallArgs.extend({ reason: nonEmpty });
const TerminalStatusSchema = z
  .enum(MessageStatus)
  .exclude([MessageStatus.created, MessageStatus.paused]);

const FinishTurnArgs = orgMessage.extend({
  status: TerminalStatusSchema,
  reason: z.string().nullable(),
});

/** Arguments come from workflow history, not a caller. A bad shape never succeeds on retry. */
export function parseArgs<S extends z.ZodType>(
  schema: S,
  args: unknown,
): z.output<S> {
  const parsed = schema.safeParse(args);
  if (parsed.success) return parsed.data;
  throw ApplicationFailure.create({
    message: 'invalid activity arguments',
    type: ErrorCode.invalid_argument,
    nonRetryable: true,
  });
}

const RETRYABLE: readonly string[] = [ErrorCode.unavailable, ErrorCode.aborted];

/** A failed `Result` becomes a Temporal failure: retryable for `unavailable` and `aborted` only (P4.2 D5). */
function failure(error: AppError): ApplicationFailure {
  return ApplicationFailure.create({
    message: error.message,
    type: error.code,
    nonRetryable: !RETRYABLE.includes(error.code),
  });
}

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw failure(result.error);
  return result.value;
}

/**
 * D6: starts the promoted message after its close committed. A failed start
 * never fails `finishTurn`; the reaper's lost-start sweep is the fallback.
 */
async function startPromoted(
  deps: RuntimeActivityDeps,
  org: OrgId,
  agentMessageId: string,
): Promise<void> {
  const pin = await loadAgentMessage(deps.db, org, agentMessageId);
  if (!pin.ok) {
    deps.log.warn({ agentMessageId }, 'promoted message not loaded');
    return;
  }
  await startCommitted(
    deps,
    org,
    { threadId: pin.value.threadId, agentMessageId },
    pin.value.traceId,
  );
}

/**
 * The activities of the turn workflow (private). Ids and small values in and
 * out; rows stay in the store. The Temporal attempt and abort signal reach
 * P4.2 and P4.3 here.
 */
export function runtimeActivities(deps: RuntimeActivityDeps): TurnActivities {
  const steps = createTurnSteps({
    db: deps.db,
    authz: deps.authz,
    model: deps.model,
    tools: deps.tools,
    guard: stepClaimGuard,
    startPromoted: (org, agentMessageId) =>
      startPromoted(deps, org, agentMessageId),
  });
  return {
    loadTurn: async (args) =>
      unwrap(await steps.loadTurn(parseArgs(orgMessage, args))),
    modelStep: async (args): Promise<ModelStepOutcome> => {
      const { org, agentMessageId, stepIndex, runKey } = parseArgs(
        ModelStepArgs,
        args,
      );
      const { attempt, signal, logger } = activityContext();
      return unwrap(
        await steps.modelStep(
          {
            org,
            messageId: agentMessageId,
            stepIndex,
            runKey,
            attempt,
            log: logger,
          },
          signal,
        ),
      );
    },
    toolCall: async (args): Promise<ToolCallOutcome> => {
      const { org, actionId } = parseArgs(ToolCallArgs, args);
      const { attempt, signal } = activityContext();
      return unwrap(await steps.toolCall({ org, actionId, attempt }, signal));
    },
    failAction: async (args) => {
      unwrap(await steps.failAction(parseArgs(FailActionArgs, args)));
    },
    pauseTurn: async (args) => {
      unwrap(await steps.pauseTurn(parseArgs(orgMessage, args)));
    },
    finishTurn: async (args) => {
      unwrap(await steps.finishTurn(parseArgs(FinishTurnArgs, args)));
    },
  };
}
