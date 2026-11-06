import { appError, err, ErrorCode, ok } from '../../../index.ts';
import type { Result } from '../../../index.ts';
import type { OrgId } from '../../../db/index.ts';
import type { Caller } from '../../../identity/index.ts';
import {
  pauseTimeoutSeconds,
  readOrgConfig,
} from '../../../orgconfig/index.ts';
import {
  parseCursor,
  readConversation,
  readMessageEvents,
} from '../../../runtime/index.ts';
import type { Cursor, StreamEvent } from '../../../runtime/index.ts';
import type { ApiDeps } from '../../adapter/app.ts';
import type { ApiFailure } from '../../adapter/errors.ts';
import { apiInternal, apiNotFound } from '../../adapter/errors.ts';
import type {
  BoundRoute,
  HandlerContext,
  SseWriter,
} from '../../adapter/route.ts';
import { bind, bindStream, orgScoped } from '../../adapter/route.ts';
import {
  ConversationAction,
  requireConversation,
} from '../../conversation-access.ts';
import { pollMessageEvents, streamMessageEvents } from './routes.ts';
import type { PollResponse, StreamEventWire } from './routes.ts';

const MS_PER_SECOND = 1000;

/** D5: one cursor from `Last-Event-ID` and `lastEventId`; both must match when both are sent. */
export function resolveStreamCursor(
  header: string | undefined,
  query: string | undefined,
  channel: 'message' | 'conversation',
): Result<
  {
    readonly after: Cursor | undefined;
    readonly requestId: string | undefined;
  },
  ApiFailure
> {
  if (header !== undefined && query !== undefined && header !== query) {
    return err(
      appError(ErrorCode.invalid_argument, 'lastEventId: cursor mismatch'),
    );
  }
  const raw = header ?? query;
  const parsed = parseCursor(raw, channel);
  if (!parsed.ok) return parsed;
  return ok({ after: parsed.value, requestId: raw });
}

/** A duration of the org snapshot, in milliseconds. Its grammar is the pause timeout's. */
const toMs = (duration: string): number =>
  pauseTimeoutSeconds(duration) * MS_PER_SECOND;

/** What the stream routes read from the handler context before any frame. */
type StreamCtx = Pick<
  HandlerContext<unknown, unknown, unknown>,
  | 'credentialKind'
  | 'lastEventIdHeader'
  | 'recheckBound'
  | 'refreshCaller'
  | 'signal'
>;

/**
 * L2, PD11: refresh the caller, then `can_read` on the conversation. Runs on
 * every connect and every recheck; a failed check answers with no data.
 */
async function access(
  deps: ApiDeps,
  ctx: Pick<StreamCtx, 'refreshCaller' | 'signal'>,
  org: OrgId,
  conv: string,
): Promise<Result<Caller, ApiFailure>> {
  if (ctx.refreshCaller === undefined) return err(apiInternal);
  const refreshed = await ctx.refreshCaller(ctx.signal);
  if (!refreshed.ok) return refreshed;
  const granted = await requireConversation(
    deps.authzAdmin,
    refreshed.value,
    org,
    conv,
    ConversationAction.enum.can_read,
  );
  return granted.ok ? ok(refreshed.value) : granted;
}

/**
 * C6: `:msg` must be an agent message of `:conv`. A hidden conversation and a
 * missing message answer the same `not_found`.
 */
async function isAgentMessage(
  deps: ApiDeps,
  org: OrgId,
  conv: string,
  msg: string,
): Promise<Result<void, ApiFailure>> {
  const view = await readConversation(deps.db, org, conv);
  if (!view.ok) {
    return view.error.code === ErrorCode.not_found ? err(apiNotFound) : view;
  }
  const found = view.value.messages.find((m) => m.id === msg);
  return found?.role === 'agent' ? ok(undefined) : err(apiNotFound);
}

/** What both message routes hold before the first read: caller, cursor, and D4 timings in ms (recheck capped by PD11). */
interface StreamStart {
  readonly caller: Caller;
  readonly after: Cursor | undefined;
  readonly requestId: string | undefined;
  readonly holdMs: number;
  readonly keepaliveMs: number;
  readonly lifetimeMs: number;
  readonly recheckMs: number;
}

/**
 * The pre-stream steps both routes share (L2, C6, D4, D5): access, the agent-message
 * check, the cursor, and the snapshot. A failure answers before any frame.
 */
async function startStream(
  deps: ApiDeps,
  ctx: StreamCtx,
  org: OrgId,
  conv: string,
  msg: string,
  query: string | undefined,
): Promise<Result<StreamStart, ApiFailure>> {
  const granted = await access(deps, ctx, org, conv);
  if (!granted.ok) return granted;
  const member = await isAgentMessage(deps, org, conv, msg);
  if (!member.ok) return member;
  const cursor = resolveStreamCursor(ctx.lastEventIdHeader, query, 'message');
  if (!cursor.ok) return cursor;
  const config = await readOrgConfig(deps.db, org);
  if (!config.set) {
    return err(appError(ErrorCode.invalid_argument, 'org config: not set'));
  }
  const { snapshot } = config;
  return ok({
    caller: granted.value,
    after: cursor.value.after,
    requestId: cursor.value.requestId,
    holdMs: toMs(snapshot.streamPollHold),
    keepaliveMs: toMs(snapshot.streamKeepalive),
    lifetimeMs: toMs(snapshot.streamMaxLifetime),
    recheckMs: Math.min(
      toMs(snapshot.streamAccessRecheck),
      ctx.recheckBound ?? Number.POSITIVE_INFINITY,
    ),
  });
}

/** The SSE body, after the checks pass. It returns on any failure with no frame (PD10, L2). */
async function pumpStream(
  deps: ApiDeps,
  ctx: StreamCtx,
  start: StreamStart,
  org: OrgId,
  conv: string,
  msg: string,
  sse: SseWriter<StreamEventWire>,
  signal: AbortSignal,
): Promise<void> {
  // L3, PD12: a bearer stream ends at its token's `exp` when that comes first.
  let deadline = Date.now() + start.lifetimeMs;
  let reason: 'lifetime' | 'credential_expired' = 'lifetime';
  if (
    ctx.credentialKind === 'bearer' &&
    start.caller.expiresAt.getTime() < deadline
  ) {
    deadline = start.caller.expiresAt.getTime();
    reason = 'credential_expired';
  }

  let cursor = start.after;
  let lastId = start.requestId ?? null;
  let nextCheck = Date.now() + start.recheckMs;
  let nextKeepalive = Date.now() + start.keepaliveMs;
  await sse.comment('open');

  for (;;) {
    if (signal.aborted) return;
    const read = await readMessageEvents(
      deps.db,
      org,
      msg,
      cursor,
      deps.config.STREAM_READ_BATCH_SIZE,
    );
    if (!read.ok) return;
    for (const e of read.value.events) {
      if (e.id === null) return;
      await sse.event(e);
      lastId = e.id;
      nextKeepalive = Date.now() + start.keepaliveMs;
      const next = parseCursor(e.id, 'message');
      if (!next.ok) return;
      cursor = next.value;
      if (e.kind === 'end-of-stream') return;
    }

    if (Date.now() >= deadline) {
      await sse.event({ id: lastId, kind: 'rollover', reason });
      return;
    }
    if (Date.now() >= nextCheck) {
      const again = await access(deps, ctx, org, conv);
      if (!again.ok) return;
      nextCheck = Date.now() + start.recheckMs;
    }
    if (Date.now() >= nextKeepalive) {
      await sse.comment('keepalive');
      nextKeepalive = Date.now() + start.keepaliveMs;
    }
    // More rows may be waiting past the batch; read again before parking on the hub.
    if (read.value.events.length > 0) continue;
    const wait = Math.min(nextKeepalive, nextCheck, deadline) - Date.now();
    await deps.streamHub.wait(
      { org, messageId: msg },
      signal,
      Math.max(0, wait),
    );
  }
}

/** The stream routes this file serves: the message SSE route and its poll. */
export function stream(deps: ApiDeps): BoundRoute[] {
  return [
    bindStream(
      streamMessageEvents,
      orgScoped(async (_caller, org, ctx) => {
        const started = await startStream(
          deps,
          ctx,
          org,
          ctx.params.conv,
          ctx.params.msg,
          ctx.query.lastEventId,
        );
        if (!started.ok) return started;
        const { conv, msg } = ctx.params;
        return ok((sse: SseWriter<StreamEventWire>, signal: AbortSignal) =>
          pumpStream(deps, ctx, started.value, org, conv, msg, sse, signal),
        );
      }),
    ),
    bind(
      pollMessageEvents,
      orgScoped(async (_caller, org, ctx) => {
        const started = await startStream(
          deps,
          ctx,
          org,
          ctx.params.conv,
          ctx.params.msg,
          ctx.query.lastEventId,
        );
        if (!started.ok) return started;
        const { after, requestId, holdMs, recheckMs } = started.value;
        const read = () =>
          readMessageEvents(
            deps.db,
            org,
            ctx.params.msg,
            after,
            deps.config.STREAM_READ_BATCH_SIZE,
          );
        /** D5: the last event's id, or the request cursor when nothing was sent. */
        const answer = (events: readonly StreamEvent[]): PollResponse => {
          const last = events.at(-1);
          return {
            events: [...events],
            lastEventId: last === undefined ? (requestId ?? null) : last.id,
          };
        };

        const first = await read();
        if (!first.ok) return first;
        if (first.value.events.length > 0)
          return ok(answer(first.value.events));

        // D4, D2: hold on the hub until a row, the hold's end, a due recheck, or a failed check.
        const deadline = Date.now() + holdMs;
        let nextCheck = Date.now() + recheckMs;
        for (;;) {
          const now = Date.now();
          if (ctx.signal.aborted || now >= deadline) return ok(answer([]));
          await deps.streamHub.wait(
            { org, messageId: ctx.params.msg },
            ctx.signal,
            Math.min(deadline, nextCheck) - now,
          );
          if (Date.now() >= nextCheck) {
            const again = await access(deps, ctx, org, ctx.params.conv);
            if (!again.ok) return again;
            nextCheck = Date.now() + recheckMs;
          }
          const next = await read();
          if (!next.ok) return next;
          if (next.value.events.length > 0)
            return ok(answer(next.value.events));
        }
      }),
    ),
  ];
}
