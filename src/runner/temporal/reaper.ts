import {
  WorkflowExecutionAlreadyStartedError,
  WorkflowNotFoundError,
} from '@temporalio/client';
import { sql } from 'kysely';
import { appendIfNewest, withTables, withTransaction } from '../../db/index.ts';
import type { Db, OrgId, Tx } from '../../db/index.ts';
import { ErrorCode, ok, z } from '../../index.ts';
import type { Logger, Result } from '../../index.ts';
import { withTraceId } from './index.ts';
import type { TemporalHandle } from './index.ts';
import { loadVersion } from '../../agents/index.ts';
import { orgId, parseArgs } from './activities.ts';
import { closeTurn, EndReason } from '../../runtime/close.ts';
import type { ClosedTurn } from '../../runtime/close.ts';
import { loadAgentMessage } from '../../runtime/messages.ts';
import { MessageRole } from '../../runtime/pins.ts';
import type { AgentMessagePin } from '../../runtime/messages.ts';
import {
  turnStartOptions,
  turnWorkflowId,
  WORKFLOW_NAME,
} from '../../runtime/start.ts';
import type { StartConfig } from '../../runtime/start.ts';
import { StopKind } from '../../runtime/stop.ts';
import { MessageStatus, RecoveryOutcome } from '../../runtime/status.ts';
import type { TerminalStatus } from '../../runtime/status.ts';
import { runtimeView } from '../../runtime/tables.ts';
import type { RuntimeTables } from '../../runtime/tables.ts';
import type { ReaperActivities } from '../../runtime/workflow-types.ts';

export interface ReaperDeps {
  readonly db: Db;
  readonly temporal: TemporalHandle;
  readonly config: StartConfig;
  readonly log: Logger;
}

const STATUS_OF_REQUEST: Readonly<Record<StopKind, TerminalStatus>> = {
  [StopKind.cancel]: MessageStatus.cancelled,
  [StopKind.interrupt]: MessageStatus.interrupted,
};

const NOTHING_PROMOTED: ClosedTurn = { promotedAgentMessageId: undefined };

const SweepArgs = z.strictObject({
  storeCallTimeoutMs: z.number().int().min(1),
});

const StaleTurnRow = z
  .object({
    org_id: orgId,
    id: z.string().min(1),
    thread_id: z.string().min(1),
    created_at: z.string().min(1),
  })
  .transform((row) => ({
    org: row.org_id,
    agentMessageId: row.id,
    threadId: row.thread_id,
    createdAt: row.created_at,
  }));

/** One candidate. `createdAt` keeps the database's microseconds, so it is a text cursor. */
export type StaleTurn = z.output<typeof StaleTurnRow>;

/**
 * D2, one of two reads that take no org: agent messages whose newest status is
 * `created` and whose newest `created` row (D1) is older than `olderThan`,
 * oldest first, after `after`. A first start and a resume are the same case.
 * Private to the reaper; every write after it goes through an org-scoped function.
 */
async function listStaleTurns(
  db: Db,
  olderThan: Date,
  after: StaleTurn | undefined,
  limit: number,
): Promise<StaleTurn[]> {
  const past =
    after === undefined
      ? sql``
      : sql`and (s.at, m.org_id, m.id) >
          (${after.createdAt}::timestamptz, ${after.org}, ${after.agentMessageId})`;
  const rows = await sql`
    select m.org_id, m.id, m.thread_id, s.at::text as created_at
    from message m
    join message_status s on s.org_id = m.org_id and s.message_id = m.id
    where m.role = ${MessageRole.enum.agent}
      and s.status = ${MessageStatus.created}
      and not exists (
        select 1 from message_status newer
        where newer.org_id = s.org_id and newer.message_id = s.message_id
          and newer.seq > s.seq
      )
      and s.at < ${olderThan.toISOString()}::timestamptz
      ${past}
    order by s.at, m.org_id, m.id
    limit ${limit}`.execute(db);
  return z.array(StaleTurnRow).parse(rows.rows);
}

type Plan =
  | { readonly outcome: typeof RecoveryOutcome.restarted }
  | {
      readonly outcome:
        typeof RecoveryOutcome.stopped | typeof RecoveryOutcome.gave_up;
      readonly status: TerminalStatus;
      readonly reason: string;
    };

/** D3 steps 3 to 5: a stop request wins, then the version's `maxRecoveries`, else restart. */
async function decide(
  db: Db,
  turn: StaleTurn,
  pin: AgentMessagePin,
  attempt: number,
): Promise<Plan> {
  const { org, agentMessageId } = turn;
  const stop = await runtimeView(db)
    .selectFrom('stop_requested')
    .select('kind')
    .where('org_id', '=', org)
    .where('message_id', '=', agentMessageId)
    .executeTakeFirst();
  if (stop !== undefined) {
    return {
      outcome: RecoveryOutcome.stopped,
      status: STATUS_OF_REQUEST[stop.kind],
      reason: EndReason.enum.stop_requested,
    };
  }
  const version = await loadVersion(db, org, pin.agentId, pin.agentVersion);
  if (!version.ok) throw new Error(version.error.message);
  if (attempt > version.value.definition.limits.maxRecoveries) {
    return {
      outcome: RecoveryOutcome.gave_up,
      status: MessageStatus.errored,
      reason: EndReason.enum.recoveries_exhausted,
    };
  }
  return { outcome: RecoveryOutcome.restarted };
}

async function newestAttempt(
  db: Db,
  org: OrgId,
  agentMessageId: string,
): Promise<number | undefined> {
  const row = await runtimeView(db)
    .selectFrom('recovery')
    .select('seq')
    .where('org_id', '=', org)
    .where('message_id', '=', agentMessageId)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
  return row?.seq;
}

const OpenExecution = z.enum({
  RUNNING: 'RUNNING',
});

/** D3 step 1: only a running execution is open. Not found is closed. */
async function hasOpenExecution(
  temporal: TemporalHandle,
  workflowId: string,
): Promise<boolean> {
  try {
    const described = await temporal.client.workflow
      .getHandle(workflowId)
      .describe();
    return described.status.name === OpenExecution.enum.RUNNING;
  } catch (e) {
    if (e instanceof WorkflowNotFoundError) return false;
    throw e;
  }
}

function setStatementTimeout(tx: Tx, storeCallTimeoutMs: number) {
  return sql`select set_config('statement_timeout', ${String(storeCallTimeoutMs)}, true)`.execute(
    tx,
  );
}

function inSweepTx(
  db: Db,
  storeCallTimeoutMs: number,
  body: (tx: Tx) => Promise<Result<ClosedTurn>>,
): Promise<Result<ClosedTurn>> {
  return withTransaction(db, async (tx) => {
    await setStatementTimeout(tx, storeCallTimeoutMs);
    return body(tx);
  });
}

/** D3 step 2 with the writes of steps 3 and 4 in the same `Tx`. `aborted` means another sweep claimed it. */
function claim(
  db: Db,
  turn: StaleTurn,
  newest: number | undefined,
  plan: Plan,
  storeCallTimeoutMs: number,
): Promise<Result<ClosedTurn>> {
  const { org, agentMessageId } = turn;
  return inSweepTx(db, storeCallTimeoutMs, async (tx) => {
    const claimed = await appendIfNewest<RuntimeTables, 'recovery'>(
      withTables<RuntimeTables>(tx),
      {
        table: 'recovery',
        org,
        key: { message_id: agentMessageId },
        accept: (row) => row?.seq === newest,
        row: () => ({ message_id: agentMessageId, outcome: plan.outcome }),
      },
    );
    if (!claimed.ok) return claimed;
    if (plan.outcome === RecoveryOutcome.restarted) {
      return ok(NOTHING_PROMOTED);
    }
    return closeTurn(
      tx,
      org,
      agentMessageId,
      plan.status,
      plan.reason,
      MessageStatus.created,
    );
  });
}

/** D3 step 5. A conflict is success. Any other failure is left to the next sweep. */
async function restart(
  deps: ReaperDeps,
  target: Pick<StaleTurn, 'org' | 'agentMessageId' | 'threadId'>,
  traceId: string,
): Promise<void> {
  const { org, agentMessageId, threadId } = target;
  try {
    await withTraceId(traceId, () =>
      deps.temporal.client.workflow.start(
        WORKFLOW_NAME,
        turnStartOptions(org, { threadId, agentMessageId }, deps.config),
      ),
    );
  } catch (e) {
    if (e instanceof WorkflowExecutionAlreadyStartedError) return;
    deps.log.warn({ err: e, agentMessageId }, 'reaper start failed');
  }
}

/**
 * D6: starts the message a won close promoted. Called after that close's `Tx`
 * commits. Nothing promoted, nothing started. A failed start is left to the
 * next sweep (P4.5 lost-start).
 */
async function restartPromoted(
  deps: ReaperDeps,
  org: OrgId,
  promoted: string | undefined,
): Promise<void> {
  if (promoted === undefined) return;
  const pin = await loadAgentMessage(deps.db, org, promoted);
  if (!pin.ok) {
    deps.log.warn({ agentMessageId: promoted }, 'promoted message not loaded');
    return;
  }
  await restart(
    deps,
    { org, agentMessageId: promoted, threadId: pin.value.threadId },
    pin.value.traceId,
  );
}

/** D3: describe, claim, act. Returns true when this sweep won the claim. */
async function recoverOne(
  deps: ReaperDeps,
  turn: StaleTurn,
  storeCallTimeoutMs: number,
): Promise<boolean> {
  const { db, temporal, log } = deps;
  const { org, agentMessageId, threadId } = turn;
  const newest = await newestAttempt(db, org, agentMessageId);
  if (
    await hasOpenExecution(
      temporal,
      turnWorkflowId(org, threadId, agentMessageId),
    )
  ) {
    return false;
  }
  const pin = await loadAgentMessage(db, org, agentMessageId);
  if (!pin.ok) throw new Error(pin.error.message);
  const plan = await decide(db, turn, pin.value, (newest ?? 0) + 1);
  const claimed = await claim(db, turn, newest, plan, storeCallTimeoutMs);
  if (!claimed.ok) {
    if (claimed.error.code !== ErrorCode.aborted) {
      log.warn(
        { agentMessageId, code: claimed.error.code },
        'reaper claim failed',
      );
    }
    return false;
  }
  if (plan.outcome === RecoveryOutcome.restarted)
    await restart(deps, turn, pin.value.traceId);
  await restartPromoted(deps, org, claimed.value.promotedAgentMessageId);
  log.info({ agentMessageId, outcome: plan.outcome }, 'reaper acted');
  return true;
}

/**
 * Pages until `batch` rows have been acted on, or a short page ends the sweep.
 * A row that returns false does not count, so it cannot starve one behind it.
 */
async function drain<T>(
  batch: number,
  load: (after: T | undefined) => Promise<readonly T[]>,
  act: (row: T) => Promise<boolean>,
): Promise<void> {
  let done = 0;
  let after: T | undefined;
  while (done < batch) {
    const page = await load(after);
    for (const row of page) {
      if (done >= batch) break;
      if (await act(row)) done += 1;
    }
    const last = page.at(-1);
    if (last === undefined || page.length < batch) return;
    after = last;
  }
}

/**
 * D2: pages of `REAPER_BATCH_SIZE` from the oldest, until this sweep has won
 * `REAPER_BATCH_SIZE` claims or the candidates run out. A candidate that is
 * open, or that fails, does not count, so it cannot starve one behind it.
 */
async function sweep(
  deps: ReaperDeps,
  storeCallTimeoutMs: number,
): Promise<void> {
  const { db, config, log } = deps;
  const olderThan = new Date(Date.now() - config.START_GRACE_MS);
  await drain<StaleTurn>(
    config.REAPER_BATCH_SIZE,
    (after) => listStaleTurns(db, olderThan, after, config.REAPER_BATCH_SIZE),
    async (turn) => {
      try {
        return await recoverOne(deps, turn, storeCallTimeoutMs);
      } catch (e) {
        log.warn(
          { err: e, agentMessageId: turn.agentMessageId },
          'reaper skipped a message',
        );
        return false;
      }
    },
  );
}

/** The two passes over paused messages (D2). */
const EndedPauseKind = z.enum({
  stopped: 'stopped',
  due: 'due',
});

type EndedPauseKind = z.infer<typeof EndedPauseKind>;

const EndedPauseRow = z
  .object({
    org_id: orgId,
    id: z.string().min(1),
    cursor: z.string().min(1),
  })
  .transform((row) => ({
    org: row.org_id,
    agentMessageId: row.id,
    cursor: row.cursor,
  }));

/** One paused candidate. `cursor` is the ordering time as database text. */
type EndedPause = z.output<typeof EndedPauseRow>;

/**
 * D2, the second read that takes no org: agent messages whose newest status is
 * `paused`, after `after`. `stopped`: has a `stop_requested` row, ordered by its
 * `at`. `due`: `expires_at` has passed and no stop was requested, ordered by
 * `expires_at`. Read-only and private to the reaper.
 */
async function listEndedPauses(
  db: Db,
  which: EndedPauseKind,
  after: EndedPause | undefined,
  limit: number,
): Promise<EndedPause[]> {
  const stopped = which === EndedPauseKind.enum.stopped;
  const clock = stopped ? sql`r.at` : sql`s.expires_at`;
  const join = stopped
    ? sql`join stop_requested r on r.org_id = s.org_id and r.message_id = s.message_id`
    : sql``;
  const filter = stopped
    ? sql``
    : sql`and s.expires_at <= now()
      and not exists (
        select 1 from stop_requested r
        where r.org_id = s.org_id and r.message_id = s.message_id
      )`;
  const past =
    after === undefined
      ? sql``
      : sql`and (${clock}, s.org_id, s.message_id) >
          (${after.cursor}::timestamptz, ${after.org}, ${after.agentMessageId})`;
  const rows = await sql`
    select s.org_id, s.message_id as id, ${clock}::text as cursor
    from message_status s
    ${join}
    where s.status = ${MessageStatus.paused}
      and not exists (
        select 1 from message_status newer
        where newer.org_id = s.org_id and newer.message_id = s.message_id
          and newer.seq > s.seq
      )
      ${filter}
      ${past}
    order by ${clock}, s.org_id, s.message_id
    limit ${limit}`.execute(db);
  return z.array(EndedPauseRow).parse(rows.rows);
}

/** D3: one `Tx`. A stop request wins over expiry; a lost race writes nothing. */
function endPause(
  db: Db,
  pause: EndedPause,
  storeCallTimeoutMs: number,
): Promise<Result<ClosedTurn>> {
  const { org, agentMessageId } = pause;
  return inSweepTx(db, storeCallTimeoutMs, async (tx) => {
    const q = withTables<RuntimeTables>(tx);
    const stop = await q
      .selectFrom('stop_requested')
      .select('kind')
      .where('org_id', '=', org)
      .where('message_id', '=', agentMessageId)
      .executeTakeFirst();
    if (stop !== undefined) {
      return closeTurn(
        tx,
        org,
        agentMessageId,
        STATUS_OF_REQUEST[stop.kind],
        EndReason.enum.stop_requested,
        MessageStatus.paused,
      );
    }
    const due = await sql<{ due: boolean }>`
      select s.expires_at <= now() as due
      from message_status s
      where s.org_id = ${org} and s.message_id = ${agentMessageId}
      order by s.seq desc
      limit 1`.execute(tx);
    if (due.rows[0]?.due !== true) return ok(NOTHING_PROMOTED);
    return closeTurn(
      tx,
      org,
      agentMessageId,
      MessageStatus.expired,
      EndReason.enum.pause_timeout,
      MessageStatus.paused,
    );
  });
}

/** One pass over `which`: pages of `REAPER_BATCH_SIZE` until that many pauses are closed or none are left. */
async function endPauses(
  deps: ReaperDeps,
  which: EndedPauseKind,
  storeCallTimeoutMs: number,
): Promise<void> {
  const { db, config, log } = deps;
  await drain<EndedPause>(
    config.REAPER_BATCH_SIZE,
    (after) => listEndedPauses(db, which, after, config.REAPER_BATCH_SIZE),
    async (pause) => {
      try {
        const closed = await endPause(db, pause, storeCallTimeoutMs);
        if (closed.ok) {
          await restartPromoted(
            deps,
            pause.org,
            closed.value.promotedAgentMessageId,
          );
          log.info(
            { agentMessageId: pause.agentMessageId, which },
            'reaper ended a pause',
          );
          return true;
        }
        if (closed.error.code !== ErrorCode.aborted) {
          log.warn(
            { agentMessageId: pause.agentMessageId, code: closed.error.code },
            'reaper pause close failed',
          );
        }
        return false;
      } catch (e) {
        log.warn(
          { err: e, agentMessageId: pause.agentMessageId },
          'reaper skipped a pause',
        );
        return false;
      }
    },
  );
}

/** The reaper's activity (private to the worker). */
export function reaperActivities(deps: ReaperDeps): ReaperActivities {
  return {
    sweep: async (args) => {
      const { storeCallTimeoutMs } = parseArgs(SweepArgs, args);
      await sweep(deps, storeCallTimeoutMs);
      await endPauses(deps, EndedPauseKind.enum.stopped, storeCallTimeoutMs);
      await endPauses(deps, EndedPauseKind.enum.due, storeCallTimeoutMs);
    },
  };
}
