import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { appendIfNewest, withTables } from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import { ModelChoiceSchema } from '../models/index.ts';
import type { ModelChoice } from '../models/index.ts';
import type { RequestContext } from './request-context.ts';
import { MessageStatus, TERMINAL_STATUSES } from './status.ts';
import type { TerminalStatus } from './status.ts';
import { appendConversationEvent, nextStreamSeq } from './stream.ts';
import { runtimeView } from './tables.ts';
import type { RuntimeTables } from './tables.ts';

export type Reader = ReturnType<typeof runtimeView>;

/** What an agent message pins: its place, its agent version, and its inputs. */
export interface AgentMessagePin {
  readonly threadId: string;
  readonly rank: number;
  readonly agentId: string;
  readonly agentVersion: number;
  readonly traceId: string;
  readonly requestContext: RequestContext;
  readonly maxSteps: number | null;
  readonly userMessageId: string;
}

const notFound = (what: string) =>
  err(appError(ErrorCode.not_found, `${what} not found`));

/** The pin of agent message `id`, or `undefined` when the org has no such agent message. */
export async function selectPin(
  q: Reader,
  org: OrgId,
  id: string,
): Promise<AgentMessagePin | undefined> {
  const row = await q
    .selectFrom('message')
    .selectAll()
    .where('org_id', '=', org)
    .where('id', '=', id)
    .where('role', '=', 'agent')
    .executeTakeFirst();
  if (
    row?.agent_id == null ||
    row.agent_version === null ||
    row.trace_id === null ||
    row.request_context === null ||
    row.user_message_id === null
  ) {
    return undefined;
  }
  return {
    threadId: row.thread_id,
    rank: row.rank,
    agentId: row.agent_id,
    agentVersion: row.agent_version,
    traceId: row.trace_id,
    requestContext: row.request_context,
    maxSteps: row.max_steps,
    userMessageId: row.user_message_id,
  };
}

/** The newest status row of message `id`, or `undefined` when it has none. */
export async function selectNewestStatus(
  q: Reader,
  org: OrgId,
  id: string,
): Promise<
  { readonly status: MessageStatus; readonly seq: number } | undefined
> {
  const row = await q
    .selectFrom('message_status')
    .select(['status', 'seq'])
    .where('org_id', '=', org)
    .where('message_id', '=', id)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (row === undefined) return undefined;
  const status = knownStatus(row.status);
  if (status === undefined) {
    throw new Error('message_status.status is not a known status');
  }
  return { status, seq: row.seq };
}

function knownStatus(value: string): MessageStatus | undefined {
  for (const status of Object.values(MessageStatus)) {
    if (status === value) return status;
  }
  return undefined;
}

/** The pin of an agent message, or `not_found`. */
export async function loadAgentMessage(
  db: Db,
  org: OrgId,
  messageId: string,
): Promise<Result<AgentMessagePin>> {
  const pin = await selectPin(runtimeView(db), org, messageId);
  return pin === undefined ? notFound('message') : ok(pin);
}

/** The newest status of a message, or `not_found`. */
export async function newestMessageStatus(
  db: Db,
  org: OrgId,
  messageId: string,
): Promise<Result<{ readonly status: MessageStatus; readonly seq: number }>> {
  const newest = await selectNewestStatus(runtimeView(db), org, messageId);
  return newest === undefined ? notFound('message') : ok(newest);
}

/** The model of the newest `model_resolution` row of a message, or `not_found`. */
export async function newestResolution(
  db: Db,
  org: OrgId,
  messageId: string,
): Promise<Result<ModelChoice>> {
  const row = await runtimeView(db)
    .selectFrom('model_resolution')
    .select(['provider', 'model', 'reasoning_effort'])
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (row === undefined) return notFound('model resolution');
  const choice = ModelChoiceSchema.safeParse({
    provider: row.provider,
    model: row.model,
    reasoningEffort: row.reasoning_effort,
  });
  if (!choice.success) {
    return err(appError(ErrorCode.internal, 'stored resolution is invalid'));
  }
  return ok(choice.data);
}

/**
 * Appends the terminal `status` when the newest row is `expected`. Returns `ok`
 * whether it wrote or lost: the first terminal write stands. A non-terminal
 * `status` is a programming error and throws.
 */
export async function finishMessage(
  tx: Tx,
  org: OrgId,
  messageId: string,
  status: TerminalStatus,
  reason: string | null,
  expected:
    | typeof MessageStatus.created
    | typeof MessageStatus.paused = MessageStatus.created,
): Promise<Result<void>> {
  if (!TERMINAL_STATUSES.includes(status)) {
    throw new Error('finishMessage: status is not terminal');
  }
  const q = withTables<RuntimeTables>(tx);
  const before = await selectNewestStatus(q, org, messageId);
  if (before?.status !== expected) return ok(undefined);
  // shortcut: a terminal write that loses after this check leaves a gap in the
  // message `seq` (never a repeat or a misorder); a savepoint closes it if a reader needs no gaps.
  const streamSeq = await nextStreamSeq(tx, org, 'message', messageId);
  const written = await appendIfNewest<RuntimeTables, 'message_status'>(q, {
    table: 'message_status',
    org,
    key: { message_id: messageId },
    accept: (newest) => newest?.status === expected,
    row: () => ({
      message_id: messageId,
      status,
      reason,
      stream_seq: streamSeq,
    }),
  });
  if (!written.ok) return ok(undefined);
  const message = await q
    .selectFrom('message')
    .select('thread_id')
    .where('org_id', '=', org)
    .where('id', '=', messageId)
    .executeTakeFirstOrThrow();
  await appendConversationEvent(tx, org, message.thread_id, {
    kind: 'done',
    messageId,
    payload: { status },
  });
  return ok(undefined);
}
