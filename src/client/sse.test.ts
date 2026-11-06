import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSse } from './sse.ts';
import type { SseFrame } from './sse.ts';

/** A body that delivers its chunks one at a time, so a line can split across reads. */
function bodyOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function framesOf(body: ReadableStream<Uint8Array>): Promise<SseFrame[]> {
  const out: SseFrame[] = [];
  for await (const frame of parseSse(body)) out.push(frame);
  return out;
}

void test('PD6: id and data are read; comment lines and unknown fields are ignored', async () => {
  const frames = await framesOf(
    bodyOf(
      ': open\n\n',
      'id: 1\ndata: {"a":1}\n\n',
      ': keepalive\nevent: ignored\nretry: 5\nid: 2\ndata: {"a":2}\n\n',
    ),
  );
  assert.deepEqual(frames, [
    { id: '1', data: '{"a":1}' },
    { id: '2', data: '{"a":2}' },
  ]);
});

void test('PD6: a line split across reads is joined; CRLF ends a line', async () => {
  const frames = await framesOf(
    bodyOf('id: 7\r\nda', 'ta: {"x"', ':1}\r\n\r\n'),
  );
  assert.deepEqual(frames, [{ id: '7', data: '{"x":1}' }]);
});

void test('PD6: several data lines join with a newline; the id is per block', async () => {
  const frames = await framesOf(
    bodyOf('id: 3\ndata: one\ndata: two\n\ndata: three\n\n'),
  );
  assert.deepEqual(frames, [
    { id: '3', data: 'one\ntwo' },
    { id: undefined, data: 'three' },
  ]);
});

void test('PD6: a block with no data line is not a frame; an unterminated last block is dropped', async () => {
  const frames = await framesOf(
    bodyOf('id: 4\n\ndata: kept\n\nid: 5\ndata: cut'),
  );
  assert.deepEqual(frames, [{ id: undefined, data: 'kept' }]);
});

void test('PD6: a reader that stops early cancels the body', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode('data: a\n\n'));
    },
    cancel() {
      cancelled = true;
    },
  });
  for await (const frame of parseSse(body)) {
    assert.equal(frame.data, 'a');
    break;
  }
  assert.equal(cancelled, true);
});
