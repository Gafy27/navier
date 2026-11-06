import type { z } from '../index.ts';
import { WireType } from '../api/adapter/route-types.ts';
import { parseSse } from './sse.ts';

/** A stream that ends with a failure: a refused connect, a frame that does not parse, or a network error (PD6). */
export class StreamFailure extends Error {
  readonly status: number;
  readonly type: WireType;

  constructor(status: number, type: WireType, message: string) {
    super(message);
    this.name = 'StreamFailure';
    this.status = status;
    this.type = type;
  }
}

/** Opens one request. The cursor goes as `Last-Event-ID`; `undefined` sends none. The credential is read here (PD6). */
export type Connect = (lastEventId: string | undefined) => Promise<Response>;

const DECIMAL = /^\d+$/u;

function wireFailure(status: number): StreamFailure {
  return new StreamFailure(
    status,
    WireType.enum.internal,
    'unexpected response',
  );
}

/** Parses one SSE `data:` block; control and data frames share the same schema `kind` field. */
function decodeFrame(
  event: z.ZodType,
  data: string,
  status: number,
): { readonly kind: string } {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    throw wireFailure(status);
  }
  const parsed = event.safeParse(json);
  if (!parsed.success) throw wireFailure(status);
  const frame = parsed.data as { kind: string };
  return frame;
}

/**
 * One channel's reader (PD6, L4). One call holds one cursor: it starts at `start`, sends
 * the cursor on every connect, and drops a data frame at or before it. `rollover` reconnects
 * at once with the frame id, or the own cursor when the id is `null`. A bare close (no
 * control frame) reconnects once; the budget comes back on a new data frame. `end-of-stream`
 * is yielded and ends the iterable. A failed connect or a bad frame throws, with no retry.
 */
export async function* readStream(
  connect: Connect,
  event: z.ZodType,
  start: string | undefined,
): AsyncGenerator<unknown, void, undefined> {
  let cursor = start;
  let bareCloseRetry = true;
  for (;;) {
    const res = await connect(cursor);
    if (res.body === null) throw wireFailure(res.status);
    let rolledOver = false;
    for await (const frame of parseSse(res.body)) {
      const parsed = decodeFrame(event, frame.data, res.status);
      if (parsed.kind === 'rollover') {
        cursor = frame.id ?? cursor;
        rolledOver = true;
        break;
      }
      if (parsed.kind === 'end-of-stream') {
        yield parsed;
        return;
      }
      if (frame.id === undefined || !DECIMAL.test(frame.id)) {
        throw wireFailure(res.status);
      }
      if (
        cursor !== undefined &&
        Number(frame.id) <= Number.parseInt(cursor, 10)
      ) {
        continue;
      }
      cursor = frame.id;
      bareCloseRetry = true;
      yield parsed;
    }
    if (rolledOver) continue;
    if (!bareCloseRetry) return;
    bareCloseRetry = false;
  }
}
