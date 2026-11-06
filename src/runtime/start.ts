import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { CoreConfig, Logger, Result } from '../index.ts';
import { withTransaction } from '../db/index.ts';
import type { Db, OrgId } from '../db/index.ts';
import type { Runners, TurnRef } from '../runner/index.ts';
import type { TemporalConfig } from '../config.ts';
import type { Authz, Caller } from '../identity/index.ts';
import { newestMessageStatus } from './messages.ts';
import { postTurn } from './post.ts';
import type { TurnInput } from './post.ts';
import type { RuntimeConfig } from './config.ts';
import { MessageStatus } from './status.ts';
import { signalGracefulStop } from './stop.ts';
import { turnWorkflowId } from './workflow-id.ts';

export type StartConfig = CoreConfig & RuntimeConfig & TemporalConfig;

export interface StartDeps {
  readonly db: Db;
  readonly authz: Authz;
  readonly runners: Runners;
  readonly config: StartConfig;
  readonly log: Logger;
}

export interface StartedTurn {
  readonly workflowId: string;
  readonly agentMessageId: string;
  readonly traceId: string;
}

export { turnWorkflowId };

/** Moved to the Temporal runner (P1.2); re-exported for the reaper. */
export { turnStartOptions, WORKFLOW_NAME } from '../runner/index.ts';

/** What a runner reads when a turn ends: the newest status of its agent message. */
export function messageStatusReader(
  db: Db,
): (ref: TurnRef) => Promise<Result<MessageStatus>> {
  return async (ref) => {
    const newest = await newestMessageStatus(db, ref.org, ref.agentMessageId);
    return newest.ok ? ok(newest.value.status) : newest;
  };
}

export const StartRefusal = z.enum({
  already_running: 'already_running',
  message_paused: 'message_paused',
  message_finished: 'message_finished',
});

/**
 * The one start of a committed message (D2). A live run is
 * `already_exists 'already_running'`. Any other failure is logged and still
 * `ok`: the rows exist and the reaper starts the message.
 */
export async function startCommitted(
  deps: Pick<StartDeps, 'db' | 'runners' | 'log'>,
  org: OrgId,
  ids: { readonly threadId: string; readonly agentMessageId: string },
  traceId: string,
): Promise<Result<StartedTurn>> {
  const ref: TurnRef = { org, ...ids, traceId };
  try {
    const runner = deps.runners.forStart(org);
    const started = runner.ok
      ? await withTransaction(deps.db, (tx) => runner.value.start(tx, ref))
      : runner;
    if (!started.ok) {
      if (started.error.code === ErrorCode.already_exists) {
        return err(
          appError(ErrorCode.already_exists, StartRefusal.enum.already_running),
        );
      }
      deps.log.warn(
        { err: started.error.cause, agentMessageId: ids.agentMessageId },
        'turn start failed after commit',
      );
    }
  } catch (e) {
    deps.log.warn(
      { err: e, agentMessageId: ids.agentMessageId },
      'turn start failed after commit',
    );
  }
  return ok({
    workflowId: turnWorkflowId(org, ids.threadId, ids.agentMessageId),
    agentMessageId: ids.agentMessageId,
    traceId,
  });
}

export type StartResult =
  | (StartedTurn & { readonly kind: 'started' })
  | {
      readonly kind: 'pending';
      readonly userMessageId: string;
      /** The running message. */
      readonly agentMessageId: string;
      readonly signalled: boolean;
    };

/**
 * `postTurn`, then one start (D2). A start that fails for any reason but a
 * conflict still returns `ok`: the rows exist and the reaper starts the message.
 * A pending post starts no workflow: it signals `graceful_stop` to the running
 * message after the commit (P4.6 D4).
 */
export async function startTurn(
  deps: StartDeps,
  caller: Caller,
  org: OrgId,
  input: TurnInput,
): Promise<Result<StartResult>> {
  const posted = await postTurn(deps, caller, org, input);
  if (!posted.ok) return posted;
  const { threadId, agentMessageId } = input;

  if (posted.value.kind === 'pending') {
    const { userMessageId, agentMessageId: running } = posted.value;
    const signalled = await signalGracefulStop(
      deps,
      deps.log,
      org,
      threadId,
      running,
    );
    return ok({
      kind: 'pending',
      userMessageId,
      agentMessageId: running,
      signalled,
    });
  }

  const { traceId, fresh } = posted.value;
  if (!fresh) {
    const newest = await newestMessageStatus(deps.db, org, agentMessageId);
    if (!newest.ok) return newest;
    if (newest.value.status === MessageStatus.paused) {
      return err(
        appError(ErrorCode.already_exists, StartRefusal.enum.message_paused),
      );
    }
    if (newest.value.status !== MessageStatus.created) {
      return err(
        appError(ErrorCode.already_exists, StartRefusal.enum.message_finished),
      );
    }
  }
  const started = await startCommitted(
    deps,
    org,
    { threadId, agentMessageId },
    traceId,
  );
  return started.ok ? ok({ kind: 'started', ...started.value }) : started;
}
