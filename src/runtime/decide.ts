import { sql } from 'kysely';
import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Logger, Result } from '../index.ts';
import {
  appendIfNewest,
  withTables,
  withTransaction,
  writeAudit,
} from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import type { Runners, TurnRef } from '../runner/index.ts';
import {
  canonicalHash,
  loadVersion,
  requireAgentUse,
} from '../agents/index.ts';
import { ServingStatus, servingStatus } from '../catalog/index.ts';
import type { Authz, Caller } from '../identity/index.ts';
import {
  newestPolicies,
  RecheckKind,
  recheckResolution,
  ResolutionMethod,
} from '../models/index.ts';
import type { ResolutionRecheck } from '../models/index.ts';
import { ActionStatus, appendActionStatus } from './actions.ts';
import { Approval } from './approval.ts';
import { RUNTIME_AUDIT } from './audit-kinds.ts';
import { notFound, requireOwnThread, stakeOf } from './blocked.ts';
import type { Stake } from './blocked.ts';
import { requireToolInvoke } from './edge.ts';
import { loadAgentMessage, newestResolution } from './messages.ts';
import { BlockKind, MessageStatus } from './status.ts';
import { nextStreamSeq } from './stream.ts';
import type { StartConfig } from './start.ts';
import { withTurnOwner } from './stop.ts';
import { runtimeView } from './tables.ts';
import type { RuntimeTables } from './tables.ts';

export interface DecideDeps {
  readonly db: Db;
  readonly authz: Authz;
  readonly runners: Runners;
  readonly config: StartConfig;
  readonly log: Logger;
}

export const Verdict = {
  approve: 'approve',
  deny: 'deny',
} as const;
export type Verdict = (typeof Verdict)[keyof typeof Verdict];

export const ActionReason = {
  approved: 'approved',
  denied: 'denied',
} as const;

const MessageReason = {
  resumed: 'resumed',
} as const;

const FailureReason = {
  message_finished: 'message_finished',
  stop_requested: 'stop_requested',
  resume_in_progress: 'resume_in_progress',
  message_expired: 'message_expired',
  action_decided: 'action_decided',
  model_disabled: 'model_disabled',
  tool_version_unavailable: 'tool_version_unavailable',
} as const;

export interface Decision {
  readonly verdict: Verdict;
  readonly remember?: boolean;
}

const DecisionSchema = z.strictObject({
  verdict: z.enum(Verdict),
  remember: z.boolean().optional(),
});

const ActionIdSchema = z.uuid();

/** `approval_memory.args_hash` when the row approves the whole key. */
const PER_KEY_ARGS_HASH = '';

const DENIED_TEXT = `${ActionReason.denied}: a person denied this tool call`;

type ResumeResolution = Exclude<
  ResolutionRecheck,
  { readonly kind: typeof RecheckKind.none_enabled }
>;

const invalid = (message: string) =>
  err(appError(ErrorCode.invalid_argument, message));
const exists = (reason: string) =>
  err(appError(ErrorCode.already_exists, reason));
const aborted = (reason: string) => err(appError(ErrorCode.aborted, reason));
const unavailable = (reason: string) =>
  err(appError(ErrorCode.unavailable, reason));

/** The `args_hash` of the memory row a decision writes. */
function memoryHash(stake: Stake, args: unknown): string {
  return stake === Approval.low ? PER_KEY_ARGS_HASH : canonicalHash(args);
}

interface Target {
  readonly actionId: string;
  readonly messageId: string;
  readonly threadId: string;
  readonly agentId: string;
  readonly agentVersion: number;
  readonly traceId: string;
  readonly toolKey: string;
  readonly implementationVersion: number | null;
  readonly arguments: unknown;
  readonly stake: Stake;
}

/** The action, its message pin, and its stake. `not_found` for an unknown id. */
async function loadTarget(
  db: Db,
  org: OrgId,
  actionId: string,
): Promise<Result<Target>> {
  const action = await runtimeView(db)
    .selectFrom('action')
    .select([
      'message_id',
      'tool_key',
      'implementation_version',
      'arguments',
      'config_snapshot',
    ])
    .where('org_id', '=', org)
    .where('id', '=', actionId)
    .executeTakeFirst();
  if (action === undefined) return notFound('action');
  const pin = await loadAgentMessage(db, org, action.message_id);
  if (!pin.ok) return pin;
  const stake = stakeOf(action.config_snapshot);
  if (!stake.ok) return stake;
  return ok({
    actionId,
    messageId: action.message_id,
    threadId: pin.value.threadId,
    agentId: pin.value.agentId,
    agentVersion: pin.value.agentVersion,
    traceId: pin.value.traceId,
    toolKey: action.tool_key,
    implementationVersion: action.implementation_version,
    arguments: action.arguments,
    stake: stake.value,
  });
}

/**
 * D1: the thread rule and CheckAgentUse at the pin. An approve adds the caller's
 * `tool:invoke` on every tool of the pinned version (L3).
 */
async function authorize(
  deps: DecideDeps,
  caller: Caller,
  org: OrgId,
  target: Target,
  verdict: Decision['verdict'],
): Promise<Result<void>> {
  const { db, authz } = deps;
  const own = await requireOwnThread(db, org, caller, target.threadId);
  if (!own.ok) return own;
  const use = await requireAgentUse(
    authz,
    org,
    caller,
    target.agentId,
    target.agentVersion,
  );
  if (!use.ok) return use;
  if (verdict === Verdict.deny) return ok(undefined);
  const version = await loadVersion(
    db,
    org,
    target.agentId,
    target.agentVersion,
  );
  if (!version.ok) return version;
  return requireToolInvoke(
    authz,
    org,
    caller,
    version.value.definition.tools.map((tool) => tool.key),
  );
}

/** `remember` is for an approved `approval` block of a `low` or `medium` call. */
export async function checkRemember(
  db: Db,
  org: OrgId,
  target: { readonly actionId: string; readonly stake: Stake },
): Promise<Result<void>> {
  const row = await runtimeView(db)
    .selectFrom('action_status')
    .select(['status', 'block_kind'])
    .where('org_id', '=', org)
    .where('action_id', '=', target.actionId)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
  // Not blocked: the `Tx` answers `action_decided`.
  if (row?.status !== ActionStatus.blocked) return ok(undefined);
  if (
    row.block_kind !== BlockKind.approval ||
    (target.stake !== Approval.low && target.stake !== Approval.medium)
  ) {
    return invalid('remember: not allowed for this action');
  }
  return ok(undefined);
}

/**
 * P5.3 D9 (amended): an approve needs a serving row for the pair, `served` or
 * `draining`. Retire waits on a paused pin, so a draining pair still runs.
 */
async function requireServing(
  db: Db,
  org: OrgId,
  target: Target,
): Promise<Result<void>> {
  const { toolKey, implementationVersion } = target;
  const status =
    implementationVersion === null
      ? null
      : await servingStatus(db, org, toolKey, implementationVersion);
  if (
    status === ServingStatus.enum.served ||
    status === ServingStatus.enum.draining
  ) {
    return ok(undefined);
  }
  return unavailable(FailureReason.tool_version_unavailable);
}

/** D4: `none_enabled` is `unavailable`; a fallback is stored in the `Tx`. */
async function recheckModel(
  db: Db,
  org: OrgId,
  target: Target,
): Promise<Result<ResumeResolution>> {
  const stored = await newestResolution(db, org, target.messageId);
  if (!stored.ok) return stored;
  const version = await loadVersion(
    db,
    org,
    target.agentId,
    target.agentVersion,
  );
  if (!version.ok) return version;
  const { fallbacks } = version.value.definition;
  const policies = await newestPolicies(db, org, [stored.value, ...fallbacks]);
  const rechecked = recheckResolution(policies, stored.value, fallbacks);
  if (rechecked.kind === RecheckKind.none_enabled) {
    return unavailable(FailureReason.model_disabled);
  }
  return ok(rechecked);
}

/** D2 step 1: the message is `paused`, has no stop, and is within its deadline. */
async function requirePaused(
  tx: Tx,
  org: OrgId,
  messageId: string,
): Promise<Result<number>> {
  const q = withTables<RuntimeTables>(tx);
  const newest = await q
    .selectFrom('message_status')
    .select(['seq', 'status', sql<boolean>`expires_at <= now()`.as('past')])
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (newest === undefined) return notFound('message');
  if (
    newest.status !== MessageStatus.created &&
    newest.status !== MessageStatus.paused
  ) {
    return exists(FailureReason.message_finished);
  }
  const stop = await q
    .selectFrom('stop_requested')
    .select('kind')
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .executeTakeFirst();
  if (stop !== undefined) return exists(FailureReason.stop_requested);
  if (newest.status === MessageStatus.created) {
    return aborted(FailureReason.resume_in_progress);
  }
  if (newest.past) return exists(FailureReason.message_expired);
  return ok(newest.seq);
}

/** D2 step 6: the deadline against the wall clock, then the one append that serializes. */
async function resumeMessage(
  tx: Tx,
  org: OrgId,
  messageId: string,
  pausedSeq: number,
): Promise<Result<void>> {
  const clock = await sql<{ past: boolean | null }>`
    select clock_timestamp() >= expires_at as past from message_status
    where org_id = ${org} and message_id = ${messageId} and seq = ${pausedSeq}
  `.execute(tx);
  if (clock.rows[0]?.past === true) {
    return exists(FailureReason.message_expired);
  }
  const appended = await appendIfNewest<RuntimeTables, 'message_status'>(
    withTables<RuntimeTables>(tx),
    {
      table: 'message_status',
      org,
      key: { message_id: messageId },
      accept: (newest) =>
        newest?.seq === pausedSeq && newest.status === MessageStatus.paused,
      row: () => ({
        message_id: messageId,
        status: MessageStatus.created,
        reason: MessageReason.resumed,
      }),
    },
  );
  return appended.ok
    ? ok(undefined)
    : aborted(FailureReason.resume_in_progress);
}

interface Choice {
  readonly verdict: Decision['verdict'];
  readonly remember: boolean;
  readonly resolution: ResumeResolution;
}

/** D2 steps 2–5: the action's `blocked` row answered by a decision, the audit row. */
async function writeDecision(
  tx: Tx,
  org: OrgId,
  caller: Caller,
  target: Target,
  choice: Choice,
): Promise<Result<void>> {
  const { actionId } = target;
  const q = withTables<RuntimeTables>(tx);
  const blocked = await q
    .selectFrom('action_status')
    .selectAll()
    .where('org_id', '=', org)
    .where('action_id', '=', actionId)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (blocked?.status !== ActionStatus.blocked) {
    return exists(FailureReason.action_decided);
  }

  const who = caller.principal.id;
  const inserted = await q
    .insertInto('action_decision')
    .values({
      org_id: org,
      action_id: actionId,
      blocked_seq: blocked.seq,
      verdict: choice.verdict,
      remember: choice.remember,
      decided_by: who,
    })
    .onConflict((conflict) =>
      conflict.columns(['org_id', 'action_id', 'blocked_seq']).doNothing(),
    )
    .executeTakeFirst();
  if (inserted.numInsertedOrUpdatedRows === 0n) {
    return exists(FailureReason.action_decided);
  }

  const isBlocked = (newest: string | undefined) =>
    newest === ActionStatus.blocked;
  if (choice.verdict === Verdict.approve) {
    const approved = await appendActionStatus(tx, org, actionId, isBlocked, {
      status: ActionStatus.created,
      reason: ActionReason.approved,
      attempt: null,
      resumePointer: blocked.resume_pointer,
      blockKind: blocked.block_kind,
      blockPointer: blocked.block_pointer,
    });
    if (!approved.ok) return approved;
  } else {
    const denied = await appendActionStatus(tx, org, actionId, isBlocked, {
      status: ActionStatus.errored,
      reason: ActionReason.denied,
      attempt: null,
      resumePointer: null,
    });
    if (!denied.ok) return denied;
    await q
      .insertInto('action_output')
      .values({
        org_id: org,
        action_id: actionId,
        model_text: DENIED_TEXT,
        is_error: true,
        truncated: false,
        object_id: null,
        stream_seq: await nextStreamSeq(tx, org, 'message', target.messageId),
      })
      .execute();
  }

  if (choice.resolution.kind === RecheckKind.fallback) {
    const model = choice.resolution.choice;
    const stored = await appendIfNewest<RuntimeTables, 'model_resolution'>(q, {
      table: 'model_resolution',
      org,
      key: { message_id: target.messageId },
      accept: () => true,
      row: () => ({
        message_id: target.messageId,
        provider: model.provider,
        model: model.model,
        reasoning_effort: model.reasoningEffort,
        method: ResolutionMethod.fallback,
      }),
    });
    if (!stored.ok) return aborted(FailureReason.resume_in_progress);
  }
  if (choice.remember) {
    await q
      .insertInto('approval_memory')
      .values({
        org_id: org,
        agent_id: target.agentId,
        tool_key: target.toolKey,
        args_hash: memoryHash(target.stake, target.arguments),
        action_id: actionId,
        decided_by: who,
      })
      .onConflict((conflict) =>
        conflict
          .columns(['org_id', 'agent_id', 'tool_key', 'args_hash'])
          .doNothing(),
      )
      .execute();
  }
  return writeAudit(tx, org, {
    kind: RUNTIME_AUDIT.approvalDecided,
    actor: { kind: caller.principal.kind, id: who },
    target: { kind: 'action', id: actionId },
    traceId: target.traceId,
  });
}

/**
 * D1–D5, D9: checks, then one `Tx` that decides the action and resumes the
 * message, then the same workflow id starts again. A start that fails after
 * commit is still `ok`: the message is `created` and the reaper starts it.
 */
export async function decide(
  deps: DecideDeps,
  caller: Caller,
  org: OrgId,
  actionId: string,
  decision: Decision,
): Promise<Result<void>> {
  const { db } = deps;
  const id = ActionIdSchema.safeParse(actionId);
  const parsed = DecisionSchema.safeParse(decision);
  if (!id.success) return invalid('actionId: invalid');
  if (!parsed.success) return invalid('decision: invalid');
  const { verdict, remember = false } = parsed.data;
  if (remember && verdict === Verdict.deny) {
    return invalid('remember: not allowed with a deny');
  }

  const target = await loadTarget(db, org, id.data);
  if (!target.ok) return target;
  const allowed = await authorize(deps, caller, org, target.value, verdict);
  if (!allowed.ok) return allowed;
  if (remember) {
    const checked = await checkRemember(db, org, target.value);
    if (!checked.ok) return checked;
  }
  if (verdict === Verdict.approve) {
    const serving = await requireServing(db, org, target.value);
    if (!serving.ok) return serving;
  }
  const resolution = await recheckModel(db, org, target.value);
  if (!resolution.ok) return resolution;

  const committed = await withTransaction(db, async (tx) => {
    const pausedSeq = await requirePaused(tx, org, target.value.messageId);
    if (!pausedSeq.ok) return pausedSeq;
    const written = await writeDecision(tx, org, caller, target.value, {
      verdict,
      remember,
      resolution: resolution.value,
    });
    if (!written.ok) return written;
    return resumeMessage(tx, org, target.value.messageId, pausedSeq.value);
  });
  if (!committed.ok) return committed;

  const { threadId, messageId, traceId } = target.value;
  const ref: TurnRef = {
    org,
    threadId,
    agentMessageId: messageId,
    traceId,
  };
  try {
    const woke = await withTurnOwner(deps, ref, (runner, tx) =>
      runner.wakeDecision(tx, ref, target.value.actionId),
    );
    if (!woke.ok) {
      deps.log.warn(
        { err: woke.error.cause, agentMessageId: messageId },
        'resume start failed after commit',
      );
    }
  } catch (e) {
    deps.log.warn(
      { err: e, agentMessageId: messageId },
      'resume start failed after commit',
    );
  }
  return ok(undefined);
}
