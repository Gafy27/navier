import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import type { OrgId } from '../db/index.ts';
import { requireAgentUse } from '../agents/index.ts';
import type { Caller } from '../identity/index.ts';
import { blockedActions, notFound, requireOwnThread } from './blocked.ts';
import type { BlockedAction, ListBlockedDeps } from './blocked.ts';
import { loadAgentMessage, selectNewestStatus } from './messages.ts';
import { StepContentSchema } from './prompt.ts';
import { MessageStatus } from './status.ts';
import { runtimeView } from './tables.ts';

/** What a caller reads of one agent message: rows only, never workflow state. */
export interface TurnResult {
  readonly status: MessageStatus;
  readonly reason: string | null;
  /** The `text` of the highest step; empty before the first step. */
  readonly text: string;
  readonly agentVersion: number;
  readonly traceId: string;
  readonly threadId: string;
  /** The message's actions waiting on a person; empty unless `paused`. */
  readonly blocked: BlockedAction[];
}

/**
 * D8: the thread rule, then CheckAgentUse at the pin, then the newest status, the
 * last step's text, the pin, and when `paused` the blocked actions of this message.
 */
export async function readTurnResult(
  deps: ListBlockedDeps,
  caller: Caller,
  org: OrgId,
  agentMessageId: string,
): Promise<Result<TurnResult>> {
  const { db, authz } = deps;
  const pin = await loadAgentMessage(db, org, agentMessageId);
  if (!pin.ok) return pin;
  const { threadId, agentId, agentVersion, traceId } = pin.value;

  const own = await requireOwnThread(db, org, caller, threadId);
  if (!own.ok) return own;
  const allowed = await requireAgentUse(
    authz,
    org,
    caller,
    agentId,
    agentVersion,
  );
  if (!allowed.ok) return allowed;

  const q = runtimeView(db);
  const newest = await selectNewestStatus(q, org, agentMessageId);
  if (newest === undefined) return notFound('message');
  const row = await q
    .selectFrom('message_status')
    .select('reason')
    .where('org_id', '=', org)
    .where('message_id', '=', agentMessageId)
    .where('seq', '=', newest.seq)
    .executeTakeFirstOrThrow();

  const step = await q
    .selectFrom('step')
    .select('content')
    .where('org_id', '=', org)
    .where('message_id', '=', agentMessageId)
    .orderBy('step_index', 'desc')
    .limit(1)
    .executeTakeFirst();
  const content = step && StepContentSchema.safeParse(step.content);
  if (content && !content.success) {
    return err(appError(ErrorCode.internal, 'stored step is invalid'));
  }

  let blocked: BlockedAction[] = [];
  if (newest.status === MessageStatus.paused) {
    const listed = await blockedActions(db, org, agentMessageId);
    if (!listed.ok) return listed;
    blocked = listed.value;
  }
  return ok({
    status: newest.status,
    reason: row.reason,
    text: content?.data.text ?? '',
    agentVersion,
    traceId,
    threadId,
    blocked,
  });
}
