import { sql } from 'kysely';
import { appError, err, ErrorCode, JsonValueSchema, ok } from '../index.ts';
import type { JsonValue, Result } from '../index.ts';
import type { Db, OrgId } from '../db/index.ts';
import type { Caller } from '../identity/index.ts';
import { selectNewestStatus } from './messages.ts';
import { pendingState } from './pending.ts';
import type { PendingState } from './pending.ts';
import { redactEvent } from './redact.ts';
import type { MessageStatus } from './status.ts';
import { runtimeView } from './tables.ts';
import type { RuntimeTables } from './tables.ts';

/**
 * Inserts the thread row of a new conversation (PD2). The creator column is
 * metadata, never an access rule (D1). A repeat inserts nothing and is `created: false`.
 */
export async function startThread(
  db: Db,
  caller: Caller,
  org: OrgId,
  threadId: string,
  title?: string,
): Promise<Result<{ readonly created: boolean }>> {
  const inserted = await runtimeView(db)
    .insertInto('thread')
    .values({
      org_id: org,
      id: threadId,
      created_by: caller.principal.id,
      title: title ?? null,
    })
    .onConflict((conflict) => conflict.columns(['org_id', 'id']).doNothing())
    .executeTakeFirst();
  return ok({ created: inserted.numInsertedOrUpdatedRows !== 0n });
}

/** D8: a thread with a `deleted` state row reads as absent. */
const notDeleted = sql<boolean>`not exists (
  select 1 from thread_state s
  where s.org_id = thread.org_id and s.thread_id = thread.id and s.kind = 'deleted'
)`;

const missingConversation = () =>
  err(appError(ErrorCode.not_found, 'conversation not found'));

async function threadIsLive(
  db: Db,
  org: OrgId,
  threadId: string,
): Promise<boolean> {
  const row = await runtimeView(db)
    .selectFrom('thread')
    .select('id')
    .where('org_id', '=', org)
    .where('id', '=', threadId)
    .where(notDeleted)
    .executeTakeFirst();
  return row !== undefined;
}

async function appendThreadState(
  db: Db,
  org: OrgId,
  threadId: string,
  kind: RuntimeTables['thread_state']['kind'],
  title: string | null,
): Promise<Result<void>> {
  if (!(await threadIsLive(db, org, threadId))) return missingConversation();
  await runtimeView(db)
    .insertInto('thread_state')
    .values({ org_id: org, thread_id: threadId, kind, title })
    .execute();
  return ok(undefined);
}

/** D8: renames a live thread. The owner's `can_post` is the route's check. */
export function renameThread(
  db: Db,
  org: OrgId,
  threadId: string,
  title: string,
): Promise<Result<void>> {
  return appendThreadState(db, org, threadId, 'title', title);
}

/** D8: soft delete. No row is removed; list and read then answer as absent. */
export function markThreadDeleted(
  db: Db,
  org: OrgId,
  threadId: string,
): Promise<Result<void>> {
  return appendThreadState(db, org, threadId, 'deleted', null);
}

/**
 * Up to `page.chunk` thread ids of `org`, in id order, strictly after `page.after`.
 * Applies no visibility rule: the caller checks each id (L3).
 */
export async function listThreadIds(
  db: Db,
  org: OrgId,
  page: { readonly after?: string; readonly chunk: number },
): Promise<readonly string[]> {
  const candidates = runtimeView(db)
    .selectFrom('thread')
    .select('id')
    .where('org_id', '=', org)
    .where(notDeleted);
  const rows = await (
    page.after === undefined
      ? candidates
      : candidates.where('id', '>', page.after)
  )
    .orderBy('id')
    .limit(page.chunk)
    .execute();
  return rows.map((row) => row.id);
}

/** One message of a conversation, as its rows read (D1, PD2). */
export interface MessageView {
  readonly id: string;
  readonly rank: number;
  readonly role: RuntimeTables['message']['role'];
  /** A user message's text; null on an agent message, whose text is in its steps. */
  readonly text: string | null;
  readonly agentId: string | null;
  readonly agentVersion: number | null;
  /** The newest status; null on a user message, which has none. */
  readonly status: MessageStatus | null;
  /** A user message's pending state (D7); null on an agent message and on a never-pending user message. */
  readonly pending: PendingState | null;
  /** Each step row's `stepIndex`, `content`, `finishReason`, `usage`, redacted (L1). */
  readonly steps: readonly JsonValue[];
  /** Each action row's ids and arguments, redacted (L1). No `config_snapshot`. */
  readonly actions: readonly JsonValue[];
}

export interface ConversationView {
  readonly threadId: string;
  readonly messages: readonly MessageView[];
}

/** L1: each row is JSON, redacted once. A row that is not JSON is `internal`. */
function redactRows(
  rows: readonly Record<string, unknown>[],
): Result<JsonValue[]> {
  const out: JsonValue[] = [];
  for (const row of rows) {
    const parsed = JsonValueSchema.safeParse(row);
    if (!parsed.success) {
      return err(appError(ErrorCode.internal, 'stored row is not JSON'));
    }
    out.push(redactEvent(parsed.data));
  }
  return ok(out);
}

/**
 * The messages of `threadId` in rank order, each with its newest status, steps,
 * and actions, from rows only. Temporal is not queried. `not_found` when the
 * thread is absent in `org`. The caller checks `can_read` first.
 */
export async function readConversation(
  db: Db,
  org: OrgId,
  threadId: string,
): Promise<Result<ConversationView>> {
  const q = runtimeView(db);
  if (!(await threadIsLive(db, org, threadId))) return missingConversation();
  const rows = await q
    .selectFrom('message')
    .select(['id', 'rank', 'role', 'text', 'agent_id', 'agent_version'])
    .where('org_id', '=', org)
    .where('thread_id', '=', threadId)
    .orderBy('rank')
    .execute();

  const messages: MessageView[] = [];
  for (const row of rows) {
    const newest = await selectNewestStatus(q, org, row.id);
    const pending =
      row.role === 'user'
        ? ((await pendingState(q, org, row.id)) ?? null)
        : null;
    const steps = await q
      .selectFrom('step')
      .select(['step_index', 'content', 'finish_reason', 'usage'])
      .where('org_id', '=', org)
      .where('message_id', '=', row.id)
      .orderBy('step_index')
      .execute();
    const actions = await q
      .selectFrom('action')
      .select([
        'id',
        'step_index',
        'call_index',
        'tool_call_id',
        'tool_key',
        'arguments',
      ])
      .where('org_id', '=', org)
      .where('message_id', '=', row.id)
      .orderBy('step_index')
      .orderBy('call_index')
      .execute();
    const stepRows = redactRows(
      steps.map((s) => ({
        stepIndex: s.step_index,
        content: s.content,
        finishReason: s.finish_reason,
        usage: s.usage,
      })),
    );
    if (!stepRows.ok) return stepRows;
    const actionRows = redactRows(
      actions.map((a) => ({
        actionId: a.id,
        stepIndex: a.step_index,
        callIndex: a.call_index,
        toolCallId: a.tool_call_id,
        toolKey: a.tool_key,
        arguments: a.arguments,
      })),
    );
    if (!actionRows.ok) return actionRows;
    messages.push({
      id: row.id,
      rank: row.rank,
      role: row.role,
      text: row.text,
      agentId: row.agent_id,
      agentVersion: row.agent_version,
      status: newest?.status ?? null,
      pending,
      steps: stepRows.value,
      actions: actionRows.value,
    });
  }
  return ok({ threadId, messages });
}
