import { randomUUID } from 'node:crypto';
import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import { withTables, withTransaction } from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import { SCOPE_GRAMMAR } from '../identity/index.ts';
import type { Authz, Caller } from '../identity/index.ts';
import {
  assertAcceptsNewMessage,
  parseStoredDefinition,
  useAgent,
} from '../agents/index.ts';
import { checkServed } from '../catalog/index.ts';
import { ModelChoiceSchema, resolveModel } from '../models/index.ts';
import type { ModelChoice } from '../models/index.ts';
import { requireToolInvoke } from './edge.ts';
import { lockConversation } from './lock.ts';
import { selectPin } from './messages.ts';
import type { Reader } from './messages.ts';
import { MessageRole } from './pins.ts';
import { insertPending, openAgent, pendingState, topRank } from './pending.ts';
import type { PreparedTurn, Writer } from './pending.ts';
import { parseRequestContext } from './request-context.ts';
import type { RequestContext } from './request-context.ts';
import { MessageStatus } from './status.ts';
import { appendConversationEvent } from './stream.ts';
import type { RuntimeTables } from './tables.ts';

export interface PostDeps {
  readonly db: Db;
  readonly authz: Authz;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const UNIQUE_VIOLATION = '23505';

function hasPgCode(e: unknown, code: string): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === code;
}

const uuid = z.string().regex(UUID);
const TurnInputSchema = z.strictObject({
  threadId: uuid,
  agentId: z.string().refine((id) => SCOPE_GRAMMAR.agent.validId(id)),
  agentMessageId: uuid,
  userMessage: z.strictObject({ id: uuid, text: z.string().min(1) }),
  requestContext: z.unknown(),
  modelSelection: ModelChoiceSchema.optional(),
  maxSteps: z.number().int().min(1).optional(),
});

export type TurnInput = z.input<typeof TurnInputSchema>;

const invalid = (message: string) =>
  err(appError(ErrorCode.invalid_argument, message));

/** Step 1 of D6. The error names the first bad field, never its value. */
function parseInput(input: TurnInput): Result<{
  input: z.output<typeof TurnInputSchema>;
  context: RequestContext;
}> {
  const parsed = TurnInputSchema.safeParse(input);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.join('.') ?? '';
    return invalid(`${path === '' ? 'input' : path}: invalid`);
  }
  const context = parseRequestContext(parsed.data.requestContext);
  if (!context.ok) return context;
  return ok({ input: parsed.data, context: context.value });
}

interface Plan {
  readonly input: TurnInput;
  readonly context: RequestContext;
  readonly prepared: PreparedTurn;
}

const aborted = (message: string, cause?: unknown) =>
  err(appError(ErrorCode.aborted, message, cause));

/**
 * The checks between the parse and the transaction (D6 steps 2–4): agent use,
 * the stored version, each tool's invoke scope, the `maxSteps` bound, the model.
 * The version pinned is the one `CheckAgentUse` named, never the active default (D4).
 */
export async function prepareTurn(
  deps: PostDeps,
  caller: Caller,
  org: OrgId,
  agentId: string,
  selection: ModelChoice | undefined,
  maxSteps: number | undefined,
): Promise<Result<PreparedTurn>> {
  const stored = await useAgent(deps, caller, org, agentId);
  if (!stored.ok) return stored;
  const definition = parseStoredDefinition(stored.value.version.definition);
  if (!definition.ok) {
    return err(appError(ErrorCode.internal, 'stored version is invalid'));
  }
  const invokes = await requireToolInvoke(
    deps.authz,
    org,
    caller,
    definition.value.tools.map((tool) => tool.key),
  );
  if (!invokes.ok) return invokes;
  const limit = definition.value.limits.maxSteps;
  if (maxSteps !== undefined && maxSteps > limit) {
    return invalid('maxSteps: above the version limit');
  }

  const resolved = await resolveModel(
    deps.db,
    org,
    selection,
    definition.value,
  );
  if (resolved.kind === 'none_enabled') return invalid('model_none_enabled');
  return ok({
    tools: definition.value.tools,
    version: stored.value.version.number,
    resolved,
  });
}

/** In the `Tx`, before any row: the agent still accepts `prepared.version` and every tool is served. */
export async function acceptTurn(
  tx: Tx,
  org: OrgId,
  agentId: string,
  prepared: PreparedTurn,
): Promise<Result<void>> {
  const accepts = await assertAcceptsNewMessage(
    tx,
    org,
    agentId,
    prepared.version,
  );
  if (!accepts.ok) return accepts;
  return checkServed(tx, org, prepared.tools);
}

/** Runs the row writes. A rank collision is `aborted 'lost the race to post'` (C6); anything else throws. */
export async function writeUnlessRaced(
  write: () => Promise<void>,
): Promise<Result<void>> {
  try {
    await write();
  } catch (e) {
    if (hasPgCode(e, UNIQUE_VIOLATION)) {
      return aborted('lost the race to post', e);
    }
    throw e;
  }
  return ok(undefined);
}

/** The user message row of a turn. */
export async function insertUserMessage(
  q: Writer,
  org: OrgId,
  who: string,
  row: {
    readonly id: string;
    readonly threadId: string;
    readonly rank: number;
    readonly text: string;
  },
): Promise<void> {
  await q
    .insertInto('message')
    .values({
      org_id: org,
      id: row.id,
      thread_id: row.threadId,
      rank: row.rank,
      role: MessageRole.enum.user,
      text: row.text,
      user_message_id: null,
      agent_id: null,
      agent_version: null,
      trace_id: null,
      request_context: null,
      max_steps: null,
      retry_key: null,
      created_by: who,
    })
    .execute();
  await appendConversationEvent(q, org, row.threadId, {
    kind: 'message',
    messageId: row.id,
    payload: {},
  });
}

/** The agent message row, its `created` status, and its first model resolution. */
export async function insertAgentMessage(
  q: Writer,
  org: OrgId,
  who: string,
  row: {
    readonly id: string;
    readonly threadId: string;
    readonly rank: number;
    readonly userMessageId: string;
    readonly agentId: string;
    readonly traceId: string;
    readonly requestContext: RequestContext;
    readonly maxSteps: number | null;
    readonly retryKey: string | null;
  },
  prepared: PreparedTurn,
): Promise<void> {
  await q
    .insertInto('message')
    .values({
      org_id: org,
      id: row.id,
      thread_id: row.threadId,
      rank: row.rank,
      role: MessageRole.enum.agent,
      text: null,
      user_message_id: row.userMessageId,
      agent_id: row.agentId,
      agent_version: prepared.version,
      trace_id: row.traceId,
      request_context: row.requestContext,
      max_steps: row.maxSteps,
      retry_key: row.retryKey,
      created_by: who,
    })
    .execute();
  await appendConversationEvent(q, org, row.threadId, {
    kind: 'message',
    messageId: row.id,
    payload: {},
  });
  await q
    .insertInto('message_status')
    .values({
      org_id: org,
      message_id: row.id,
      seq: 1,
      status: MessageStatus.created,
      reason: null,
    })
    .execute();
  await q
    .insertInto('model_resolution')
    .values({
      org_id: org,
      message_id: row.id,
      seq: 1,
      provider: prepared.resolved.choice.provider,
      model: prepared.resolved.choice.model,
      reasoning_effort: prepared.resolved.choice.reasoningEffort,
      method: prepared.resolved.method,
    })
    .execute();
}

/** The rows of one new turn. `rank` is the user message's; the agent message is `rank + 1`. */
async function insertRows(
  q: Writer,
  org: OrgId,
  who: string,
  plan: Plan,
  thread: { readonly created_by: string } | undefined,
  rank: number,
  traceId: string,
): Promise<void> {
  const { input, context, prepared } = plan;
  if (thread === undefined) {
    await q
      .insertInto('thread')
      .values({ org_id: org, id: input.threadId, created_by: who })
      .execute();
  }
  await insertUserMessage(q, org, who, {
    id: input.userMessage.id,
    threadId: input.threadId,
    rank,
    text: input.userMessage.text,
  });
  await insertAgentMessage(
    q,
    org,
    who,
    {
      id: input.agentMessageId,
      threadId: input.threadId,
      rank: rank + 1,
      userMessageId: input.userMessage.id,
      agentId: input.agentId,
      traceId,
      requestContext: context,
      maxSteps: input.maxSteps ?? null,
      retryKey: null,
    },
    prepared,
  );
}

export type PostedTurn =
  | {
      readonly kind: 'started';
      readonly traceId: string;
      readonly fresh: boolean;
    }
  /** `agentMessageId` is the running one. */
  | {
      readonly kind: 'pending';
      readonly userMessageId: string;
      readonly agentMessageId: string;
    };

/**
 * PD2: the thread's row, or `undefined` for a thread not written yet. A thread
 * of another creator is `not_found`.
 */
export async function requireThreadOwner(
  q: Reader,
  org: OrgId,
  threadId: string,
  who: string,
): Promise<Result<{ readonly created_by: string } | undefined>> {
  const thread = await q
    .selectFrom('thread')
    .select('created_by')
    .where('org_id', '=', org)
    .where('id', '=', threadId)
    .executeTakeFirst();
  if (thread !== undefined && thread.created_by !== who) {
    return err(appError(ErrorCode.not_found, 'thread not found'));
  }
  return ok(thread);
}

/**
 * D2 pending arm: a user message and its plan, no agent message. A replay of an
 * open pending message writes nothing. `input.agentMessageId` is ignored.
 */
async function writePending(
  q: Writer,
  org: OrgId,
  who: string,
  plan: Plan,
  runningAgentMessageId: string,
): Promise<Result<PostedTurn>> {
  const { input, context, prepared } = plan;
  const pending = {
    kind: 'pending',
    userMessageId: input.userMessage.id,
    agentMessageId: runningAgentMessageId,
  } as const;
  const taken = await q
    .selectFrom('message')
    .select(['thread_id', 'text'])
    .where('org_id', '=', org)
    .where('id', '=', input.userMessage.id)
    .executeTakeFirst();
  if (taken !== undefined) {
    const state = await pendingState(q, org, input.userMessage.id);
    const replay =
      state?.kind === 'open' &&
      taken.thread_id === input.threadId &&
      taken.text === input.userMessage.text;
    return replay ? ok(pending) : invalid('userMessage.id: already used');
  }
  const written = await writeUnlessRaced(async () => {
    await insertUserMessage(q, org, who, {
      id: input.userMessage.id,
      threadId: input.threadId,
      rank: (await topRank(q, org, input.threadId)) + 1,
      text: input.userMessage.text,
    });
    await insertPending(q, org, input.userMessage.id, input.threadId, {
      agentId: input.agentId,
      prepared,
      requestContext: context,
      maxSteps: input.maxSteps ?? null,
    });
  });
  return written.ok ? ok(pending) : written;
}

/**
 * D2 started-arm replay by `agentMessageId`, before the open-agent branch. A
 * matching pin writes nothing and returns `fresh: false`; a pin with another
 * payload is invalid; no pin lets the caller continue routing.
 */
async function startedPinReplay(
  q: Writer,
  org: OrgId,
  plan: Plan,
): Promise<Result<PostedTurn> | undefined> {
  const { input } = plan;
  const existing = await selectPin(q, org, input.agentMessageId);
  if (existing === undefined) return undefined;
  const userRow = await q
    .selectFrom('message')
    .select('text')
    .where('org_id', '=', org)
    .where('id', '=', existing.userMessageId)
    .executeTakeFirst();
  if (
    existing.threadId === input.threadId &&
    existing.agentId === input.agentId &&
    existing.userMessageId === input.userMessage.id &&
    userRow?.text === input.userMessage.text
  ) {
    return ok({ kind: 'started', traceId: existing.traceId, fresh: false });
  }
  return invalid('agentMessageId: exists with another payload');
}

/** D2 started arm: today's rows, when no agent message is open. */
async function writeStarted(
  q: Writer,
  org: OrgId,
  who: string,
  plan: Plan,
  thread: { readonly created_by: string } | undefined,
): Promise<Result<PostedTurn>> {
  const { input } = plan;
  const replay = await startedPinReplay(q, org, plan);
  if (replay !== undefined) return replay;
  const taken = await q
    .selectFrom('message')
    .select('id')
    .where('org_id', '=', org)
    .where('id', '=', input.userMessage.id)
    .executeTakeFirst();
  if (taken !== undefined) return invalid('userMessage.id: already used');

  const rank = (await topRank(q, org, input.threadId)) + 1;
  const traceId = randomUUID();
  const written = await writeUnlessRaced(() =>
    insertRows(q, org, who, plan, thread, rank, traceId),
  );
  if (!written.ok) return written;
  return ok({ kind: 'started', traceId, fresh: true });
}

/** Step 5 of D6, inside the `Tx` after the lock and `acceptTurn`: the three outcomes of D2. */
async function writeTurn(
  tx: Tx,
  org: OrgId,
  caller: Caller,
  plan: Plan,
): Promise<Result<PostedTurn>> {
  const { input } = plan;
  const q = withTables<RuntimeTables>(tx);
  const who = caller.principal.id;
  const thread = await requireThreadOwner(q, org, input.threadId, who);
  if (!thread.ok) return thread;
  const replay = await startedPinReplay(q, org, plan);
  if (replay !== undefined) return replay;
  const open = await openAgent(q, org, input.threadId);
  if (open === undefined) {
    return writeStarted(q, org, who, plan, thread.value);
  }
  if (open.status !== MessageStatus.created || open.agentId !== input.agentId) {
    return aborted('thread_busy');
  }
  return writePending(q, org, who, plan, open.id);
}

/**
 * Checks, then in one transaction under the conversation lock: a started turn
 * (thread, both messages, pin, status `created`, first model resolution), a
 * pending user message while the same agent runs, or `aborted 'thread_busy'` (D2).
 * A failed check writes nothing.
 */
export async function postTurn(
  deps: PostDeps,
  caller: Caller,
  org: OrgId,
  input: TurnInput,
): Promise<Result<PostedTurn>> {
  const parsed = parseInput(input);
  if (!parsed.ok) return parsed;
  const { input: valid, context } = parsed.value;

  const prepared = await prepareTurn(
    deps,
    caller,
    org,
    valid.agentId,
    valid.modelSelection,
    valid.maxSteps,
  );
  if (!prepared.ok) return prepared;

  const plan: Plan = { input: valid, context, prepared: prepared.value };
  return withTransaction(deps.db, async (tx) => {
    await lockConversation(tx, org, valid.threadId);
    const accepts = await acceptTurn(tx, org, valid.agentId, prepared.value);
    if (!accepts.ok) return accepts;
    return writeTurn(tx, org, caller, plan);
  });
}
