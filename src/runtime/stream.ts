import { sql } from 'kysely';
import { appError, err, ErrorCode, JsonValueSchema, ok } from '../index.ts';
import type { JsonValue, Result } from '../index.ts';
import { notify, withTables, withTransaction } from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import { pauseTimeoutSeconds, readOrgConfig } from '../orgconfig/index.ts';
import { redactEvent } from './redact.ts';
import { TERMINAL_STATUSES } from './status.ts';
import type { BlockKind, TerminalStatus } from './status.ts';
import { runtimeView } from './tables.ts';
import type { RuntimeTables } from './tables.ts';

type StreamChannel = RuntimeTables['stream_counter']['channel'];

export type DeltaKind = RuntimeTables['stream_delta']['kind'];

/** A request cursor. `end` only on the message channel (PD12). */
export type Cursor = { readonly seq: number; readonly end: boolean };

export type StreamEvent =
  | {
      readonly id: string;
      readonly kind: 'delta';
      readonly delta: DeltaKind;
      readonly traceId: string;
      readonly text: string;
    }
  | {
      readonly id: string;
      readonly kind: 'step' | 'tool' | 'action';
      readonly data: JsonValue;
    }
  | {
      readonly id: string;
      readonly kind: 'terminal';
      readonly status: TerminalStatus;
    }
  | {
      readonly id: string;
      readonly kind: 'blocked';
      readonly actions: {
        readonly actionId: string;
        readonly kind: BlockKind;
        readonly canRemember: boolean;
      }[];
    }
  | { readonly id: string; readonly kind: 'end-of-stream' }
  | {
      readonly id: string | null;
      readonly kind: 'rollover';
      readonly reason: 'lifetime' | 'credential_expired';
    };

/** The refusal past `maxStreamDeltasPerMessage` (D1, Open 1). */
export const STREAM_CAP = 'stream_cap';

/**
 * One delta of `messageId` in one transaction (PD1): refused past the org's
 * `maxStreamDeltasPerMessage`, redacted (L1), at the next message `seq` (PD8),
 * expiring `streamReplayTtl` after `now()`, and a NOTIFY of ids only (D2).
 */
export async function appendDelta(
  db: Db,
  org: OrgId,
  messageId: string,
  delta: { kind: DeltaKind; traceId: string; text: string },
): Promise<Result<{ readonly seq: number }>> {
  return withTransaction(db, async (tx) => {
    const config = await readOrgConfig(tx, org);
    if (!config.set) {
      return err(appError(ErrorCode.invalid_argument, 'org config: not set'));
    }
    const { streamReplayTtl, maxStreamDeltasPerMessage } = config.snapshot;
    // The counter row lock comes first, so a concurrent append waits before the count.
    const seq = await nextStreamSeq(tx, org, 'message', messageId);
    const q = withTables<RuntimeTables>(tx);
    const stored = await q
      .selectFrom('stream_delta')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('org_id', '=', org)
      .where('message_id', '=', messageId)
      .executeTakeFirstOrThrow();
    if (Number(stored.n) >= maxStreamDeltasPerMessage) {
      return err(appError(ErrorCode.aborted, STREAM_CAP));
    }
    const event = redactEvent(delta);
    const ttlSeconds = pauseTimeoutSeconds(streamReplayTtl);
    await q
      .insertInto('stream_delta')
      .values({
        org_id: org,
        message_id: messageId,
        seq,
        kind: event.kind,
        trace_id: event.traceId,
        text: event.text,
        expires_at: sql<Date>`now() + make_interval(secs => ${ttlSeconds})`,
      })
      .execute();
    await notify(tx, 'stream_delta', `${org}|${messageId}|${String(seq)}`);
    return ok({ seq });
  });
}

/** `<seq>` in decimal with no leading zero, then `.end` when present (PD12). */
const CURSOR = /^(0|[1-9][0-9]*)(\.end)?$/u;
const END_SUFFIX = '.end';

const badCursor = () =>
  err(appError(ErrorCode.invalid_argument, 'lastEventId: not a cursor'));

/** PD12: `<seq>`, or `<seq>.end` on the message channel only. Absent is `undefined`. */
export function parseCursor(
  raw: string | undefined,
  channel: StreamChannel,
): Result<Cursor | undefined> {
  if (raw === undefined) return ok(undefined);
  const match = CURSOR.exec(raw);
  const seq = Number(match?.[1]);
  if (match === null || !Number.isSafeInteger(seq)) return badCursor();
  const end = match[2] !== undefined;
  if (end && channel !== 'message') return badCursor();
  return ok({ seq, end });
}

const endOfStream = (terminalSeq: number): StreamEvent => ({
  id: `${String(terminalSeq)}${END_SUFFIX}`,
  kind: 'end-of-stream',
});

const isTerminal = (status: string): status is TerminalStatus =>
  (TERMINAL_STATUSES as readonly string[]).includes(status);

type Frame = { readonly seq: number; readonly event: StreamEvent };

/** C3: a row frame; its `data` is redacted (L1). A row that is not JSON is `internal`. */
function rowFrame(
  seq: number,
  kind: 'step' | 'tool' | 'action',
  data: Record<string, unknown>,
): Result<Frame> {
  const parsed = JsonValueSchema.safeParse(data);
  if (!parsed.success) {
    return err(appError(ErrorCode.internal, `${kind} row is not JSON`));
  }
  return ok({
    seq,
    event: { id: String(seq), kind, data: redactEvent(parsed.data) },
  });
}

function isBlockKind(value: unknown): value is BlockKind {
  return (
    value === 'approval' || value === 'authentication' || value === 'retry'
  );
}

/** PD14: one `blocked` frame from a `message_pause` row, redacted (L1). */
function blockedFrame(seq: number, blocked: unknown): Result<Frame> {
  let raw = blocked;
  if (typeof blocked === 'string') {
    try {
      raw = JSON.parse(blocked) as unknown;
    } catch {
      return err(appError(ErrorCode.internal, 'blocked row is not JSON'));
    }
  }
  const parsed = JsonValueSchema.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data === null ||
    typeof parsed.data !== 'object' ||
    Array.isArray(parsed.data) ||
    !Array.isArray(parsed.data['actions'])
  ) {
    return err(appError(ErrorCode.internal, 'blocked row is not JSON'));
  }
  const actions = redactEvent(parsed.data['actions']);
  if (!Array.isArray(actions)) {
    return err(appError(ErrorCode.internal, 'blocked row is not JSON'));
  }
  const list: {
    actionId: string;
    kind: BlockKind;
    canRemember: boolean;
  }[] = [];
  for (const item of actions) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return err(appError(ErrorCode.internal, 'blocked row is not JSON'));
    }
    const { actionId, kind, canRemember } = item;
    if (
      typeof actionId !== 'string' ||
      !isBlockKind(kind) ||
      typeof canRemember !== 'boolean'
    ) {
      return err(appError(ErrorCode.internal, 'blocked row is not JSON'));
    }
    list.push({ actionId, kind, canRemember });
  }
  return ok({
    seq,
    event: { id: String(seq), kind: 'blocked', actions: list },
  });
}

/**
 * Data frames of message `messageId` with `seq > after`: unexpired buffer rows
 * and step, action, output, and terminal rows, merged by `seq`, at most `limit`
 * (L4, PD8). `end-of-stream` follows once the batch reaches the terminal event
 * or the cursor sits at it. An `.end` cursor returns that one frame, or
 * `invalid_argument` when it does not name the terminal `seq` (PD12).
 */
export async function readMessageEvents(
  db: Db,
  org: OrgId,
  messageId: string,
  after: Cursor | undefined,
  limit: number,
): Promise<Result<{ events: StreamEvent[] }>> {
  const q = runtimeView(db);
  const terminal = await q
    .selectFrom('message_status')
    .select(['status', 'stream_seq'])
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .where('stream_seq', 'is not', null)
    .executeTakeFirst();
  const terminalSeq = terminal?.stream_seq ?? undefined;
  if (after?.end === true) {
    if (terminalSeq !== after.seq) return badCursor();
    return ok({ events: [endOfStream(terminalSeq)] });
  }
  const afterSeq = after?.seq ?? 0;

  const [deltas, steps, actions, outputs, pauses] = await Promise.all([
    q
      .selectFrom('stream_delta')
      .select(['seq', 'kind', 'trace_id', 'text'])
      .where('org_id', '=', org)
      .where('message_id', '=', messageId)
      .where('seq', '>', afterSeq)
      .where('expires_at', '>', sql<Date>`now()`)
      .orderBy('seq')
      .limit(limit)
      .execute(),
    q
      .selectFrom('step')
      .select(['stream_seq', 'step_index', 'content', 'finish_reason', 'usage'])
      .where('org_id', '=', org)
      .where('message_id', '=', messageId)
      .where('stream_seq', '>', afterSeq)
      .orderBy('stream_seq')
      .limit(limit)
      .execute(),
    q
      .selectFrom('action')
      .select([
        'stream_seq',
        'id',
        'step_index',
        'call_index',
        'tool_call_id',
        'tool_key',
        'arguments',
      ])
      .where('org_id', '=', org)
      .where('message_id', '=', messageId)
      .where('stream_seq', '>', afterSeq)
      .orderBy('stream_seq')
      .limit(limit)
      .execute(),
    q
      .selectFrom('action_output')
      .innerJoin('action', (join) =>
        join
          .onRef('action.org_id', '=', 'action_output.org_id')
          .onRef('action.id', '=', 'action_output.action_id'),
      )
      .select([
        'action_output.stream_seq',
        'action_output.action_id',
        'action_output.model_text',
        'action_output.is_error',
        'action_output.truncated',
      ])
      .where('action_output.org_id', '=', org)
      .where('action.message_id', '=', messageId)
      .where('action_output.stream_seq', '>', afterSeq)
      .orderBy('action_output.stream_seq')
      .limit(limit)
      .execute(),
    q
      .selectFrom('message_pause')
      .select(['stream_seq', 'blocked'])
      .where('org_id', '=', org)
      .where('message_id', '=', messageId)
      .where('stream_seq', '>', afterSeq)
      .orderBy('stream_seq')
      .limit(limit)
      .execute(),
  ]);

  const frames: Frame[] = deltas.map((d) => ({
    seq: d.seq,
    event: {
      id: String(d.seq),
      kind: 'delta',
      delta: d.kind,
      traceId: d.trace_id,
      text: d.text,
    },
  }));
  for (const frame of [
    ...steps.map((s) =>
      rowFrame(s.stream_seq ?? 0, 'step', {
        stepIndex: s.step_index,
        content: s.content,
        finishReason: s.finish_reason,
        usage: s.usage,
      }),
    ),
    ...actions.map((a) =>
      rowFrame(a.stream_seq ?? 0, 'action', {
        actionId: a.id,
        stepIndex: a.step_index,
        callIndex: a.call_index,
        toolCallId: a.tool_call_id,
        toolKey: a.tool_key,
        arguments: a.arguments,
      }),
    ),
    ...outputs.map((o) =>
      rowFrame(o.stream_seq ?? 0, 'tool', {
        actionId: o.action_id,
        modelText: o.model_text,
        isError: o.is_error,
        truncated: o.truncated,
      }),
    ),
  ]) {
    if (!frame.ok) return frame;
    frames.push(frame.value);
  }
  for (const pause of pauses) {
    const frame = blockedFrame(pause.stream_seq, pause.blocked);
    if (!frame.ok) return frame;
    frames.push(frame.value);
  }
  if (
    terminal !== undefined &&
    terminalSeq !== undefined &&
    terminalSeq > afterSeq &&
    isTerminal(terminal.status)
  ) {
    frames.push({
      seq: terminalSeq,
      event: {
        id: String(terminalSeq),
        kind: 'terminal',
        status: terminal.status,
      },
    });
  }

  const batch = frames.sort((a, b) => a.seq - b.seq).slice(0, limit);
  const events = batch.map((f) => f.event);
  const reachedTerminal =
    terminalSeq !== undefined &&
    (afterSeq >= terminalSeq || batch.at(-1)?.seq === terminalSeq);
  if (reachedTerminal) events.push(endOfStream(terminalSeq));
  return ok({ events });
}

/**
 * The next `seq` of `parentId` on `channel`, in the caller's transaction (C1).
 * The counter row stays locked until that transaction ends, so the rows it
 * orders commit in `seq` order and a rollback returns the value.
 */
export async function nextStreamSeq(
  tx: Tx,
  org: OrgId,
  channel: StreamChannel,
  parentId: string,
): Promise<number> {
  const row = await withTables<RuntimeTables>(tx)
    .insertInto('stream_counter')
    .values({ org_id: org, channel, parent_id: parentId, last_seq: 1 })
    .onConflict((conflict) =>
      conflict
        .columns(['org_id', 'channel', 'parent_id'])
        .doUpdateSet({ last_seq: sql<number>`stream_counter.last_seq + 1` }),
    )
    .returning('last_seq')
    .executeTakeFirstOrThrow();
  return row.last_seq;
}

/**
 * One conversation event at the thread's next `seq` (D6). Called only inside
 * the post and terminal transactions; the counter row is the conversation lock.
 */
export async function appendConversationEvent(
  tx: Tx,
  org: OrgId,
  threadId: string,
  e: {
    kind: RuntimeTables['conversation_event']['kind'];
    messageId?: string;
    payload: JsonValue;
  },
): Promise<{ readonly seq: number }> {
  const seq = await nextStreamSeq(tx, org, 'conversation', threadId);
  await withTables<RuntimeTables>(tx)
    .insertInto('conversation_event')
    .values({
      org_id: org,
      thread_id: threadId,
      seq,
      kind: e.kind,
      message_id: e.messageId ?? null,
      payload: JSON.stringify(e.payload),
    })
    .execute();
  return { seq };
}
