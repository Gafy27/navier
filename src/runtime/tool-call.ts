import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { withTables, withTransaction } from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import { loadPublisher, loadVersion } from '../agents/index.ts';
import { getTool, validateToolInput } from '../catalog/index.ts';
import type { ToolEntry } from '../catalog/index.ts';
import { formatScope } from '../identity/index.ts';
import type { Authz, Decision } from '../identity/index.ts';
import { ActionStatus, appendActionStatus } from './actions.ts';
import { ActionReason } from './decide.ts';
import { loadAgentMessage } from './messages.ts';
import type { AgentMessagePin } from './messages.ts';
import { writeObject } from './objects.ts';
import { toOutput } from './output.ts';
import { JsonValueSchema } from './request-context.ts';
import type { JsonValue } from './request-context.ts';
import { runtimeView } from './tables.ts';
import type { RuntimeTables } from './tables.ts';
import { BlockKind } from './status.ts';
import { STORED_ATTEMPT } from './step-contract.ts';
import type {
  StepAttempt,
  ToolCallArgs as StepContractArgs,
} from './step-contract.ts';
import { nextStreamSeq } from './stream.ts';
import type {
  Blocked,
  ToolBlockKind,
  ToolContext,
  ToolRegistry,
} from './tools.ts';
import type { ToolCallOutcome } from './workflow-types.ts';

export interface ToolCallDeps {
  readonly db: Db;
  readonly authz: Authz;
  readonly tools: ToolRegistry;
}

export interface ToolCallArgs extends StepContractArgs {
  /** The activity's cancellation signal. */
  readonly signal: AbortSignal;
}

/** A failure the model sees: a reason code and a fixed sentence, never a value. */
interface ErrorResult {
  readonly reason: string;
  readonly text: string;
}

type Finish =
  | {
      readonly kind: 'value';
      readonly value: unknown;
      readonly maxBytes: number;
    }
  | { readonly kind: 'error'; readonly error: ErrorResult };

type Accept = (
  newest: string | undefined,
  newestAttempt: number | null,
) => boolean;

interface StatusRow {
  readonly status: string;
  readonly reason: string | null;
  readonly attempt: number | null;
  readonly resumePointer: JsonValue | null;
  readonly blockPointer: JsonValue | null;
}

type Checked =
  | { readonly kind: 'pass'; readonly entry: ToolEntry }
  | { readonly kind: 'fail'; readonly error: ErrorResult };

const DONE: ToolCallOutcome = { kind: 'done' };
const BLOCKED: ToolCallOutcome = { kind: 'blocked' };

const TOOL_VERSION_UNAVAILABLE = 'tool_version_unavailable';

interface Issued {
  /** The attempt's context object: a token from another one is foreign. */
  readonly owner: object;
  readonly kind: ToolBlockKind;
  readonly pointer: JsonValue | null;
}

/** Every `Blocked` that `ctx.block` made, with what it carries. */
const issued = new WeakMap<object, Issued>();

/** Reason codes of an errored tool call. The model text carries the same code. */
const ToolReason = {
  tool_failed: 'tool_failed',
  tool_not_mounted: 'tool_not_mounted',
  tool_disabled: 'tool_disabled',
  tool_denied: 'tool_denied',
  invalid_input: 'invalid_input',
  interrupted: 'interrupted',
} as const;

const JSON_CONTENT_TYPE = 'application/json';

const toolFailed: ErrorResult = {
  reason: ToolReason.tool_failed,
  text: `${ToolReason.tool_failed}: the tool did not return a result`,
};

const fail = (reason: string, text: string): Checked => ({
  kind: 'fail',
  error: { reason, text },
});

const notFound = (what: string) =>
  err(appError(ErrorCode.not_found, `${what} not found`));

const isRunning = (status: string | undefined) =>
  status === ActionStatus.running;

function isTerminal(status: string): boolean {
  return (
    status === ActionStatus.succeeded ||
    status === ActionStatus.errored ||
    status === ActionStatus.cancelled
  );
}

/** Rows a check failure may close: not yet run, or run by this or an earlier attempt. */
const unfinishedAt =
  (attempt: number): Accept =>
  (status, rowAttempt) =>
    status === ActionStatus.created ||
    (isRunning(status) && rowAttempt !== null && rowAttempt <= attempt);

interface Written {
  readonly status: typeof ActionStatus.succeeded | typeof ActionStatus.errored;
  readonly reason: string | null;
  readonly modelText: string;
  readonly truncated: boolean;
  readonly objectId: string | null;
}

const erroredWith = (error: ErrorResult): Written => ({
  status: ActionStatus.errored,
  reason: error.reason,
  modelText: error.text,
  truncated: false,
  objectId: null,
});

async function written(tx: Tx, org: OrgId, result: Finish): Promise<Written> {
  if (result.kind === 'error') return erroredWith(result.error);
  const output = await toOutput(result.value, result.maxBytes, (bytes) =>
    writeObject(tx, org, bytes, JSON_CONTENT_TYPE),
  );
  if (!output.ok) return erroredWith(toolFailed);
  return {
    status: ActionStatus.succeeded,
    reason: null,
    modelText: output.value.modelText,
    truncated: output.value.truncated,
    objectId: output.value.objectId,
  };
}

/**
 * D4: the terminal status and the output commit in one `Tx`. When the guard
 * refuses (the action moved on) nothing is written and the result is `aborted` (G4).
 */
async function finish(
  db: Db,
  org: OrgId,
  actionId: string,
  attempt: number | null,
  accept: Accept,
  result: Finish,
): Promise<Result<void>> {
  return withTransaction(db, async (tx) => {
    const w = await written(tx, org, result);
    const appended = await appendActionStatus(tx, org, actionId, accept, {
      status: w.status,
      reason: w.reason,
      attempt,
      resumePointer: null,
    });
    if (!appended.ok) return appended;
    const q = withTables<RuntimeTables>(tx);
    const action = await q
      .selectFrom('action')
      .select('message_id')
      .where('org_id', '=', org)
      .where('id', '=', actionId)
      .executeTakeFirstOrThrow();
    await q
      .insertInto('action_output')
      .values({
        org_id: org,
        action_id: actionId,
        model_text: w.modelText,
        is_error: w.status === ActionStatus.errored,
        truncated: w.truncated,
        object_id: w.objectId,
        stream_seq: await nextStreamSeq(tx, org, 'message', action.message_id),
      })
      .execute();
    return ok(undefined);
  });
}

/** Appends `blocked`, with no output. A refusal means the action moved on. */
async function writeBlocked(
  db: Db,
  org: OrgId,
  actionId: string,
  accept: Accept,
  row: {
    readonly kind: BlockKind;
    readonly reason: string;
    readonly attempt: number | null;
    readonly pointer: JsonValue | null;
    readonly resumePointer: JsonValue | null;
  },
): Promise<Result<void>> {
  return withTransaction(db, (tx) =>
    appendActionStatus(tx, org, actionId, accept, {
      status: ActionStatus.blocked,
      reason: row.reason,
      attempt: row.attempt,
      resumePointer: row.resumePointer,
      blockKind: row.kind,
      blockPointer: row.pointer,
    }),
  );
}

/** Closes an action the workflow could not finish. Writes nothing when it is terminal. */
export async function failAction(
  db: Db,
  org: OrgId,
  actionId: string,
  reason: string,
): Promise<void> {
  await finish(
    db,
    org,
    actionId,
    null,
    (status) => status === ActionStatus.created || isRunning(status),
    {
      kind: 'error',
      error: { reason, text: `${reason}: the tool call did not finish` },
    },
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const member of Object.values(value)) deepFreeze(member);
  }
  return value;
}

/** Status rows of an action, oldest first. */
async function statusRows(
  db: Db,
  org: OrgId,
  actionId: string,
): Promise<Result<StatusRow[]>> {
  const rows = await runtimeView(db)
    .selectFrom('action_status')
    .select(['status', 'reason', 'attempt', 'resume_pointer', 'block_pointer'])
    .where('org_id', '=', org)
    .where('action_id', '=', actionId)
    .orderBy('seq', 'asc')
    .execute();
  const parsed: StatusRow[] = [];
  for (const row of rows) {
    const resumePointer = storedPointer(row.resume_pointer);
    if (!resumePointer.ok) return resumePointer;
    const blockPointer = storedPointer(row.block_pointer);
    if (!blockPointer.ok) return blockPointer;
    parsed.push({
      status: row.status,
      reason: row.reason,
      attempt: row.attempt,
      resumePointer: resumePointer.value,
      blockPointer: blockPointer.value,
    });
  }
  return ok(parsed);
}

/** A stored pointer is a JSON value, or `null` when the row has none. */
function storedPointer(raw: unknown): Result<JsonValue | null> {
  if (raw === null) return ok(null);
  const parsed = JsonValueSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      appError(ErrorCode.internal, 'stored resume pointer is invalid'),
    );
  }
  return ok(parsed.data);
}

/**
 * PD2: `stored` is `1 + max(attempt)` over the rows after the newest `created`
 * row, or 1 when none carries one. An approval's `created` row starts a fresh budget.
 */
export function resolveAttempt(
  attempt: StepAttempt,
  rows: readonly Pick<StatusRow, 'status' | 'attempt'>[],
): number {
  if (attempt !== STORED_ATTEMPT) return attempt;
  const start = rows.findLastIndex(
    (row) => row.status === ActionStatus.created,
  );
  let max = 0;
  for (const row of rows.slice(start + 1)) {
    if (row.attempt !== null && row.attempt > max) max = row.attempt;
  }
  return max + 1;
}

/** The newest pointer any attempt stored. */
function newestPointer(rows: readonly StatusRow[]): JsonValue | null {
  for (const row of rows.toReversed()) {
    if (row.resumePointer !== null) return row.resumePointer;
  }
  return null;
}

function denial(decision: Result<Decision>): string | undefined {
  if (!decision.ok) {
    return `${ToolReason.tool_denied}: ${decision.error.code}`;
  }
  return decision.value.allow
    ? undefined
    : `${ToolReason.tool_denied}: ${decision.value.reason}`;
}

/** D2 steps 2–4, on every attempt: mounted on the pinned version, enabled, granted. */
async function check(
  deps: ToolCallDeps,
  org: OrgId,
  pin: AgentMessagePin,
  key: string,
  implementationVersion: number | null,
): Promise<Result<Checked>> {
  const { db, authz } = deps;
  const version = await loadVersion(db, org, pin.agentId, pin.agentVersion);
  if (!version.ok) return version;
  const notMounted = fail(
    ToolReason.tool_not_mounted,
    `tool ${key} is not mounted on this agent`,
  );
  const mounted = version.value.definition.tools.some(
    (ref) =>
      ref.key === key && ref.implementationVersion === implementationVersion,
  );
  if (!mounted || implementationVersion === null) return ok(notMounted);

  const entry = await getTool(db, org, key, implementationVersion);
  if (!entry.ok) {
    return entry.error.code === ErrorCode.not_found ? ok(notMounted) : entry;
  }
  if (!entry.value.enabled) {
    return ok(fail(ToolReason.tool_disabled, `tool ${key} is disabled`));
  }
  const publisher = await loadPublisher(db, org, pin.agentId, pin.agentVersion);
  if (!publisher.ok) return publisher;
  const denied =
    publisher.value === undefined
      ? `${ToolReason.tool_denied}: no_grant`
      : denial(
          await authz.check(
            org,
            publisher.value,
            formatScope({ resource: 'tool', action: 'assign', id: key }),
          ),
        );
  if (denied !== undefined) return ok(fail(ToolReason.tool_denied, denied));
  return ok({ kind: 'pass', entry: entry.value });
}

/**
 * Runs one action in the D2 order: read, checks, registry, input, attempt rule,
 * `execute`, guarded write. A tool's own failure is an error result, never a throw.
 */
export async function runToolCall(
  deps: ToolCallDeps,
  args: ToolCallArgs,
): Promise<Result<ToolCallOutcome>> {
  const { db, tools } = deps;
  const { org, actionId, signal } = args;
  const action = await runtimeView(db)
    .selectFrom('action')
    .selectAll()
    .where('org_id', '=', org)
    .where('id', '=', actionId)
    .executeTakeFirst();
  if (action === undefined) return notFound('action');
  const rows = await statusRows(db, org, actionId);
  if (!rows.ok) return rows;
  // PD2: every later use reads this number; the claim refuses a row it did not see.
  const attempt = resolveAttempt(args.attempt, rows.value);
  const newest = rows.value.at(-1);
  if (newest === undefined) {
    return err(appError(ErrorCode.internal, 'action has no status'));
  }
  if (isTerminal(newest.status)) return ok(DONE);
  if (newest.status === ActionStatus.blocked) return ok(BLOCKED);

  const pin = await loadAgentMessage(db, org, action.message_id);
  if (!pin.ok) return pin;
  const checked = await check(
    deps,
    org,
    pin.value,
    action.tool_key,
    action.implementation_version,
  );
  if (!checked.ok) return checked;
  const closeUnfinished = (error: ErrorResult) =>
    finish(db, org, actionId, attempt, unfinishedAt(attempt), {
      kind: 'error',
      error,
    });
  if (checked.value.kind === 'fail') {
    await closeUnfinished(checked.value.error);
    return ok(DONE);
  }

  const { entry } = checked.value;
  const impl = tools.get(entry.key, entry.implementationVersion);
  if (impl === undefined) {
    const blocked = await writeBlocked(
      db,
      org,
      actionId,
      (status) =>
        status === ActionStatus.created || status === ActionStatus.running,
      {
        kind: BlockKind.retry,
        reason: TOOL_VERSION_UNAVAILABLE,
        attempt: null,
        pointer: null,
        resumePointer: null,
      },
    );
    return ok(blocked.ok ? BLOCKED : DONE);
  }
  const valid = validateToolInput(entry, action.arguments);
  if (!valid.ok) {
    await closeUnfinished({
      reason: ToolReason.invalid_input,
      text: `${ToolReason.invalid_input}: ${valid.error.message}`,
    });
    return ok(DONE);
  }

  // D3: a running row of an earlier attempt means that attempt was interrupted.
  const interrupted = isRunning(newest.status);
  if (interrupted && newest.attempt !== null && newest.attempt >= attempt) {
    return ok(DONE);
  }
  // D6: an approved row is a first attempt; it hands over what the block stored.
  const approved =
    newest.status === ActionStatus.created &&
    newest.reason === ActionReason.approved;
  const pointer = approved
    ? newest.resumePointer
    : interrupted
      ? newestPointer(rows.value)
      : null;
  if (
    interrupted &&
    !(
      entry.retryOnInterrupt &&
      pointer !== null &&
      attempt <= entry.toolAttempts
    )
  ) {
    await closeUnfinished({
      reason: ToolReason.interrupted,
      text: `${ToolReason.interrupted}: the tool call was interrupted and cannot be repeated`,
    });
    return ok(DONE);
  }
  const claimed = await withTransaction(db, (tx) =>
    appendActionStatus(
      tx,
      org,
      actionId,
      (status, rowAttempt) =>
        status === ActionStatus.created ||
        (isRunning(status) && rowAttempt !== null && rowAttempt < attempt),
      {
        status: ActionStatus.running,
        reason: null,
        attempt,
        resumePointer: null,
      },
    ),
  );
  if (!claimed.ok) return ok(DONE);

  const ownAttempt: Accept = (status, rowAttempt) =>
    isRunning(status) && rowAttempt === attempt;
  const owner = {};
  const ctx: ToolContext = {
    requestContext: deepFreeze(structuredClone(pin.value.requestContext)),
    abortSignal: signal,
    ids: {
      org,
      threadId: pin.value.threadId,
      agentMessageId: action.message_id,
      actionId,
      agentId: pin.value.agentId,
    },
    resumePointer: pointer,
    blockPointer: approved ? newest.blockPointer : null,
    block: (kind, pointer) => {
      const token = Object.freeze({}) as Blocked;
      issued.set(token, { owner, kind, pointer });
      return token;
    },
    saveResumePointer: (next) =>
      withTransaction(db, (tx) =>
        appendActionStatus(tx, org, actionId, ownAttempt, {
          status: ActionStatus.running,
          reason: null,
          attempt,
          resumePointer: next,
        }),
      ),
  };
  let result: Finish;
  try {
    const value = await impl.execute(action.arguments, ctx);
    const token =
      typeof value === 'object' && value !== null
        ? issued.get(value)
        : undefined;
    if (token?.owner === owner) {
      const latest = await statusRows(db, org, actionId);
      if (!latest.ok) return latest;
      const blocked = await writeBlocked(db, org, actionId, ownAttempt, {
        kind: token.kind,
        reason: token.kind,
        attempt,
        pointer: token.pointer,
        resumePointer: newestPointer(latest.value),
      });
      return ok(blocked.ok ? BLOCKED : DONE);
    }
    // A token from another action's context is a failure, not a value.
    result =
      token === undefined
        ? { kind: 'value', value, maxBytes: entry.maxToolOutputBytes }
        : { kind: 'error', error: toolFailed };
  } catch (e) {
    // A cancelled call is interrupted, not failed: leave the row `running`.
    if (signal.aborted) throw e;
    result = { kind: 'error', error: toolFailed };
  }
  await finish(db, org, actionId, attempt, ownAttempt, result);
  return ok(DONE);
}
