import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from '../index.ts';
import { WireType } from '../api/adapter/route-types.ts';
import { readStream, StreamFailure } from './stream.ts';
import type { Connect } from './stream.ts';

/** The reader is schema-agnostic; this frame schema covers the kinds it reads. */
const Frame = z.discriminatedUnion('kind', [
  z.object({ id: z.string(), kind: z.literal('delta') }),
  z.object({ id: z.string(), kind: z.literal('end-of-stream') }),
  z.object({ id: z.string().nullable(), kind: z.literal('rollover') }),
]);

/** One data frame, the way the server writes it: `id:` line and JSON `id`. */
const dataFrame = (id: string): string =>
  `id: ${id}\ndata: ${JSON.stringify({ id, kind: 'delta' })}\n\n`;

/** A rollover with its `id:` line only when `id` is not null (D5). */
const rolloverFrame = (id: string | null): string =>
  `${id === null ? '' : `id: ${id}\n`}data: ${JSON.stringify({ id, kind: 'rollover' })}\n\n`;

const endOfStreamFrame = (id: string): string =>
  `id: ${id}\ndata: ${JSON.stringify({ id, kind: 'end-of-stream' })}\n\n`;

/** A 200 response whose body is the given SSE text. */
const sseResponse = (...blocks: string[]): Response =>
  new Response(blocks.join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });

/**
 * A connect that answers from `script` in order and records each cursor it was given.
 * An `Error` entry throws, as a refused connect does.
 */
function scripted(...script: (Response | Error)[]): {
  connect: Connect;
  cursors: (string | undefined)[];
} {
  const cursors: (string | undefined)[] = [];
  const connect: Connect = (lastEventId) => {
    cursors.push(lastEventId);
    const next = script.shift();
    if (next === undefined) throw new Error('no scripted connect left');
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  return { connect, cursors };
}

async function drain(
  iterable: AsyncIterable<unknown>,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for await (const frame of iterable)
    out.push(frame as Record<string, unknown>);
  return out;
}

const idsOf = (frames: Record<string, unknown>[]): unknown[] =>
  frames.map((f) => f['id']);

void test('PD6, V38: a reconnect resends frames at or before the cursor; only the new ones are yielded', async () => {
  const { connect, cursors } = scripted(
    sseResponse(dataFrame('1'), dataFrame('2'), dataFrame('3')),
    sseResponse(
      dataFrame('2'),
      dataFrame('3'),
      dataFrame('4'),
      endOfStreamFrame('4.end'),
    ),
  );
  const frames = await drain(readStream(connect, Frame, undefined));
  assert.deepEqual(idsOf(frames), ['1', '2', '3', '4', '4.end']);
  assert.deepEqual(cursors, [undefined, '3']);
});

void test('PD6, L4: a start cursor drops every data frame at or before it', async () => {
  const { connect, cursors } = scripted(
    sseResponse(
      dataFrame('1'),
      dataFrame('2'),
      dataFrame('3'),
      endOfStreamFrame('3.end'),
    ),
  );
  const frames = await drain(readStream(connect, Frame, '2'));
  assert.deepEqual(idsOf(frames), ['3', '3.end']);
  assert.deepEqual(cursors, ['2']);
});

void test('PD6, V39: rollover reconnects at once with the frame id, then with the own cursor when the id is null', async () => {
  const { connect, cursors } = scripted(
    sseResponse(dataFrame('1'), rolloverFrame('4')),
    sseResponse(dataFrame('5'), rolloverFrame(null)),
    sseResponse(dataFrame('6'), endOfStreamFrame('6.end')),
  );
  const frames = await drain(readStream(connect, Frame, undefined));
  assert.deepEqual(idsOf(frames), ['1', '5', '6', '6.end']);
  assert.deepEqual(cursors, [undefined, '4', '5']);
});

void test('PD6, V39: a bare close reconnects exactly once; a failed reconnect ends the iterable with that failure', async () => {
  const refused = new StreamFailure(401, WireType.enum.unauthenticated, 'm');
  const { connect, cursors } = scripted(sseResponse(dataFrame('1')), refused);
  await assert.rejects(drain(readStream(connect, Frame, undefined)), refused);
  assert.deepEqual(cursors, [undefined, '1']);
});

void test('PD6, V39: a second bare close with no frame in between ends the iterable with no third connect', async () => {
  const { connect, cursors } = scripted(
    sseResponse(dataFrame('1')),
    sseResponse(),
    sseResponse(dataFrame('9')),
  );
  const frames = await drain(readStream(connect, Frame, undefined));
  assert.deepEqual(idsOf(frames), ['1']);
  assert.deepEqual(cursors, [undefined, '1']);
});

void test('PD6: a bare close after a new frame gets its own reconnect', async () => {
  const { connect, cursors } = scripted(
    sseResponse(dataFrame('1')),
    sseResponse(dataFrame('2')),
    sseResponse(endOfStreamFrame('2.end')),
  );
  const frames = await drain(readStream(connect, Frame, undefined));
  assert.deepEqual(idsOf(frames), ['1', '2', '2.end']);
  assert.deepEqual(cursors, [undefined, '1', '2']);
});

void test('PD6, G1: end-of-stream is the last frame yielded; no reconnect follows it', async () => {
  const { connect, cursors } = scripted(
    sseResponse(dataFrame('1'), endOfStreamFrame('1.end')),
  );
  const frames = await drain(readStream(connect, Frame, undefined));
  assert.deepEqual(idsOf(frames), ['1', '1.end']);
  assert.deepEqual(cursors, [undefined]);
});

void test('PD6: a refused first connect throws before any frame', async () => {
  const refused = new StreamFailure(404, WireType.enum.not_found, 'missing');
  const { connect } = scripted(refused);
  await assert.rejects(drain(readStream(connect, Frame, undefined)), refused);
});

void test('PD6: a frame that does not parse ends the iterable with an internal failure', async () => {
  const { connect } = scripted(sseResponse('data: not json\n\n'));
  await assert.rejects(
    drain(readStream(connect, Frame, undefined)),
    (err: unknown) =>
      err instanceof StreamFailure &&
      err.type === WireType.enum.internal &&
      err.status === 200,
  );
});

void test('PD6: a data frame with no id line cannot be ordered, so it fails the iterable', async () => {
  const { connect } = scripted(
    sseResponse(`data: ${JSON.stringify({ id: '1', kind: 'delta' })}\n\n`),
  );
  await assert.rejects(
    drain(readStream(connect, Frame, undefined)),
    (err: unknown) =>
      err instanceof StreamFailure && err.type === WireType.enum.internal,
  );
});

void test('PD6, V45: two channels hold two cursors; neither leaks into the other', async () => {
  const message = scripted(
    sseResponse(
      dataFrame('1'),
      dataFrame('2'),
      dataFrame('3'),
      dataFrame('4'),
      dataFrame('5'),
      dataFrame('6'),
      dataFrame('7'),
      dataFrame('8'),
      dataFrame('9'),
    ),
    sseResponse(dataFrame('10'), endOfStreamFrame('10.end')),
  );
  const conversation = scripted(
    sseResponse(dataFrame('1'), dataFrame('2'), endOfStreamFrame('2.end')),
  );
  const messageFrames = readStream(message.connect, Frame, undefined);
  const first = await messageFrames.next();
  assert.equal(first.done, false);
  const conversationFrames = await drain(
    readStream(conversation.connect, Frame, undefined),
  );
  assert.deepEqual(idsOf(conversationFrames), ['1', '2', '2.end']);
  assert.deepEqual(conversation.cursors, [undefined]);
  const rest = await drain(messageFrames);
  assert.deepEqual(idsOf(rest), [
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '10.end',
  ]);
  assert.deepEqual(message.cursors, [undefined, '9']);
});
