import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import { withTransaction } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';
import type { Caller } from '../identity/index.ts';
import type { TurnRef } from '../runner/index.ts';
import {
  MessageStatus,
  readTurnResult,
  requestStop,
  StopKind,
  TERMINAL_STATUSES,
  turnRequestContext,
} from '../runtime/index.ts';
import type { StartDeps, TurnInput, TurnResult } from '../runtime/index.ts';
import { RequestContext } from './request-context.ts';
import { SdkError } from './errors.ts';
import type { GenerateRequest, GenerateResult } from './session.ts';

/**
 * The prefix of the user message id derived from a `runId`. Changing it breaks
 * the idempotency of every turn in flight.
 */
export const USER_MESSAGE_ID_PREFIX = 'user';

const UUID_V5_BYTE = 0x50;
const UUID_VARIANT_BYTE = 0x80;
const UUID_BYTES = 16;
const SEPARATOR_BYTE = 0;

const RequestShapeSchema = z.object({
  memory: z.object({ thread: z.string() }),
});

/** Raises a failed `Result` as the `SdkError` every SDK function throws. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new SdkError(result.error);
  return result.value;
}

const invalid = (message: string) =>
  err(appError(ErrorCode.invalid_argument, message));

/**
 * A UUID formatted from the first 16 bytes of SHA-256 over `prefix`, a zero
 * byte, and `runId`: the same format P3.3 D1 gives a derived agent id.
 */
export function derivedId(prefix: string, runId: string): string {
  const digest = createHash('sha256')
    .update(
      Buffer.concat([
        Buffer.from(prefix),
        Buffer.from([SEPARATOR_BYTE]),
        Buffer.from(runId),
      ]),
    )
    .digest()
    .subarray(0, UUID_BYTES);
  digest[6] = ((digest[6] ?? 0) & 0x0f) | UUID_V5_BYTE;
  digest[8] = ((digest[8] ?? 0) & 0x3f) | UUID_VARIANT_BYTE;
  const hex = digest.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/**
 * D4 and D5: the caller's context plus the two identity keys the session
 * writes, and the ids derived from `runId`. A client value under a reserved
 * key is refused, not overwritten.
 */
export function turnInput(
  request: GenerateRequest,
  agentId: string,
  principalId: string,
  org: OrgId,
): Result<TurnInput> {
  const shape = RequestShapeSchema.safeParse(request);
  if (!shape.success) return invalid('memory.thread: invalid');
  const supplied =
    request.requestContext instanceof RequestContext
      ? request.requestContext.all()
      : (request.requestContext ?? {});
  const context = turnRequestContext(supplied, principalId, org);
  if (!context.ok) return context;
  const runId = request.runId ?? randomUUID();
  return ok({
    threadId: shape.data.memory.thread,
    agentId,
    agentMessageId: runId,
    userMessage: {
      id: derivedId(USER_MESSAGE_ID_PREFIX, runId),
      text: request.input,
    },
    requestContext: context.value,
    ...(request.maxSteps === undefined ? {} : { maxSteps: request.maxSteps }),
  });
}

const ABORTED = Symbol('aborted');

/** `work`, or `ABORTED` when `signal` fires first. */
function raceAbort<T>(
  work: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T | typeof ABORTED> {
  if (signal === undefined) return work;
  if (signal.aborted) return Promise.resolve(ABORTED);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      resolve(ABORTED);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

/** Resolves after `ms`, or as soon as `cancel` fires. Never rejects. */
const pause = (ms: number, cancel: AbortSignal): Promise<void> =>
  sleep(ms, undefined, { signal: cancel }).catch(() => undefined);

/**
 * Resolves when the run ends. A failed or cancelled run is read from the rows,
 * so only a lost start waits (the runner holds one grace period), then the
 * caller asks again. A runner that cannot be found or asked is the same as a
 * run that ended: the caller reads the rows next and surfaces a store failure.
 */
async function runEnded(
  deps: StartDeps,
  ref: TurnRef,
  cancel: AbortSignal,
): Promise<void> {
  try {
    const owner = await withTransaction(deps.db, (tx) =>
      deps.runners.ownerOf(tx, ref),
    );
    if (owner.ok) await owner.value.awaitEnd(ref, cancel);
  } catch {
    /* read rows on failure */
  }
}

function toGenerateResult(
  runId: string,
  result: TurnResult,
  abandoned: boolean,
): GenerateResult {
  return {
    runId,
    status: result.status,
    reason: result.reason,
    text: result.text,
    agentVersion: result.agentVersion,
    traceId: result.traceId,
    blockedActions: result.blocked.map((action) => ({
      toolCallId: action.actionId,
      toolName: action.toolKey,
      args: action.arguments,
      kind: action.kind,
      expiresAt: action.expiresAt,
    })),
    abandoned,
  };
}

export interface TurnIds {
  readonly threadId: string;
  readonly agentMessageId: string;
}

/**
 * D6: the workflow result, then the rows, until the message is terminal or
 * `paused`. When `abortSignal` fires, one stop request, then at most one more
 * grace period. Without a signal it waits as long as the turn runs.
 */
export async function awaitTurn(
  deps: StartDeps,
  caller: Caller,
  org: OrgId,
  ids: TurnIds,
  abortSignal: AbortSignal | undefined,
): Promise<GenerateResult> {
  const { threadId, agentMessageId } = ids;
  const graceMs = deps.config.START_GRACE_MS;
  const ref: TurnRef = { org, threadId, agentMessageId };
  const read = async () =>
    unwrap(await readTurnResult(deps, caller, org, agentMessageId));
  const done = new AbortController();
  try {
    for (;;) {
      const ended = await raceAbort(
        runEnded(deps, ref, done.signal),
        abortSignal,
      );
      if (ended === ABORTED) break;
      const result = await read();
      if (result.status !== MessageStatus.created) {
        return toGenerateResult(agentMessageId, result, false);
      }
      if (
        (await raceAbort(pause(graceMs, done.signal), abortSignal)) === ABORTED
      ) {
        break;
      }
    }
    unwrap(
      await requestStop(deps, caller, org, agentMessageId, StopKind.cancel),
    );
    await Promise.race([
      runEnded(deps, ref, done.signal),
      pause(graceMs, done.signal),
    ]);
    const result = await read();
    const terminal = TERMINAL_STATUSES.some((s) => s === result.status);
    return toGenerateResult(agentMessageId, result, !terminal);
  } finally {
    done.abort();
  }
}
