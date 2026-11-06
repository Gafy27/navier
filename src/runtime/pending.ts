import type { withTables } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';
import type { AgentDefinition } from '../agents/index.ts';
import type { ModelResolution } from '../models/index.ts';
import { selectNewestStatus } from './messages.ts';
import type { Reader } from './messages.ts';
import type { RequestContext } from './request-context.ts';
import { MessageStatus } from './status.ts';
import type { RuntimeTables } from './tables.ts';

export type Writer = ReturnType<typeof withTables<RuntimeTables>>;

export type ResolvedModel = Extract<ModelResolution, { kind: 'resolved' }>;

/** What a new agent message pins: the version, its tools, and the resolved model. */
export interface PreparedTurn {
  readonly tools: AgentDefinition['tools'];
  readonly version: number;
  readonly resolved: ResolvedModel;
}

/** The newest agent message of a thread while it is `created` or `paused` (D2). */
export interface OpenAgent {
  readonly id: string;
  readonly agentId: string;
  readonly status: typeof MessageStatus.created | typeof MessageStatus.paused;
}

/** A user row never decides: only the newest **agent** message does. */
export async function openAgent(
  q: Reader,
  org: OrgId,
  threadId: string,
): Promise<OpenAgent | undefined> {
  const newest = await q
    .selectFrom('message')
    .select(['id', 'agent_id'])
    .where('org_id', '=', org)
    .where('thread_id', '=', threadId)
    .where('role', '=', 'agent')
    .orderBy('rank', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (newest?.agent_id == null) return undefined;
  const status = (await selectNewestStatus(q, org, newest.id))?.status;
  return status === MessageStatus.created || status === MessageStatus.paused
    ? { id: newest.id, agentId: newest.agent_id, status }
    : undefined;
}

/** The highest rank of any message in the thread; 0 when it has none. */
export async function topRank(
  q: Reader,
  org: OrgId,
  threadId: string,
): Promise<number> {
  const top = await q
    .selectFrom('message')
    .select('rank')
    .where('org_id', '=', org)
    .where('thread_id', '=', threadId)
    .orderBy('rank', 'desc')
    .limit(1)
    .executeTakeFirst();
  return top?.rank ?? 0;
}

/** What a pending message will run under, checked at post time (PD4). */
export interface PendingPlan {
  readonly agentId: string;
  readonly prepared: PreparedTurn;
  readonly requestContext: RequestContext;
  readonly maxSteps: number | null;
}

/** One `pending_message` row for the user message `userMessageId` (D1). */
export async function insertPending(
  q: Writer,
  org: OrgId,
  userMessageId: string,
  threadId: string,
  plan: PendingPlan,
): Promise<void> {
  const { prepared } = plan;
  await q
    .insertInto('pending_message')
    .values({
      org_id: org,
      user_message_id: userMessageId,
      thread_id: threadId,
      agent_id: plan.agentId,
      agent_version: prepared.version,
      tools: JSON.stringify(prepared.tools),
      provider: prepared.resolved.choice.provider,
      model: prepared.resolved.choice.model,
      reasoning_effort: prepared.resolved.choice.reasoningEffort,
      method: prepared.resolved.method,
      request_context: plan.requestContext,
      max_steps: plan.maxSteps,
    })
    .execute();
}

export type PendingState =
  | { readonly kind: 'open' }
  | { readonly kind: 'promoted'; readonly agentMessageId: string }
  | { readonly kind: 'dropped'; readonly reason: string };

/** `undefined` when `userMessageId` was never a pending message. */
export async function pendingState(
  q: Reader,
  org: OrgId,
  userMessageId: string,
): Promise<PendingState | undefined> {
  const row = await q
    .selectFrom('pending_message')
    .leftJoin('pending_close', (join) =>
      join
        .onRef('pending_close.org_id', '=', 'pending_message.org_id')
        .onRef(
          'pending_close.user_message_id',
          '=',
          'pending_message.user_message_id',
        ),
    )
    .select(['pending_close.agent_message_id', 'pending_close.dropped_reason'])
    .where('pending_message.org_id', '=', org)
    .where('pending_message.user_message_id', '=', userMessageId)
    .executeTakeFirst();
  if (row === undefined) return undefined;
  if (row.agent_message_id !== null) {
    return { kind: 'promoted', agentMessageId: row.agent_message_id };
  }
  return row.dropped_reason === null
    ? { kind: 'open' }
    : { kind: 'dropped', reason: row.dropped_reason };
}

/** Every open pending message of the thread, in rank order (D5 step 2). */
export async function openPendingPlans(
  q: Reader,
  org: OrgId,
  threadId: string,
): Promise<
  readonly {
    readonly userMessageId: string;
    readonly rank: number;
    readonly plan: PendingPlan;
  }[]
> {
  const rows = await q
    .selectFrom('pending_message')
    .innerJoin('message', (join) =>
      join
        .onRef('message.org_id', '=', 'pending_message.org_id')
        .onRef('message.id', '=', 'pending_message.user_message_id'),
    )
    .leftJoin('pending_close', (join) =>
      join
        .onRef('pending_close.org_id', '=', 'pending_message.org_id')
        .onRef(
          'pending_close.user_message_id',
          '=',
          'pending_message.user_message_id',
        ),
    )
    .select([
      'pending_message.user_message_id',
      'pending_message.agent_id',
      'pending_message.agent_version',
      'pending_message.tools',
      'pending_message.provider',
      'pending_message.model',
      'pending_message.reasoning_effort',
      'pending_message.method',
      'pending_message.request_context',
      'pending_message.max_steps',
      'message.rank',
    ])
    .where('pending_message.org_id', '=', org)
    .where('pending_message.thread_id', '=', threadId)
    .where('pending_close.user_message_id', 'is', null)
    .orderBy('message.rank')
    .execute();
  return rows.map((row) => ({
    userMessageId: row.user_message_id,
    rank: row.rank,
    plan: {
      agentId: row.agent_id,
      prepared: {
        tools: row.tools,
        version: row.agent_version,
        resolved: {
          kind: 'resolved',
          choice: {
            provider: row.provider,
            model: row.model,
            reasoningEffort: row.reasoning_effort,
          },
          method: row.method,
        },
      },
      requestContext: row.request_context,
      maxSteps: row.max_steps,
    },
  }));
}

/** How a pending message closes: promoted to an agent message, or dropped with a reason. */
export type PendingClose =
  | { readonly kind: 'promoted'; readonly agentMessageId: string }
  | { readonly kind: 'dropped'; readonly reason: string };

/** One `pending_close` row. The table's check constraint is the guard; no rule here. */
export async function insertPendingClose(
  q: Writer,
  org: OrgId,
  userMessageId: string,
  close: PendingClose,
): Promise<void> {
  await q
    .insertInto('pending_close')
    .values({
      org_id: org,
      user_message_id: userMessageId,
      agent_message_id: close.kind === 'promoted' ? close.agentMessageId : null,
      dropped_reason: close.kind === 'dropped' ? close.reason : null,
    })
    .execute();
}
