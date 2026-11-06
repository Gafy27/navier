import { err, ok, z } from '../../index.ts';
import type { Result } from '../../index.ts';
import type { OrgId } from '../../db/index.ts';
import type { Caller } from '../../identity/index.ts';
import { apiInternal } from './errors.ts';
import type { ApiFailure } from './errors.ts';
import { RouteKind, shapeProblem } from './route-types.ts';
import type { RouteContract } from './route-types.ts';

/** Wire shape for routes that return an empty object on success. */
export const emptyBody = {} as const;

/** Maps a store success; a failure passes through. */
export function mapOk<T, R>(
  result: Result<T>,
  to: (value: T) => R,
): Result<R, ApiFailure> {
  return result.ok ? ok(to(result.value)) : result;
}

/** An empty success; a failure passes through. */
export function emptyOk(
  result: Result<void>,
): Result<typeof emptyBody, ApiFailure> {
  return result.ok ? ok(emptyBody) : result;
}

/** The caller and org a protected route under `:org` always has. */
export function orgScoped<P, Q, B, R>(
  run: (
    caller: Caller,
    org: OrgId,
    ctx: HandlerContext<P, Q, B>,
  ) => Promise<Result<R, ApiFailure>>,
): Handler<P, Q, B, R> {
  return (ctx) =>
    ctx.caller === undefined || ctx.org === undefined
      ? Promise.resolve(err(apiInternal))
      : run(ctx.caller, ctx.org, ctx);
}

/** What a handler sees. Never Hono's context (D1). */
export interface HandlerContext<P, Q, B> {
  /** `undefined` only on a public entry. */
  readonly caller: Caller | undefined;
  /** Set when the path has `:org` (D3). */
  readonly org: OrgId | undefined;
  readonly params: P;
  readonly query: Q;
  readonly body: B;
  readonly signal: AbortSignal;
  /** Set only when the caller came through a session (B2). */
  readonly sessionHash: string | undefined;
  /** Adds a `sessionCookie` or `clearedSessionCookie` value to the response (B2). */
  readonly setCookie: (value: string) => void;
  /** Set from `resolveCaller`'s `via`; `undefined` on a public entry (PD7). */
  readonly credentialKind: 'bearer' | 'session' | undefined;
  /** Session: P13.2 refresh path; bearer: same `Caller` (PD7). */
  readonly refreshCaller:
    ((signal: AbortSignal) => Promise<Result<Caller, ApiFailure>>) | undefined;
  /** `SESSION_RECHECK_MS` for a session; `undefined` otherwise (PD7, L3). */
  readonly recheckBound: number | undefined;
  /** D5: `Last-Event-ID` when the client sent it; poll and SSE handlers merge with query. */
  readonly lastEventIdHeader: string | undefined;
}

export type Handler<P, Q, B, R> = (
  ctx: HandlerContext<P, Q, B>,
) => Promise<Result<R, ApiFailure>>;

/** A frame's cursor. `id: null` writes no `id:` line (PD7). */
export interface StreamFrame {
  readonly id: string | null;
}

/** Writes one SSE frame or comment. After a failure it writes nothing more (PD7). */
export interface SseWriter<E> {
  readonly event: (e: E) => Promise<void>;
  readonly comment: (text: 'open' | 'keepalive') => Promise<void>;
}

/** The raw text writer the adapter gives a stream body. */
export type TextWriter = (text: string) => Promise<unknown>;

export type StreamHandler<P, Q, B, E extends StreamFrame> = (
  ctx: HandlerContext<P, Q, B>,
) => Promise<
  Result<(sse: SseWriter<E>, signal: AbortSignal) => Promise<void>, ApiFailure>
>;

/** A contract and its handler, with the types erased for the route list. */
export interface BoundRoute {
  readonly contract: RouteContract<unknown, unknown, unknown, unknown, unknown>;
  // Method syntax on purpose: the adapter calls it with values the same contract's schemas parsed.
  handle(
    ctx: HandlerContext<unknown, unknown, unknown>,
  ): Promise<Result<unknown, ApiFailure>>;
  /** Set only by `bindStream` (PD7). The adapter runs it instead of `handle`. */
  streamHandle?(
    ctx: HandlerContext<unknown, unknown, unknown>,
  ): Promise<
    Result<
      (write: TextWriter, signal: AbortSignal) => Promise<void>,
      ApiFailure
    >
  >;
}

/** L2 and PD7: a protected entry names a check, and the entry has the shape of its kind. */
function refuse(
  contract: RouteContract<unknown, unknown, unknown, unknown, unknown>,
  kind: RouteKind,
): void {
  if (contract.public !== true && contract.check === undefined) {
    throw new Error(`${contract.operationId}: a protected route needs a check`);
  }
  const problem = shapeProblem(contract, kind);
  if (problem !== undefined) {
    throw new Error(`${contract.operationId}: ${problem}`);
  }
}

/** Pairs a json contract with its handler. Throws on a broken entry (L2, PD7). */
export function bind<P, Q, B, R, E>(
  contract: RouteContract<P, Q, B, R, E>,
  handle: Handler<P, Q, B, R>,
): BoundRoute {
  refuse(contract, RouteKind.enum.json);
  return { contract, handle };
}

/** A CR or LF in a cursor would start a second SSE field, so it is refused. */
const LINE_BREAK = /[\r\n]/u;

/** Encodes each frame with the contract's schema. A failed encode closes the writer. */
function sseWriter<E extends StreamFrame>(
  event: z.ZodType<E>,
  write: TextWriter,
): SseWriter<E> {
  let open = true;
  const send = async (text: string): Promise<void> => {
    if (!open) return;
    try {
      await write(text);
    } catch {
      open = false;
    }
  };
  return {
    event: async (e) => {
      const parsed = event.safeParse(e);
      if (!parsed.success) {
        open = false;
        return;
      }
      const id: string | null = parsed.data.id;
      if (id !== null && LINE_BREAK.test(id)) {
        open = false;
        return;
      }
      const idLine = id === null ? '' : `id: ${id}\n`;
      await send(`${idLine}data: ${JSON.stringify(parsed.data)}\n\n`);
    },
    comment: (text) => send(`: ${text}\n\n`),
  };
}

/** Pairs a stream contract with its handler. The body never throws out of the adapter (PD7). */
export function bindStream<P, Q, B, E extends StreamFrame>(
  contract: RouteContract<P, Q, B, unknown, E>,
  handle: StreamHandler<P, Q, B, E>,
): BoundRoute {
  refuse(contract, RouteKind.enum.stream);
  const { event } = contract;
  if (event === undefined) {
    throw new Error(`${contract.operationId}: a stream needs an event`);
  }
  return {
    contract,
    // Never called: the adapter sends a stream route to `streamHandle`.
    handle: () => Promise.resolve(err(apiInternal)),
    streamHandle: async (ctx: HandlerContext<P, Q, B>) => {
      const made = await handle(ctx);
      return made.ok
        ? ok((write: TextWriter, signal: AbortSignal) =>
            made.value(sseWriter(event, write), signal),
          )
        : made;
    },
  };
}
