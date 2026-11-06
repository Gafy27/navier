import { z } from '../../index.ts';
import type { ScopeActionOf, ScopeResource } from './scope-names.ts';

export const Method = z.enum({
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
});
export type Method = z.infer<typeof Method>;

/** The closed set of error `type`s on the wire (D5). */
export const WireType = z.enum({
  unauthenticated: 'unauthenticated',
  forbidden: 'forbidden',
  not_found: 'not_found',
  invalid_request: 'invalid_request',
  conflict: 'conflict',
  already_running: 'already_running',
  payload_too_large: 'payload_too_large',
  unavailable: 'unavailable',
  internal: 'internal',
});
export type WireType = z.infer<typeof WireType>;

/** The OpenAPI tag of each route group. */
export const RouteTag = z.enum({
  auth: 'auth',
  platform: 'platform',
  authz: 'authz',
  agents: 'agents',
  tools: 'tools',
  config: 'config',
});
export type RouteTag = z.infer<typeof RouteTag>;

/** The one redirect status a contract may name (P13.2). */
export const RedirectStatus = z.enum({ found: 302 });
export type RedirectStatus = z.infer<typeof RedirectStatus>;

/** A JSON route answers once; a stream route writes SSE frames (PD7). */
export const RouteKind = z.enum({ json: 'json', stream: 'stream' });
export type RouteKind = z.infer<typeof RouteKind>;

export const CheckKind = z.enum({
  caller: 'caller',
  store: 'store',
  scope: 'scope',
  object: 'object',
});
export type CheckKind = z.infer<typeof CheckKind>;

/** The route's check, as data (L2, PD2). `object` is a type only until P13.3. */
export type Check =
  | { readonly kind: typeof CheckKind.enum.caller }
  | { readonly kind: typeof CheckKind.enum.store }
  | {
      [R in ScopeResource]: {
        readonly kind: typeof CheckKind.enum.scope;
        readonly resource: R;
        readonly action: ScopeActionOf[R];
        /** The id comes from this path parameter. */
        readonly idParam?: string;
        /** The id is this fixed value, as in `org:config:admin`. */
        readonly id?: string;
      };
    }[ScopeResource]
  | {
      readonly kind: typeof CheckKind.enum.object;
      readonly type: string;
      readonly idParams: readonly string[];
      readonly action: `can_${string}`;
    };

export interface RouteContract<P, Q, B, R, E = never> {
  /** Stable client method name; equals the key in `catalog`. */
  readonly operationId: string;
  readonly summary: string;
  readonly tag: string;
  /** The error types this route can return, a subset of D5 (G1). */
  readonly errors: readonly WireType[];
  /** ISO date. */
  readonly deprecated?: string;
  readonly method: Method;
  /** Relative to `/api/v1` (D3). */
  readonly path: `/${string}`;
  /** Default protected (L1). */
  readonly public?: true;
  /** Absent only when public. */
  readonly check?: Check;
  readonly params: z.ZodType<P>;
  readonly query?: z.ZodType<Q>;
  /** A strict object: an unknown field is `invalid_request`. */
  readonly body?: z.ZodType<B>;
  /** Absent when `redirect` is set or `kind` is `stream` (PD7). */
  readonly response?: z.ZodType<R>;
  /** Location header, no body, no client parse (P13.2). */
  readonly redirect?: RedirectStatus;
  /** Default `json` (PD7). */
  readonly kind?: RouteKind;
  /** One SSE data frame. Required when `kind` is `stream`, absent otherwise (PD7). */
  readonly event?: z.ZodType<E>;
}

/** Keeps the `kind` literal, so `ClientOf` can skip a stream key (PD7). */
export function defineRoute<
  P,
  Q,
  B,
  R,
  E = never,
  K extends RouteKind = 'json',
>(
  c: RouteContract<P, Q, B, R, E> & { readonly kind?: K },
): RouteContract<P, Q, B, R, E> & { readonly kind?: K } {
  return c;
}

/**
 * The PD7 entry-shape rule `bind` and `bindStream` refuse, or `undefined`. A stream
 * has an event and no response or redirect. A json route has a response or a redirect and no event.
 */
export function shapeProblem(
  c: RouteContract<unknown, unknown, unknown, unknown, unknown>,
  want: RouteKind,
): string | undefined {
  const kind = c.kind ?? RouteKind.enum.json;
  if (kind !== want) return `kind is ${kind}, not ${want}`;
  if (want === RouteKind.enum.stream) {
    if (c.event === undefined) return 'a stream needs an event';
    if (c.response !== undefined || c.redirect !== undefined)
      return 'a stream has no response or redirect';
    return undefined;
  }
  if (c.event !== undefined) return 'a json route has no event';
  if (c.response === undefined && c.redirect === undefined)
    return 'a json route needs a response or a redirect';
  return undefined;
}
