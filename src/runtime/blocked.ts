import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import type { Db, OrgId } from '../db/index.ts';
import { requireAgentUse } from '../agents/index.ts';
import type { Authz, Caller } from '../identity/index.ts';
import { ActionStatus } from './actions.ts';
import { effectiveStake } from './approval.ts';
import { selectNewestStatus } from './messages.ts';
import { JsonValueSchema } from './request-context.ts';
import type { JsonValue } from './request-context.ts';
import { BlockKind, MessageStatus } from './status.ts';
import { runtimeView } from './tables.ts';

export type Stake = ReturnType<typeof effectiveStake>;

/** What a person needs to judge one waiting action. The pointers stay in the store. */
export interface BlockedAction {
  readonly actionId: string;
  readonly agentMessageId: string;
  readonly toolKey: string;
  readonly implementationVersion: number;
  readonly kind: BlockKind;
  readonly reason: string;
  readonly stake: Stake;
  readonly arguments: JsonValue;
  readonly expiresAt: Date;
}

export interface ListBlockedDeps {
  readonly db: Db;
  readonly authz: Authz;
}

export const notFound = (what: string) =>
  err(appError(ErrorCode.not_found, `${what} not found`));

const invalidStored = () =>
  err(appError(ErrorCode.internal, 'stored action is invalid'));

const StakeSnapshotSchema = z.object({
  entry: z.object({ approval: z.string() }),
  approval: z.unknown(),
});

/** The stake of an action, from the snapshot written with it. */
export function stakeOf(snapshot: unknown): Result<Stake> {
  const parsed = StakeSnapshotSchema.safeParse(snapshot);
  return parsed.success ? ok(effectiveStake(parsed.data)) : invalidStored();
}

/** D1 step 1: another principal's thread reads as `not_found`. */
export async function requireOwnThread(
  db: Db,
  org: OrgId,
  caller: Caller,
  threadId: string,
): Promise<Result<void>> {
  const thread = await runtimeView(db)
    .selectFrom('thread')
    .select('created_by')
    .where('org_id', '=', org)
    .where('id', '=', threadId)
    .executeTakeFirst();
  return thread?.created_by === caller.principal.id
    ? ok(undefined)
    : notFound('thread');
}

function knownBlockKind(value: string | null): BlockKind | undefined {
  return Object.values(BlockKind).find((kind) => kind === value);
}

/**
 * D7: the actions of the thread's newest agent message that wait on a person, in
 * call order. Empty when that message is not `paused`. Checks use at its pin.
 */
export async function listBlocked(
  deps: ListBlockedDeps,
  caller: Caller,
  org: OrgId,
  threadId: string,
): Promise<Result<BlockedAction[]>> {
  const { db, authz } = deps;
  const own = await requireOwnThread(db, org, caller, threadId);
  if (!own.ok) return own;

  const q = runtimeView(db);
  const message = await q
    .selectFrom('message')
    .select(['id', 'agent_id', 'agent_version'])
    .where('org_id', '=', org)
    .where('thread_id', '=', threadId)
    .where('role', '=', 'agent')
    .orderBy('rank', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (message?.agent_id == null || message.agent_version === null) {
    return ok([]);
  }

  const allowed = await requireAgentUse(
    authz,
    org,
    caller,
    message.agent_id,
    message.agent_version,
  );
  if (!allowed.ok) return allowed;
  return blockedActions(db, org, message.id);
}

/** The blocked actions of one agent message. No authz: the caller checked use. */
export async function blockedActions(
  db: Db,
  org: OrgId,
  messageId: string,
): Promise<Result<BlockedAction[]>> {
  const q = runtimeView(db);
  const newest = await selectNewestStatus(q, org, messageId);
  if (newest?.status !== MessageStatus.paused) return ok([]);
  const paused = await q
    .selectFrom('message_status')
    .select('expires_at')
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .where('seq', '=', newest.seq)
    .executeTakeFirstOrThrow();
  if (paused.expires_at === null) return invalidStored();

  const actions = await q
    .selectFrom('action')
    .select([
      'id',
      'tool_key',
      'implementation_version',
      'arguments',
      'config_snapshot',
    ])
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .orderBy('step_index', 'asc')
    .orderBy('call_index', 'asc')
    .execute();
  if (actions.length === 0) return ok([]);
  const statuses = await q
    .selectFrom('action_status')
    .select(['action_id', 'seq', 'status', 'reason', 'block_kind'])
    .where('org_id', '=', org)
    .where(
      'action_id',
      'in',
      actions.map((action) => action.id),
    )
    .orderBy('seq', 'desc')
    .execute();

  const list: BlockedAction[] = [];
  for (const action of actions) {
    const row = statuses.find((status) => status.action_id === action.id);
    if (row?.status !== ActionStatus.blocked) continue;
    const kind = knownBlockKind(row.block_kind);
    const args = JsonValueSchema.safeParse(action.arguments);
    const stake = stakeOf(action.config_snapshot);
    if (
      kind === undefined ||
      row.reason === null ||
      action.implementation_version === null ||
      !args.success ||
      !stake.ok
    ) {
      return invalidStored();
    }
    list.push({
      actionId: action.id,
      agentMessageId: messageId,
      toolKey: action.tool_key,
      implementationVersion: action.implementation_version,
      kind,
      reason: row.reason,
      stake: stake.value,
      arguments: args.data,
      expiresAt: paused.expires_at,
    });
  }
  return ok(list);
}
