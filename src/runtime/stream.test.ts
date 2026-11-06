import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCursor } from './stream.ts';

const CHANNELS = ['message', 'conversation'] as const;

const codeOf = (r: { ok: boolean; error?: { code: string } }) =>
  r.ok ? undefined : r.error?.code;

void test('V8: a decimal seq parses on both channels; absent is undefined', () => {
  for (const channel of CHANNELS) {
    assert.deepEqual(parseCursor('5', channel), {
      ok: true,
      value: { seq: 5, end: false },
    });
    assert.deepEqual(parseCursor('0', channel), {
      ok: true,
      value: { seq: 0, end: false },
    });
    assert.deepEqual(parseCursor(undefined, channel), {
      ok: true,
      value: undefined,
    });
  }
});

void test('V8: .end parses on the message channel only', () => {
  assert.deepEqual(parseCursor('5.end', 'message'), {
    ok: true,
    value: { seq: 5, end: true },
  });
  assert.equal(
    codeOf(parseCursor('5.end', 'conversation')),
    'invalid_argument',
  );
});

void test('V8: anything else is refused on both channels', () => {
  for (const channel of CHANNELS) {
    for (const raw of [
      '-1',
      '5.0',
      '05x',
      '5.END',
      '05',
      '',
      ' 5',
      '1e3',
      '99999999999999999999',
    ]) {
      assert.equal(codeOf(parseCursor(raw, channel)), 'invalid_argument', raw);
    }
  }
});
