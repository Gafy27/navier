import { z } from '../index.ts';
import { catalog } from '../api/catalog.ts';
import { RouteKind, WireType } from '../api/adapter/route-types.ts';
import type { RouteContract } from '../api/adapter/route-types.ts';
import { readStream, StreamFailure } from './stream.ts';
import type { Connect } from './stream.ts';

export { WireType };

type AnyContract = RouteContract<unknown, unknown, unknown, unknown, unknown>;

/** A query exists only when the contract has a schema for it. */
type QueryOf<Q> = unknown extends Q ? unknown : Q;
type BodyOf<B> = unknown extends B ? unknown : { readonly body: B };
/** An empty `z.strictObject({})` infers `Record<string, never>`, which would reject `body`; it adds no keys but still refuses primitives. */
type KeysOf<T> = string extends keyof T ? object : T;

/** Path parameters and query keys sit side by side; the body sits under `body`. */
export type InputOf<C> =
  C extends RouteContract<infer P, infer Q, infer B, unknown, unknown>
    ? KeysOf<P> & KeysOf<QueryOf<Q>> & BodyOf<B>
    : never;

export type OutputOf<C> =
  C extends RouteContract<unknown, unknown, unknown, infer R> ? R : never;

/** The frame type of a stream entry: the type its `event` schema parses to (PD10). */
export type EventOf<C> =
  C extends RouteContract<unknown, unknown, unknown, unknown, infer E>
    ? E
    : never;

export type ClientResult<R> =
  | { readonly ok: true; readonly value: R }
  | {
      readonly ok: false;
      readonly status: number;
      readonly error: { readonly type: WireType; readonly message: string };
    };

/** The keys that get a top-level method: every key but a stream entry (PD3, PD7). */
type PlainKeys<C> = {
  [K in keyof C]: C[K] extends { readonly kind?: typeof RouteKind.enum.stream }
    ? never
    : K;
}[keyof C];

/** The keys that get a `stream` method: the `kind: 'stream'` entries (PD10). */
type StreamKeys<C> = {
  [K in keyof C]: C[K] extends { readonly kind?: typeof RouteKind.enum.stream }
    ? K
    : never;
}[keyof C];

/** `client.stream.<key>` yields the frames of one stream entry until it ends or fails (PD6). */
export type StreamOf<C> = {
  [K in StreamKeys<C> & keyof C]: (
    input: InputOf<C[K]>,
    init?: { readonly signal?: AbortSignal },
  ) => AsyncIterable<EventOf<C[K]>>;
};

export type ClientOf<C> = {
  [K in PlainKeys<C> & keyof C]: (
    input: InputOf<C[K]>,
    init?: { readonly signal?: AbortSignal },
  ) => Promise<ClientResult<OutputOf<C[K]>>>;
} & { readonly stream: StreamOf<C> };

/** The message channel's frame type, read from its catalog entry (PD10). */
export type StreamEvent = EventOf<(typeof catalog)['message']>;

/** The catalog entries that get a top-level method (PD3, PD7). */
export function clientCatalogKeys<
  C extends Readonly<Record<string, AnyContract>>,
>(c: C): Pick<C, PlainKeys<C>> {
  const plain = Object.entries(c).filter(
    ([, contract]) => contract.kind !== RouteKind.enum.stream,
  );
  return Object.fromEntries(plain) as unknown as Pick<C, PlainKeys<C>>;
}

/** A route's params, query, or body: each is a zod object in every contract. */
function objectOf(schema: z.ZodType): z.ZodObject {
  if (schema instanceof z.ZodObject) return schema;
  throw new TypeError('a route input must be a zod object');
}

/** One operation's input: path params, query keys, and `body` (PD6, D6). */
export function inputSchemaOf(contract: AnyContract): z.ZodObject {
  const { body } = contract;
  return z.object({
    ...objectOf(contract.params).shape,
    ...(contract.query === undefined ? {} : objectOf(contract.query).shape),
    ...(body === undefined ? {} : { body }),
  });
}

export interface CatalogOperation {
  readonly operationId: string;
  readonly summary: string;
  readonly kind: 'plain' | 'stream';
  /** `inputSchemaOf(contract)` for this operation. */
  readonly input: z.ZodObject;
}

/** One row per `catalog` entry, built from it; no second list (D6). */
export function listCatalogOperations(): readonly CatalogOperation[] {
  return Object.values<AnyContract>(catalog).map(
    (contract): CatalogOperation => ({
      operationId: contract.operationId,
      summary: contract.summary,
      kind: contract.kind === RouteKind.enum.stream ? 'stream' : 'plain',
      input: inputSchemaOf(contract),
    }),
  );
}

/** The browser URL that starts a CLI loopback login (D1). */
export function loginUrl(
  baseUrl: string,
  query: { readonly return: string; readonly handoffChallenge: string },
): string {
  const url = new URL(baseUrl + API_PREFIX + catalog.login.path);
  url.searchParams.set('return', query.return);
  url.searchParams.set('handoff_challenge', query.handoffChallenge);
  return url.toString();
}

export interface ClientOptions {
  readonly baseUrl: string;
  /** Sent as a bearer when it returns a string. */
  readonly credential: () => string | undefined;
  readonly fetch?: (req: Request) => Promise<Response>;
}

const API_PREFIX = '/api/v1';
const BODY_KEY = 'body';
const CURSOR_KEY = 'lastEventId';
const LAST_EVENT_ID = 'last-event-id';
const REDIRECT_STATUS = 302;
const PATH_PARAM = /:(\w+)/gu;

const ErrorEnvelope = z.object({
  error: z.object({ type: z.enum(WireType.options), message: z.string() }),
});

function failure(
  status: number,
  type: WireType,
  message: string,
): ClientResult<never> {
  return { ok: false, status, error: { type, message } };
}

/** The request for one contract: path, query, bearer, and body. `credential()` runs here, so every connect reads it again. */
function requestOf(
  options: ClientOptions,
  contract: AnyContract,
  input: Readonly<Record<string, unknown>>,
  signal: AbortSignal | undefined,
): Request {
  const pathNames = new Set<string>();
  const path = contract.path.replaceAll(PATH_PARAM, (_whole, name: string) => {
    pathNames.add(name);
    return encodeURIComponent(String(input[name]));
  });
  const url = new URL(options.baseUrl + API_PREFIX + path);
  if (contract.query !== undefined) {
    for (const [name, value] of Object.entries(input)) {
      if (pathNames.has(name) || name === BODY_KEY) continue;
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        url.searchParams.set(name, String(value));
      }
    }
  }
  const headers = new Headers();
  const credential = options.credential();
  if (typeof credential === 'string') {
    headers.set('authorization', `Bearer ${credential}`);
  }
  let body: string | null = null;
  if (contract.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(input[BODY_KEY]);
  }
  return new Request(url, {
    method: contract.method,
    headers,
    body,
    redirect: 'manual',
    ...(signal === undefined ? {} : { signal }),
  });
}

async function send(
  options: ClientOptions,
  contract: AnyContract,
  input: Readonly<Record<string, unknown>>,
  signal: AbortSignal | undefined,
): Promise<ClientResult<unknown>> {
  const res = await (options.fetch ?? fetch)(
    requestOf(options, contract, input, signal),
  );
  if (contract.redirect !== undefined && res.status === REDIRECT_STATUS) {
    return { ok: true, value: undefined };
  }
  const json: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const envelope = ErrorEnvelope.safeParse(json);
    return envelope.success
      ? { ok: false, status: res.status, error: envelope.data.error }
      : failure(res.status, WireType.enum.internal, 'unexpected response');
  }
  const parsed = contract.response?.safeParse(json);
  return parsed?.success === true
    ? { ok: true, value: parsed.data }
    : failure(res.status, WireType.enum.internal, 'unexpected response');
}

/**
 * The connect of one stream call. The cursor goes in `Last-Event-ID` and never in the
 * query, so the two cannot disagree (D5). A refused connect throws as a `StreamFailure`.
 */
function connectTo(
  options: ClientOptions,
  contract: AnyContract,
  input: Readonly<Record<string, unknown>>,
  signal: AbortSignal | undefined,
): Connect {
  const query = Object.fromEntries(
    Object.entries(input).filter(([name]) => name !== CURSOR_KEY),
  );
  return async (lastEventId) => {
    const request = requestOf(options, contract, query, signal);
    if (lastEventId !== undefined) {
      request.headers.set(LAST_EVENT_ID, lastEventId);
    }
    const res = await (options.fetch ?? fetch)(request);
    if (res.ok) return res;
    const json: unknown = await res.json().catch(() => undefined);
    const envelope = ErrorEnvelope.safeParse(json);
    if (!envelope.success) {
      throw new StreamFailure(
        res.status,
        WireType.enum.internal,
        'unexpected response',
      );
    }
    throw new StreamFailure(
      res.status,
      envelope.data.error.type,
      envelope.data.error.message,
    );
  };
}

/** A stream entry: a `kind: 'stream'` contract with its event schema. */
function isStreamEntry(
  entry: [string, AnyContract],
): entry is [string, AnyContract & { readonly event: z.ZodType }] {
  return (
    entry[1].kind === RouteKind.enum.stream && entry[1].event !== undefined
  );
}

/** The cursor a stream call starts from: the caller's `lastEventId`, if it gave one. */
function startOf(input: Readonly<Record<string, unknown>>): string | undefined {
  const cursor = input[CURSOR_KEY];
  return typeof cursor === 'string' ? cursor : undefined;
}

/** One method per `catalog` key, typed by the contract, and one `stream` method per stream key (D4, PD10). No generator. */
export function createClient(options: ClientOptions): ClientOf<typeof catalog> {
  const methods = Object.fromEntries(
    Object.entries<AnyContract>(clientCatalogKeys(catalog)).map(
      ([name, contract]) => [
        name,
        (
          input: Readonly<Record<string, unknown>>,
          init?: { signal?: AbortSignal },
        ) => send(options, contract, input, init?.signal),
      ],
    ),
  );
  const streams = Object.fromEntries(
    Object.entries<AnyContract>(catalog)
      .filter(isStreamEntry)
      .map(([name, contract]) => [
        name,
        (
          input: Readonly<Record<string, unknown>>,
          init?: { signal?: AbortSignal },
        ) =>
          readStream(
            connectTo(options, contract, input, init?.signal),
            contract.event,
            startOf(input),
          ),
      ]),
  );
  // shortcut: the keys are the catalog's own, which the type cannot see through fromEntries; the contract test checks them.
  return { ...methods, stream: streams } as unknown as ClientOf<typeof catalog>;
}
