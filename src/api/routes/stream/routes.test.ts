import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TERMINAL_STATUSES } from '../../../runtime/index.ts';
import type { StreamEvent } from '../../../runtime/index.ts';
import { streamEventSchema, TerminalStatusWire } from './routes.ts';
import type { StreamEventWire } from './routes.ts';

/** Both directions must typecheck: the wire type and the runtime type describe the same frames. */
const runtimeToWire = (e: StreamEvent): StreamEventWire => e;
const wireToRuntime = (e: StreamEventWire): StreamEvent => e;

void test('the terminal status enum equals the runtime list', () => {
  assert.deepEqual(
    [...TerminalStatusWire.options].sort(),
    [...TERMINAL_STATUSES].sort(),
  );
});

void test('runtime and wire frames are assignable both ways, and a frame parses', () => {
  const frame: StreamEvent = { id: '8.end', kind: 'end-of-stream' };
  assert.equal(runtimeToWire(frame).kind, 'end-of-stream');
  const back = wireToRuntime({ id: '3', kind: 'step', data: { n: 1 } });
  assert.equal(back.kind, 'step');
  assert.ok(streamEventSchema.safeParse(frame).success);
});

void test('a blocked frame round-trips and stays assignable both ways', () => {
  const frame: StreamEvent = {
    id: '4',
    kind: 'blocked',
    actions: [
      { actionId: 'a', kind: 'approval', canRemember: true },
      { actionId: 'b', kind: 'authentication', canRemember: false },
      { actionId: 'c', kind: 'retry', canRemember: false },
    ],
  };
  const parsed = streamEventSchema.parse(frame);
  assert.deepEqual(parsed, frame);
  assert.equal(runtimeToWire(frame).kind, 'blocked');
  assert.equal(wireToRuntime(parsed).kind, 'blocked');
});

void test('a frame with an unknown kind or an extra key does not parse', () => {
  assert.ok(
    !streamEventSchema.safeParse({ id: '1', kind: 'conversation' }).success,
  );
  assert.ok(
    !streamEventSchema.safeParse({
      id: '1',
      kind: 'end-of-stream',
      extra: true,
    }).success,
  );
});
