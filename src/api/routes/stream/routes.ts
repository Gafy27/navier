import { JsonValueSchema, z } from '../../../index.ts';
import {
  CheckKind,
  defineRoute,
  Method,
  WireType,
} from '../../adapter/route-types.ts';

/** The OpenAPI tag of the stream routes. */
const STREAM_TAG = 'stream';

/** A copy of the runtime's `DeltaKind`. `api` may not hold the client's import rule, so it is written out. */
const DeltaKindWire = z.enum(['text', 'reasoning']);

/** A copy of the runtime's `TERMINAL_STATUSES`. A test holds the two lists equal. */
export const TerminalStatusWire = z.enum([
  'succeeded',
  'errored',
  'cancelled',
  'interrupted',
  'gracefully_stopped',
  'max_steps',
  'expired',
]);

/** One frame of the message channel (PD13 keeps conversation events apart). */
export const streamEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    id: z.string(),
    kind: z.literal('delta'),
    delta: DeltaKindWire,
    traceId: z.string(),
    text: z.string(),
  }),
  z.strictObject({
    id: z.string(),
    kind: z.enum(['step', 'tool', 'action']),
    data: JsonValueSchema,
  }),
  z.strictObject({
    id: z.string(),
    kind: z.literal('terminal'),
    status: TerminalStatusWire,
  }),
  z.strictObject({
    id: z.string(),
    kind: z.literal('blocked'),
    actions: z.array(
      z.strictObject({
        actionId: z.string(),
        kind: z.enum(['approval', 'authentication', 'retry']),
        canRemember: z.boolean(),
      }),
    ),
  }),
  z.strictObject({ id: z.string(), kind: z.literal('end-of-stream') }),
  z.strictObject({
    id: z.string().nullable(),
    kind: z.literal('rollover'),
    reason: z.enum(['lifetime', 'credential_expired']),
  }),
]);
export type StreamEventWire = z.infer<typeof streamEventSchema>;

/** The poll answer: data frames after the cursor, and the cursor to send next (D5). */
export const pollResponseSchema = z.strictObject({
  events: z.array(streamEventSchema),
  lastEventId: z.string().nullable(),
});
export type PollResponse = z.infer<typeof pollResponseSchema>;

const ERRORS = [
  WireType.enum.unauthenticated,
  WireType.enum.forbidden,
  WireType.enum.not_found,
  WireType.enum.invalid_request,
  WireType.enum.unavailable,
  WireType.enum.internal,
];
const base = { tag: STREAM_TAG, errors: ERRORS } as const;

const Id = z.string().min(1);
const messageParams = z.strictObject({ org: Id, conv: Id, msg: Id });

/** The cursor query half of D5; the adapter also passes `Last-Event-ID` on the context. */
const PollQuery = z.object({ lastEventId: z.string().optional() });

/**
 * The adapter checks only that the caller is authenticated. The `can_read` check
 * on the conversation runs in the handler, after `refreshCaller` (PD11, L2).
 */
const callerOnly = { kind: CheckKind.enum.caller } as const;

export const pollMessageEvents = defineRoute({
  ...base,
  operationId: 'pollMessageEvents',
  summary:
    'Polls the message channel: data frames after the cursor, held up to streamPollHold when empty (P13.6 D5)',
  method: Method.enum.GET,
  path: '/orgs/:org/conversations/:conv/messages/:msg/events/poll',
  check: callerOnly,
  params: messageParams,
  query: PollQuery,
  response: pollResponseSchema,
});

/** SSE on the message channel: frames after the cursor, `end-of-stream` after the terminal (PD10, PD12). */
export const streamMessageEvents = defineRoute({
  ...base,
  kind: 'stream',
  event: streamEventSchema,
  operationId: 'message',
  summary:
    'Streams the message channel over SSE until end-of-stream, a failed check, or rollover (P13.6 D4, L2, L3)',
  method: Method.enum.GET,
  path: '/orgs/:org/conversations/:conv/messages/:msg/events',
  check: callerOnly,
  params: messageParams,
  query: PollQuery,
});

export const streamRoutes = {
  message: streamMessageEvents,
  pollMessageEvents,
} as const;
