import { randomUUID } from 'node:crypto';
import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import { withTables, withTransaction } from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import { canonicalHash } from '../agents/index.ts';
import type { ToolEntry } from '../catalog/index.ts';
import type { ModelAdapter, ModelChunk, ModelResponse } from '../llm/index.ts';
import { readProviderCredentials } from '../orgconfig/credentials.ts';
import { ActionStatus, appendActionStatus } from './actions.ts';
import {
  approvalVerdict,
  effectiveStake,
  rememberedApprovals,
} from './approval.ts';
import { writeObject } from './objects.ts';
import { buildPrompt, StepContentSchema } from './prompt.ts';
import type { Prompt } from './prompt.ts';
import { BlockKind } from './status.ts';
import { STORED_ATTEMPT } from './step-contract.ts';
import type {
  ModelStepArgs as StepContractArgs,
  ModelStepResult,
} from './step-contract.ts';
import { stepPlan } from './step-plan.ts';
import { appendDelta, nextStreamSeq, STREAM_CAP } from './stream.ts';
import type { StepAction } from './step-plan.ts';
import { runtimeView } from './tables.ts';
import type { RuntimeTables } from './tables.ts';
import type { RunnableAction } from './workflow-types.ts';

/** A step's identity: the key of its claim. */
export interface StepKey {
  readonly org: OrgId;
  readonly messageId: string;
  readonly stepIndex: number;
}

/**
 * D3: a runner's compensation for at-least-once step delivery. Only the Temporal
 * adapter passes one (`step_claim`); a runner that dedupes itself passes none.
 * `taken` means a later attempt or another caller holds the step.
 */
export interface StepGuard {
  claim(
    tx: Tx,
    key: StepKey,
    attempt: number,
  ): Promise<Result<'claimed' | 'taken'>>;
}

export interface ModelStepDeps {
  readonly db: Db;
  readonly model: ModelAdapter;
  readonly guard?: StepGuard;
}

export interface ModelStepArgs extends StepContractArgs {
  /** Aborts the model call. */
  readonly signal?: AbortSignal;
}

export type { ModelStepResult };

/** Postgres `unique_violation`. */
const PG_UNIQUE = '23505';

const aborted = (message: string, cause?: unknown) =>
  err(appError(ErrorCode.aborted, message, cause));

const ActionStatusSchema = z.enum(
  Object.values(ActionStatus) as [
    ActionStatus,
    ActionStatus,
    ...ActionStatus[],
  ],
);

/** The stored `config_snapshot`. `readCommitted` reads attempts from this same shape. */
const SnapshotSchema = z.object({
  entry: z.object({
    name: z.string(),
    description: z.string(),
    inputSchema: z.record(z.string(), z.unknown()),
    retryOnInterrupt: z.boolean(),
    toolAttempts: z.number().int().min(1),
    maxToolOutputBytes: z.number().int(),
    approval: z.string(),
  }),
  config: z.unknown(),
  approval: z.unknown(),
});

type ActionSnapshot = z.output<typeof SnapshotSchema>;

function actionSnapshot(
  entry: ToolEntry,
  ref: { readonly config: unknown; readonly approval: unknown },
): ActionSnapshot {
  return {
    entry: {
      name: entry.name,
      description: entry.description,
      inputSchema: entry.inputSchema,
      retryOnInterrupt: entry.retryOnInterrupt,
      toolAttempts: entry.toolAttempts,
      maxToolOutputBytes: entry.maxToolOutputBytes,
      approval: entry.approval,
    },
    config: ref.config,
    approval: ref.approval,
  };
}

/** Attempts a tool call gets: the entry's `toolAttempts` when it retries on interrupt, else one (P3.2 D3). */
function attemptsOf(entry: {
  readonly retryOnInterrupt: boolean;
  readonly toolAttempts: number;
}): number {
  return entry.retryOnInterrupt ? entry.toolAttempts : 1;
}

function noToolCalls(toolCalls: readonly unknown[]): boolean {
  return toolCalls.length === 0;
}

/**
 * Step 1 of D5: the committed step's plan, or `undefined` when no step row
 * exists. Reads each action's newest status; `approved` is an approve decision
 * on its newest `blocked` row. Exported for `loadTurn`.
 */
export async function readCommitted(
  db: Db,
  org: OrgId,
  messageId: string,
  stepIndex: number,
): Promise<Result<ModelStepResult> | undefined> {
  const q = runtimeView(db);
  const step = await q
    .selectFrom('step')
    .select('content')
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .where('step_index', '=', stepIndex)
    .executeTakeFirst();
  if (step === undefined) return undefined;
  const content = StepContentSchema.safeParse(step.content);
  if (!content.success) {
    return err(appError(ErrorCode.internal, 'stored step is invalid'));
  }
  const actions = await q
    .selectFrom('action')
    .select(['id', 'config_snapshot'])
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .where('step_index', '=', stepIndex)
    .orderBy('call_index', 'asc')
    .execute();
  const ids = actions.map((action) => action.id);
  const statuses =
    ids.length === 0
      ? []
      : await q
          .selectFrom('action_status')
          .select(['action_id', 'seq', 'status'])
          .where('org_id', '=', org)
          .where('action_id', 'in', ids)
          .execute();
  const approves =
    ids.length === 0
      ? []
      : await q
          .selectFrom('action_decision')
          .select(['action_id', 'blocked_seq'])
          .where('org_id', '=', org)
          .where('action_id', 'in', ids)
          .where('verdict', '=', 'approve')
          .execute();
  const plan: StepAction[] = [];
  for (const action of actions) {
    const rows = statuses.filter((row) => row.action_id === action.id);
    let newest: (typeof rows)[number] | undefined;
    let blockedSeq: number | undefined;
    for (const row of rows) {
      if (newest === undefined || row.seq > newest.seq) newest = row;
      if (row.status !== ActionStatus.blocked) continue;
      if (blockedSeq === undefined || row.seq > blockedSeq)
        blockedSeq = row.seq;
    }
    if (newest === undefined) {
      return err(appError(ErrorCode.internal, 'stored action is invalid'));
    }
    const status = ActionStatusSchema.safeParse(newest.status);
    if (!status.success) {
      return err(appError(ErrorCode.internal, 'stored action is invalid'));
    }
    plan.push({
      id: action.id,
      status: status.data,
      approved:
        blockedSeq !== undefined &&
        approves.some(
          (decision) =>
            decision.action_id === action.id &&
            decision.blocked_seq === blockedSeq,
        ),
    });
  }
  const { run, waiting } = stepPlan(plan);
  const runnable: RunnableAction[] = [];
  for (const action of actions) {
    if (!run.includes(action.id)) continue;
    const snapshot = SnapshotSchema.safeParse(action.config_snapshot);
    if (!snapshot.success) {
      return err(appError(ErrorCode.internal, 'stored action is invalid'));
    }
    runnable.push({
      actionId: action.id,
      attempts: attemptsOf(snapshot.data.entry),
    });
  }
  return ok({ runnable, waiting, done: noToolCalls(content.data.toolCalls) });
}

/** A guard and the numeric attempt it claims. */
interface Claimant {
  readonly guard: StepGuard;
  readonly attempt: number;
}

/**
 * PD2: only a guard reads the attempt, so `stored` is valid only without one.
 * `undefined` means no guard: nothing is claimed.
 */
function claimantOf(
  guard: StepGuard | undefined,
  attempt: ModelStepArgs['attempt'],
): Result<Claimant | undefined> {
  if (guard === undefined) return ok(undefined);
  if (attempt === STORED_ATTEMPT) {
    return err(
      appError(ErrorCode.internal, 'stored attempt with a step guard'),
    );
  }
  return ok({ guard, attempt });
}

/** Step 2 of D5: a guard claims the attempt; `taken` is `aborted`. No guard, no claim. */
async function claim(
  db: Db,
  claimant: Claimant | undefined,
  key: StepKey,
): Promise<Result<void>> {
  if (claimant === undefined) return ok(undefined);
  const { guard, attempt } = claimant;
  return withTransaction(db, async (tx) => {
    const claimed = await guard.claim(tx, key, attempt);
    if (!claimed.ok) return claimed;
    return claimed.value === 'taken'
      ? aborted('another attempt holds the step')
      : ok(undefined);
  });
}

/** D8: the response text cut at a code-point boundary to `max` UTF-8 bytes. */
function capUtf8(
  text: string,
  max: number,
): { readonly text: string; readonly truncated: boolean } {
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length <= max) return { text, truncated: false };
  let cut = max;
  while (cut > 0 && ((bytes[cut] ?? 0) & 0xc0) === 0x80) cut -= 1;
  return { text: bytes.subarray(0, cut).toString('utf8'), truncated: true };
}

interface PlannedCall {
  readonly id: string;
  readonly callIndex: number;
  readonly toolCallId: string;
  readonly toolKey: string;
  readonly implementationVersion: number | null;
  readonly input: unknown;
  readonly snapshot: object;
  readonly failure: { readonly reason: string; readonly text: string } | null;
  readonly attempts: number;
  /** D1: the verdict, read once. */
  readonly blocked: boolean;
}

/** D7: every call becomes an action; unmounted and over-cap calls are errored with an output. */
function planCalls(
  prompt: Prompt,
  response: ModelResponse,
): Array<Omit<PlannedCall, 'blocked'>> {
  const { definition, entries } = prompt;
  const cap = definition.limits.maxToolCallsPerStep;
  return response.toolCalls.map((call, callIndex) => {
    const ref = definition.tools.find((t) => t.key === call.name);
    const entry: ToolEntry | undefined = entries.get(call.name);
    const base = {
      id: randomUUID(),
      callIndex,
      toolCallId: call.id,
      toolKey: call.name,
      input: call.input,
    };
    if (ref === undefined || entry === undefined) {
      return {
        ...base,
        implementationVersion: null,
        snapshot: {},
        failure: {
          reason: 'tool_not_mounted',
          text: `tool ${call.name} is not mounted on this agent`,
        },
        attempts: 1,
      };
    }
    return {
      ...base,
      implementationVersion: ref.implementationVersion,
      snapshot: actionSnapshot(entry, ref),
      failure:
        callIndex >= cap
          ? {
              reason: 'over_step_cap',
              text: `at most ${String(cap)} tool calls run per step; this call was not run`,
            }
          : null,
      attempts: attemptsOf(entry),
    };
  });
}

function planStatus(call: PlannedCall): ActionStatus {
  if (call.blocked) return ActionStatus.blocked;
  return call.failure === null ? ActionStatus.created : ActionStatus.errored;
}

/** D1: each mounted call under the cap gets its verdict, read once here. */
async function applyVerdicts(
  db: Db,
  org: OrgId,
  agentId: string,
  planned: readonly Omit<PlannedCall, 'blocked'>[],
): Promise<PlannedCall[]> {
  const judged: PlannedCall[] = [];
  for (const call of planned) {
    if (call.failure !== null) {
      judged.push({ ...call, blocked: false });
      continue;
    }
    const memory = await rememberedApprovals(db, org, agentId, call.toolKey);
    const verdict = approvalVerdict(
      effectiveStake(call.snapshot as ActionSnapshot),
      memory,
      canonicalHash(call.input),
    );
    judged.push({ ...call, blocked: verdict === 'block' });
  }
  return judged;
}

/** Step 4 of D5, inside the `Tx`: the trace, the step row, and the action rows. */
async function commit(
  tx: Tx,
  claimant: Claimant | undefined,
  args: ModelStepArgs,
  prompt: Prompt,
  response: ModelResponse,
  planned: readonly PlannedCall[],
): Promise<Result<void>> {
  const { org, messageId, stepIndex } = args;
  const q = withTables<RuntimeTables>(tx);
  if (claimant !== undefined) {
    const claims = await q
      .selectFrom('step_claim')
      .select('attempt')
      .where('org_id', '=', org)
      .where('message_id', '=', messageId)
      .where('step_index', '=', stepIndex)
      .where('attempt', '>', claimant.attempt)
      .executeTakeFirst();
    if (claims !== undefined) return aborted('a later attempt holds the step');
  }
  const existing = await q
    .selectFrom('step')
    .select('step_index')
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .where('step_index', '=', stepIndex)
    .executeTakeFirst();
  if (existing !== undefined) return aborted('the step is already written');

  const capped = capUtf8(
    JSON.stringify(response.raw ?? null),
    prompt.definition.limits.maxTraceOutputBytes,
  );
  const trace = JSON.stringify({
    request: prompt.request,
    response: capped.text,
    truncated: capped.truncated,
  });
  const traceObjectId = await writeObject(
    tx,
    org,
    Buffer.from(trace, 'utf8'),
    'application/json',
  );

  try {
    await q
      .insertInto('step')
      .values({
        org_id: org,
        message_id: messageId,
        step_index: stepIndex,
        run_key: args.runKey,
        content: {
          text: response.text,
          reasoning: response.reasoning,
          toolCalls: response.toolCalls,
        },
        finish_reason: response.finishReason,
        usage: response.usage,
        trace_object_id: traceObjectId,
        trace_truncated: capped.truncated,
        stream_seq: await nextStreamSeq(tx, org, 'message', messageId),
      })
      .execute();
    for (const call of planned) {
      await q
        .insertInto('action')
        .values({
          org_id: org,
          id: call.id,
          message_id: messageId,
          step_index: stepIndex,
          call_index: call.callIndex,
          tool_call_id: call.toolCallId,
          tool_key: call.toolKey,
          implementation_version: call.implementationVersion,
          arguments: JSON.stringify(call.input ?? null),
          config_snapshot: call.snapshot,
          stream_seq: await nextStreamSeq(tx, org, 'message', messageId),
        })
        .execute();
      const status = planStatus(call);
      const appended = await appendActionStatus(
        tx,
        org,
        call.id,
        (newest) => newest === undefined,
        {
          status,
          reason: call.blocked
            ? BlockKind.approval
            : (call.failure?.reason ?? null),
          attempt: null,
          resumePointer: null,
          ...(call.blocked
            ? { blockKind: BlockKind.approval, blockPointer: null }
            : {}),
        },
      );
      if (!appended.ok) return appended;
      if (call.failure !== null) {
        await q
          .insertInto('action_output')
          .values({
            org_id: org,
            action_id: call.id,
            model_text: call.failure.text,
            is_error: true,
            truncated: false,
            object_id: null,
            stream_seq: await nextStreamSeq(tx, org, 'message', messageId),
          })
          .execute();
      }
    }
  } catch (e) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      e.code === PG_UNIQUE
    ) {
      return aborted('lost the race to write the step', e);
    }
    throw e;
  }
  return ok(undefined);
}

/**
 * PD7: each chunk is one `appendDelta` with the step's trace id. On the first
 * `stream_cap` it warns once and stops publishing; the model call goes on
 * (Open 1). Any other refusal throws, and the adapter ends its callbacks (P4.2).
 */
function publisher(
  db: Db,
  args: ModelStepArgs,
  traceId: string,
): (chunk: ModelChunk) => Promise<void> {
  const { org, messageId, log } = args;
  let capped = false;
  return async (chunk) => {
    if (capped) return;
    const appended = await appendDelta(db, org, messageId, {
      kind: chunk.kind,
      traceId,
      text: chunk.text,
    });
    if (appended.ok) return;
    if (
      appended.error.code === ErrorCode.aborted &&
      appended.error.message === STREAM_CAP
    ) {
      capped = true;
      log.warn({ org, messageId }, 'stream cap reached; deltas stopped');
      return;
    }
    throw new Error(appended.error.message);
  };
}

/**
 * One model step in the D5 order: read, claim, call, guarded write. A step whose
 * rows committed returns its actions and calls no model (G3). `aborted` means
 * another attempt holds or took the step; the caller retries.
 */
export async function runModelStep(
  deps: ModelStepDeps,
  args: ModelStepArgs,
): Promise<Result<ModelStepResult>> {
  const { db, model, guard } = deps;
  const { org, messageId, stepIndex } = args;
  const claimant = claimantOf(guard, args.attempt);
  if (!claimant.ok) return claimant;
  const committed = await readCommitted(db, org, messageId, stepIndex);
  if (committed !== undefined) return committed;

  const claimed = await claim(db, claimant.value, {
    org,
    messageId,
    stepIndex,
  });
  if (!claimed.ok) return claimed;

  const prompt = await buildPrompt(db, org, messageId, stepIndex);
  if (!prompt.ok) return prompt;
  const credentials = await readProviderCredentials(
    db,
    org,
    prompt.value.request.provider,
  );
  if (!credentials.ok) return credentials;
  const response = await model.generate(
    prompt.value.request,
    credentials.value,
    args.signal ?? new AbortController().signal,
    publisher(db, args, prompt.value.pin.traceId),
  );
  if (!response.ok) return response;

  const planned = await applyVerdicts(
    db,
    org,
    prompt.value.pin.agentId,
    planCalls(prompt.value, response.value),
  );
  const written = await withTransaction(db, (tx) =>
    commit(tx, claimant.value, args, prompt.value, response.value, planned),
  );
  if (!written.ok) return written;
  const { run, waiting } = stepPlan(
    planned.map((call) => ({
      id: call.id,
      status: planStatus(call),
      approved: false,
    })),
  );
  return ok({
    runnable: planned
      .filter((call) => run.includes(call.id))
      .map((call) => ({ actionId: call.id, attempts: call.attempts })),
    waiting,
    done: noToolCalls(response.value.toolCalls),
  });
}
