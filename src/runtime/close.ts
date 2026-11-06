import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import { appendIfNewest, withTables } from '../db/index.ts';
import type { OrgId, Tx } from '../db/index.ts';
import { ActionStatus, appendActionStatus } from './actions.ts';
import { stakeOf } from './blocked.ts';
import { checkRemember } from './decide.ts';
import { acceptTurn, insertAgentMessage } from './post.ts';
import { insertPendingClose, openPendingPlans, topRank } from './pending.ts';
import type { Writer } from './pending.ts';
import { lockConversation } from './lock.ts';
import { finishMessage, selectNewestStatus } from './messages.ts';
import { BlockKind, MessageStatus } from './status.ts';
import type { BlockKind as BlockKindName, TerminalStatus } from './status.ts';
import type { ClosedTurn } from './step-contract.ts';
import { nextStreamSeq } from './stream.ts';
import type { RuntimeTables } from './tables.ts';

export type { ClosedTurn };

const NOTHING_PROMOTED: ClosedTurn = { promotedAgentMessageId: undefined };

/** Reasons this module and the reaper write on a close. */
export const EndReason = z.enum({
  stop_requested: 'stop_requested',
  pause_timeout: 'pause_timeout',
  recoveries_exhausted: 'recoveries_exhausted',
  turn_ended: 'turn_ended',
});

/**
 * D5 and D8, in the caller's `Tx`. The lock comes first (D3, PD1), then the
 * terminal status of the message when its newest status is `expected` (the
 * workflow and P4.5 pass `created`, the pause passes `paused`). When the CAS
 * won, pending messages are promoted or dropped, then `cancelled` is written
 * with an error output on every action whose newest status is `created`,
 * `running`, or `blocked`. A lost terminal write touches no action and no
 * pending message.
 *
 * The lock needs the thread. `thread_id` never changes, so the read of it
 * happens before the lock and cannot race a post (human choice A).
 */
export async function closeTurn(
  tx: Tx,
  org: OrgId,
  agentMessageId: string,
  status: TerminalStatus,
  reason: string | null,
  expected: typeof MessageStatus.created | typeof MessageStatus.paused,
): Promise<Result<ClosedTurn>> {
  const q = withTables<RuntimeTables>(tx);
  const message = await q
    .selectFrom('message')
    .select('thread_id')
    .where('org_id', '=', org)
    .where('id', '=', agentMessageId)
    .executeTakeFirst();
  if (message === undefined) return ok(NOTHING_PROMOTED);
  await lockConversation(tx, org, message.thread_id);
  const before = await selectNewestStatus(q, org, agentMessageId);
  if (before?.status !== expected) return ok(NOTHING_PROMOTED);
  const finished = await finishMessage(
    tx,
    org,
    agentMessageId,
    status,
    reason,
    expected,
  );
  if (!finished.ok) return finished;
  const after = await selectNewestStatus(q, org, agentMessageId);
  if (after === undefined || after.seq === before.seq) {
    return ok(NOTHING_PROMOTED);
  }
  const promotedAgentMessageId = await promoteOrDropPending(
    tx,
    org,
    message.thread_id,
    status,
  );

  const actions = await q
    .selectFrom('action')
    .select('id')
    .where('org_id', '=', org)
    .where('message_id', '=', agentMessageId)
    .orderBy('step_index', 'asc')
    .orderBy('call_index', 'asc')
    .execute();
  for (const action of actions) {
    const cancelled = await appendActionStatus(
      tx,
      org,
      action.id,
      (newest) =>
        newest === ActionStatus.created ||
        newest === ActionStatus.running ||
        newest === ActionStatus.blocked,
      {
        status: ActionStatus.cancelled,
        reason: EndReason.enum.turn_ended,
        attempt: null,
        resumePointer: null,
      },
    );
    if (!cancelled.ok) continue;
    await q
      .insertInto('action_output')
      .values({
        org_id: org,
        action_id: action.id,
        model_text: `${EndReason.enum.turn_ended}: the turn ended before the tool call finished`,
        is_error: true,
        truncated: false,
        object_id: null,
        stream_seq: await nextStreamSeq(tx, org, 'message', agentMessageId),
      })
      .execute();
  }
  return ok({ promotedAgentMessageId });
}

/** Drops every row of `rows` with `reason`. The reason is the only thing that differs by caller. */
async function dropAll(
  q: Writer,
  org: OrgId,
  rows: readonly { readonly userMessageId: string }[],
  reason: string,
): Promise<void> {
  for (const row of rows) {
    await insertPendingClose(q, org, row.userMessageId, {
      kind: 'dropped',
      reason,
    });
  }
}

/**
 * D5 step 4, in the caller's `Tx`, only after a won CAS and under the lock
 * `closeTurn` took. `cancelled` drops every open pending message. Any other
 * status re-checks the newest plan with `acceptTurn` (database only); a refusal
 * drops every row with the refusal as the reason. Otherwise one agent message is
 * minted at the top rank, owned by the newest pending message, and every row is
 * promoted to it. Returns the minted id, or `undefined` when nothing promoted.
 */
async function promoteOrDropPending(
  tx: Tx,
  org: OrgId,
  threadId: string,
  status: TerminalStatus,
): Promise<string | undefined> {
  const q = withTables<RuntimeTables>(tx);
  const rows = await openPendingPlans(q, org, threadId);
  const newest = rows[rows.length - 1];
  if (newest === undefined) return undefined;
  if (status === MessageStatus.cancelled) {
    await dropAll(q, org, rows, 'cancelled');
    return undefined;
  }
  const { plan } = newest;
  const accepts = await acceptTurn(tx, org, plan.agentId, plan.prepared);
  if (!accepts.ok) {
    await dropAll(q, org, rows, accepts.error.message);
    return undefined;
  }
  const agentMessageId = randomUUID();
  const creator = await q
    .selectFrom('message')
    .select('created_by')
    .where('org_id', '=', org)
    .where('id', '=', newest.userMessageId)
    .executeTakeFirstOrThrow();
  await insertAgentMessage(
    q,
    org,
    creator.created_by,
    {
      id: agentMessageId,
      threadId,
      rank: (await topRank(q, org, threadId)) + 1,
      userMessageId: newest.userMessageId,
      agentId: plan.agentId,
      traceId: randomUUID(),
      requestContext: plan.requestContext,
      maxSteps: plan.maxSteps,
      retryKey: null,
    },
    plan.prepared,
  );
  // seam: P13.6 appends the `promoted` conversation event here, in the same Tx.
  for (const row of rows) {
    await insertPendingClose(q, org, row.userMessageId, {
      kind: 'promoted',
      agentMessageId,
    });
  }
  return agentMessageId;
}

/** The reason of the first action, in call order, whose newest status is `blocked`. */
async function firstBlockedReason(
  tx: Tx,
  org: OrgId,
  agentMessageId: string,
): Promise<string | null> {
  const rows = await withTables<RuntimeTables>(tx)
    .selectFrom('action')
    .innerJoin('action_status', (join) =>
      join
        .onRef('action_status.org_id', '=', 'action.org_id')
        .onRef('action_status.action_id', '=', 'action.id'),
    )
    .select(['action.id', 'action_status.status', 'action_status.reason'])
    .where('action.org_id', '=', org)
    .where('action.message_id', '=', agentMessageId)
    .orderBy('action.step_index', 'asc')
    .orderBy('action.call_index', 'asc')
    .orderBy('action_status.seq', 'desc')
    .execute();
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (row.status === ActionStatus.blocked) return row.reason;
  }
  return null;
}

interface PauseAction {
  readonly actionId: string;
  readonly kind: BlockKindName;
  readonly canRemember: boolean;
  readonly streamSeq: number;
}

function knownBlockKind(value: string | null): BlockKindName | undefined {
  return Object.values(BlockKind).find((kind) => kind === value);
}

/** Blocked actions of this message, in `stream_seq` order (D10, C12). */
async function blockedAtPause(
  tx: Tx,
  org: OrgId,
  agentMessageId: string,
): Promise<PauseAction[]> {
  const rows = await withTables<RuntimeTables>(tx)
    .selectFrom('action')
    .innerJoin('action_status', (join) =>
      join
        .onRef('action_status.org_id', '=', 'action.org_id')
        .onRef('action_status.action_id', '=', 'action.id'),
    )
    .select([
      'action.id',
      'action.stream_seq',
      'action.config_snapshot',
      'action_status.status',
      'action_status.block_kind',
    ])
    .where('action.org_id', '=', org)
    .where('action.message_id', '=', agentMessageId)
    .orderBy('action_status.seq', 'desc')
    .execute();
  const seen = new Set<string>();
  const blocked: PauseAction[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const kind = knownBlockKind(row.block_kind);
    if (row.status !== ActionStatus.blocked || kind === undefined) continue;
    const stake = stakeOf(row.config_snapshot);
    const remember = stake.ok
      ? await checkRemember(tx, org, {
          actionId: row.id,
          stake: stake.value,
        })
      : undefined;
    blocked.push({
      actionId: row.id,
      kind,
      canRemember: remember?.ok === true,
      streamSeq: row.stream_seq ?? Number.MAX_SAFE_INTEGER,
    });
  }
  blocked.sort((a, b) => a.streamSeq - b.streamSeq);
  return blocked;
}

/**
 * D4, in the caller's `Tx`: `paused` when the newest status is `created`, with
 * the first blocked action's reason and `expires_at` from the database clock.
 * A lost append writes nothing. When the pause lands and at least one action
 * is blocked, the same transaction writes one `message_pause` snapshot (PD14).
 */
export async function pauseMessage(
  tx: Tx,
  org: OrgId,
  agentMessageId: string,
  pauseSeconds: number,
): Promise<Result<void>> {
  const reason = await firstBlockedReason(tx, org, agentMessageId);
  const clock = await sql<{ expires_at: Date }>`
    select now() + make_interval(secs => ${pauseSeconds}) as expires_at
  `.execute(tx);
  const expiresAt = clock.rows[0]?.expires_at;
  if (expiresAt === undefined) throw new Error('the database returned no time');
  const paused = await appendIfNewest<RuntimeTables, 'message_status'>(
    withTables<RuntimeTables>(tx),
    {
      table: 'message_status',
      org,
      key: { message_id: agentMessageId },
      accept: (newest) => newest?.status === MessageStatus.created,
      row: () => ({
        message_id: agentMessageId,
        status: MessageStatus.paused,
        reason,
        expires_at: expiresAt,
      }),
    },
  );
  if (!paused.ok) return ok(undefined);
  const actions = await blockedAtPause(tx, org, agentMessageId);
  if (actions.length === 0) return ok(undefined);
  const streamSeq = await nextStreamSeq(tx, org, 'message', agentMessageId);
  await withTables<RuntimeTables>(tx)
    .insertInto('message_pause')
    .values({
      org_id: org,
      message_id: agentMessageId,
      stream_seq: streamSeq,
      blocked: JSON.stringify({
        actions: actions.map(({ actionId, kind, canRemember }) => ({
          actionId,
          kind,
          canRemember,
        })),
      }),
    })
    .execute();
  return ok(undefined);
}
