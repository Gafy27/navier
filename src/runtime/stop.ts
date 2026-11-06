import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Logger, Result } from '../index.ts';
import { withTables, withTransaction } from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import { StopWake as StopWakeKind } from '../runner/index.ts';
import type {
  Runners,
  StopWake,
  TurnRef,
  TurnRunner,
} from '../runner/index.ts';
import { requireAgentUse } from '../agents/index.ts';
import type { Authz, Caller } from '../identity/index.ts';
import { loadAgentMessage, newestMessageStatus } from './messages.ts';
import { MessageStatus } from './status.ts';
import { runtimeView } from './tables.ts';
import type { RuntimeTables } from './tables.ts';

/** The stops a caller can request. `graceful_stop` is a signal only (D5). */
export const StopKind = { cancel: 'cancel', interrupt: 'interrupt' } as const;

export type StopKind = (typeof StopKind)[keyof typeof StopKind];

/** A row in `stop_requested`; `graceful` never appears there (D8). */
export const StopRowKindSchema = z.enum([StopKind.cancel, StopKind.interrupt]);

/** D8: `graceful` writes no `stop_requested` row, so the reaper never sees it; it is the signal alone. */
export type StopRequestKind = StopKind | 'graceful';

export interface StopDeps {
  readonly db: Db;
  readonly authz: Authz;
  readonly runners: Runners;
}

type RunnerDeps = Pick<StopDeps, 'db' | 'runners'>;

/** Owner lookup and runner call in one transaction (P1.2 D2). */
export async function withTurnOwner<T>(
  deps: RunnerDeps,
  ref: TurnRef,
  run: (runner: TurnRunner, tx: Tx) => Promise<Result<T>>,
): Promise<Result<T>> {
  return withTransaction(deps.db, async (tx) => {
    const owner = await deps.runners.ownerOf(tx, ref);
    return owner.ok ? run(owner.value, tx) : owner;
  });
}

async function wake(
  deps: RunnerDeps,
  ref: TurnRef,
  kind: StopWake,
): Promise<Result<void>> {
  return withTurnOwner(deps, ref, (runner, tx) =>
    runner.wakeStop(tx, ref, kind),
  );
}

/**
 * P4.6 D4: signals `graceful_stop` to one agent message and writes no row, because
 * the reaper reads a `stop_requested` row as a user stop. A workflow that is gone
 * is `false` without a log: the terminal write promotes either way. Any other
 * failure is `false` and logs the message id only. Never throws.
 */
export async function signalGracefulStop(
  deps: Pick<StopDeps, 'db' | 'runners'>,
  log: Logger,
  org: OrgId,
  threadId: string,
  agentMessageId: string,
): Promise<boolean> {
  try {
    const woke = await wake(
      deps,
      { org, threadId, agentMessageId },
      StopWakeKind.graceful,
    );
    if (woke.ok) return true;
    if (woke.error.code !== ErrorCode.not_found) {
      log.warn({ agentMessageId }, 'graceful stop signal not sent');
    }
  } catch {
    log.warn({ agentMessageId }, 'graceful stop signal not sent');
  }
  return false;
}

/**
 * D5: the thread rule, then CheckAgentUse at the pin, records the first request, then
 * wakes the workflow in the same transaction (D1). A paused `graceful` is a no-op;
 * a paused cancel or interrupt wakes the waiting turn (D5). Never writes a terminal status. A finished message, or
 * a workflow that is gone, is `ok`: the row is there and P4.5 finalizes it.
 */
export async function requestStop(
  deps: StopDeps,
  caller: Caller,
  org: OrgId,
  agentMessageId: string,
  kind: StopRequestKind,
): Promise<Result<void>> {
  const { db, authz } = deps;
  const pin = await loadAgentMessage(db, org, agentMessageId);
  if (!pin.ok) return pin;

  const thread = await runtimeView(db)
    .selectFrom('thread')
    .select('created_by')
    .where('org_id', '=', org)
    .where('id', '=', pin.value.threadId)
    .executeTakeFirst();
  if (thread?.created_by !== caller.principal.id) {
    return err(appError(ErrorCode.not_found, 'message not found'));
  }
  const allowed = await requireAgentUse(
    authz,
    org,
    caller,
    pin.value.agentId,
    pin.value.agentVersion,
  );
  if (!allowed.ok) return allowed;

  const newest = await newestMessageStatus(db, org, agentMessageId);
  if (!newest.ok) return newest;
  const { status } = newest.value;
  if (status !== MessageStatus.created && status !== MessageStatus.paused) {
    return ok(undefined);
  }

  const ref: TurnRef = {
    org,
    threadId: pin.value.threadId,
    agentMessageId,
  };
  if (kind === 'graceful') {
    return status === MessageStatus.paused
      ? ok(undefined)
      : tolerateGone(
          await wakeSafely(() => wake(deps, ref, StopWakeKind.graceful)),
        );
  }
  // D1: the row and the runner's wake commit together; a failed wake rolls the row back.
  return tolerateGone(
    await wakeSafely(() =>
      withTransaction(db, async (tx) => {
        const q = withTables<RuntimeTables>(tx);
        await q
          .insertInto('stop_requested')
          .values({
            org_id: org,
            message_id: agentMessageId,
            kind,
            by: caller.principal.id,
          })
          .onConflict((conflict) =>
            conflict.columns(['org_id', 'message_id']).doNothing(),
          )
          .execute();
        const first = await q
          .selectFrom('stop_requested')
          .select('kind')
          .where('org_id', '=', org)
          .where('message_id', '=', agentMessageId)
          .executeTakeFirstOrThrow();
        const owner = await deps.runners.ownerOf(tx, ref);
        if (!owner.ok) {
          return owner.error.code === ErrorCode.not_found
            ? ok(undefined)
            : owner;
        }
        const woke = await owner.value.wakeStop(tx, ref, first.kind);
        return woke.ok || woke.error.code === ErrorCode.not_found
          ? ok(undefined)
          : woke;
      }),
    ),
  );
}

async function wakeSafely(
  run: () => Promise<Result<void>>,
): Promise<Result<void>> {
  try {
    return await run();
  } catch (e) {
    return err(appError(ErrorCode.unavailable, 'stop signal not sent', e));
  }
}

/** A workflow that is gone is `ok`: the row is there and the terminal write promotes (P4.5). */
function tolerateGone(woke: Result<void>): Result<void> {
  if (woke.ok || woke.error.code === ErrorCode.not_found) return ok(undefined);
  return err(
    appError(ErrorCode.unavailable, 'stop signal not sent', woke.error),
  );
}
