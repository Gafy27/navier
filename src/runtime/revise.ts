import { randomUUID } from 'node:crypto';
import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import { withTables, withTransaction } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';
import { SCOPE_GRAMMAR } from '../identity/index.ts';
import type { Caller } from '../identity/index.ts';
import { ModelChoiceSchema } from '../models/index.ts';
import type { ModelChoice } from '../models/index.ts';
import { newestMessageStatus, selectPin } from './messages.ts';
import type { AgentMessagePin, Reader } from './messages.ts';
import { MessageRole } from './pins.ts';
import { lockConversation } from './lock.ts';
import { openAgent, pendingState, topRank } from './pending.ts';
import {
  acceptTurn,
  insertAgentMessage,
  insertUserMessage,
  prepareTurn,
  writeUnlessRaced,
} from './post.ts';
import { startCommitted, StartRefusal } from './start.ts';
import type { StartDeps } from './start.ts';
import { MessageStatus } from './status.ts';
import { runtimeView } from './tables.ts';
import type { RuntimeTables } from './tables.ts';

const EditBodySchema = z.strictObject({ text: z.string().min(1) });

const RetryBodySchema = z.strictObject({
  idempotencyKey: z.string().min(1),
  agentId: z
    .string()
    .refine((id) => SCOPE_GRAMMAR.agent.validId(id))
    .optional(),
  modelSelection: ModelChoiceSchema.optional(),
});

const invalid = (message: string) =>
  err(appError(ErrorCode.invalid_argument, message));

/** The answer for a message that is absent, in another thread, or not the caller's. */
const notFound = () => err(appError(ErrorCode.not_found, 'message not found'));

const corrupt = () =>
  err(appError(ErrorCode.internal, 'stored message is invalid'));

/** D2: edit and retry wait out a `created` or `paused` agent message; nothing is written. */
const threadBusy = () => err(appError(ErrorCode.aborted, 'thread_busy'));

/** The error names the first bad field, never its value. */
function parseBody<S extends z.ZodType>(
  schema: S,
  body: unknown,
): Result<z.output<S>> {
  const parsed = schema.safeParse(body);
  if (parsed.success) return ok(parsed.data);
  const path = parsed.error.issues[0]?.path.join('.') ?? '';
  return invalid(`${path === '' ? 'body' : path}: invalid`);
}

async function requirePin(
  q: Reader,
  org: OrgId,
  agentMessageId: string,
): Promise<Result<AgentMessagePin>> {
  const pin = await selectPin(q, org, agentMessageId);
  return pin === undefined ? corrupt() : ok(pin);
}

/**
 * D6 and C7: the caller's own newest user message of the thread. Returns the pin
 * of the agent message that answered it, whose agent answers the edit (C4).
 */
async function loadEditTarget(
  q: Reader,
  org: OrgId,
  who: string,
  threadId: string,
  messageId: string,
): Promise<Result<AgentMessagePin>> {
  const target = await q
    .selectFrom('message')
    .select(['role', 'rank', 'created_by'])
    .where('org_id', '=', org)
    .where('id', '=', messageId)
    .where('thread_id', '=', threadId)
    .executeTakeFirst();
  if (target === undefined || target.created_by !== who) return notFound();
  if (target.role !== MessageRole.enum.user) {
    return invalid('message: not a user message');
  }
  // D7: a dropped steer has no answer, so it is refused before the corrupt() path.
  const pending = await pendingState(q, org, messageId);
  if (pending?.kind === 'dropped') return invalid('message: not answered');
  const newestUser = await q
    .selectFrom('message')
    .select('rank')
    .where('org_id', '=', org)
    .where('thread_id', '=', threadId)
    .where('role', '=', MessageRole.enum.user)
    .orderBy('rank', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (newestUser?.rank !== target.rank) {
    return invalid('message: not the newest user message');
  }
  const answer = await q
    .selectFrom('message')
    .select('id')
    .where('org_id', '=', org)
    .where('user_message_id', '=', messageId)
    .executeTakeFirst();
  return answer === undefined ? corrupt() : requirePin(q, org, answer.id);
}

/**
 * PD6, D6: a new user message at `top + 1` and a new agent message at `top + 2`,
 * pinned as post pins, then one start after commit. The old rows stay.
 */
export async function editMessage(
  deps: StartDeps,
  caller: Caller,
  org: OrgId,
  threadId: string,
  messageId: string,
  body: { readonly text: string },
): Promise<
  Result<{ readonly userMessageId: string; readonly agentMessageId: string }>
> {
  const parsed = parseBody(EditBodySchema, body);
  if (!parsed.ok) return parsed;
  const who = caller.principal.id;
  const view = runtimeView(deps.db);
  if ((await openAgent(view, org, threadId)) !== undefined) return threadBusy();
  const answered = await loadEditTarget(view, org, who, threadId, messageId);
  if (!answered.ok) return answered;
  const { agentId, requestContext } = answered.value;

  const prepared = await prepareTurn(
    deps,
    caller,
    org,
    agentId,
    undefined,
    undefined,
  );
  if (!prepared.ok) return prepared;

  const ids = { userMessageId: randomUUID(), agentMessageId: randomUUID() };
  const traceId = randomUUID();
  const committed = await withTransaction(deps.db, async (tx) => {
    await lockConversation(tx, org, threadId);
    const accepts = await acceptTurn(tx, org, agentId, prepared.value);
    if (!accepts.ok) return accepts;
    const q = withTables<RuntimeTables>(tx);
    if ((await openAgent(q, org, threadId)) !== undefined) return threadBusy();
    const target = await loadEditTarget(q, org, who, threadId, messageId);
    if (!target.ok) return target;
    const top = await topRank(q, org, threadId);
    return writeUnlessRaced(async () => {
      await insertUserMessage(q, org, who, {
        id: ids.userMessageId,
        threadId,
        rank: top + 1,
        text: parsed.value.text,
      });
      await insertAgentMessage(
        q,
        org,
        who,
        {
          id: ids.agentMessageId,
          threadId,
          rank: top + 2,
          userMessageId: ids.userMessageId,
          agentId,
          traceId,
          requestContext,
          maxSteps: null,
          retryKey: null,
        },
        prepared.value,
      );
    });
  });
  if (!committed.ok) return committed;

  const started = await startCommitted(
    deps,
    org,
    { threadId, agentMessageId: ids.agentMessageId },
    traceId,
  );
  return started.ok ? ok(ids) : started;
}

/** C7: an agent message of the thread. Returns its pin. */
async function loadRetryTarget(
  q: Reader,
  org: OrgId,
  threadId: string,
  messageId: string,
): Promise<Result<AgentMessagePin>> {
  const target = await q
    .selectFrom('message')
    .select('role')
    .where('org_id', '=', org)
    .where('id', '=', messageId)
    .where('thread_id', '=', threadId)
    .executeTakeFirst();
  if (target === undefined) return notFound();
  if (target.role !== MessageRole.enum.agent) {
    return invalid('message: not an agent message');
  }
  return requirePin(q, org, messageId);
}

/**
 * D7: the message `key` stored. A live run is `already_running`, a paused one
 * is `message_paused`, and a finished one is returned as is. A created message
 * with no run is started again, as the reaper would.
 */
async function replayRetry(
  deps: StartDeps,
  org: OrgId,
  threadId: string,
  stored: { readonly id: string; readonly pin: AgentMessagePin },
): Promise<Result<{ readonly agentMessageId: string }>> {
  const newest = await newestMessageStatus(deps.db, org, stored.id);
  if (!newest.ok) return newest;
  const result = { agentMessageId: stored.id };
  if (newest.value.status === MessageStatus.paused) {
    return err(
      appError(ErrorCode.already_exists, StartRefusal.enum.message_paused),
    );
  }
  if (newest.value.status !== MessageStatus.created) return ok(result);
  const started = await startCommitted(
    deps,
    org,
    { threadId, agentMessageId: stored.id },
    stored.pin.traceId,
  );
  return started.ok ? ok(result) : started;
}

/**
 * PD6, D7: a new agent message at `top + 1` answering the same user message,
 * stored with the caller's key, then one start after commit. The same key
 * returns the stored message and writes nothing.
 */
export async function retryMessage(
  deps: StartDeps,
  caller: Caller,
  org: OrgId,
  threadId: string,
  messageId: string,
  body: {
    readonly idempotencyKey: string;
    readonly agentId?: string;
    readonly modelSelection?: ModelChoice;
  },
): Promise<Result<{ readonly agentMessageId: string }>> {
  const parsed = parseBody(RetryBodySchema, body);
  if (!parsed.ok) return parsed;
  const { idempotencyKey, modelSelection } = parsed.value;
  const q = runtimeView(deps.db);
  const target = await loadRetryTarget(q, org, threadId, messageId);
  if (!target.ok) return target;

  const keyed = await q
    .selectFrom('message')
    .select('id')
    .where('org_id', '=', org)
    .where('thread_id', '=', threadId)
    .where('retry_key', '=', idempotencyKey)
    .executeTakeFirst();
  if (keyed !== undefined) {
    const pin = await requirePin(q, org, keyed.id);
    if (!pin.ok) return pin;
    if (pin.value.userMessageId !== target.value.userMessageId) {
      return invalid('idempotencyKey: exists with another payload');
    }
    return replayRetry(deps, org, threadId, { id: keyed.id, pin: pin.value });
  }

  const agentId = parsed.value.agentId ?? target.value.agentId;
  const prepared = await prepareTurn(
    deps,
    caller,
    org,
    agentId,
    modelSelection,
    undefined,
  );
  if (!prepared.ok) return prepared;

  const agentMessageId = randomUUID();
  const traceId = randomUUID();
  const committed = await withTransaction(deps.db, async (tx) => {
    await lockConversation(tx, org, threadId);
    const accepts = await acceptTurn(tx, org, agentId, prepared.value);
    if (!accepts.ok) return accepts;
    const writer = withTables<RuntimeTables>(tx);
    if ((await openAgent(writer, org, threadId)) !== undefined) {
      return threadBusy();
    }
    const top = await topRank(writer, org, threadId);
    return writeUnlessRaced(() =>
      insertAgentMessage(
        writer,
        org,
        caller.principal.id,
        {
          id: agentMessageId,
          threadId,
          rank: top + 1,
          userMessageId: target.value.userMessageId,
          agentId,
          traceId,
          requestContext: target.value.requestContext,
          maxSteps: null,
          retryKey: idempotencyKey,
        },
        prepared.value,
      ),
    );
  });
  if (!committed.ok) return committed;

  const started = await startCommitted(
    deps,
    org,
    { threadId, agentMessageId },
    traceId,
  );
  return started.ok ? ok({ agentMessageId }) : started;
}
