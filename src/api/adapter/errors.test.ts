import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import { appError, createLogger, ErrorCode } from '../../index.ts';
import { DenyReason } from '../../identity/index.ts';
import { WireType } from './route-types.ts';
import { errorResponse, fromDecision, toWire } from './errors.ts';

void test('L3: each DenyReason maps to its wire status and type', () => {
  const want: Record<DenyReason, [number, WireType]> = {
    not_visible: [404, WireType.enum.not_found],
    no_grant: [403, WireType.enum.forbidden],
    unavailable: [503, WireType.enum.unavailable],
    invalid_scope: [500, WireType.enum.internal],
  };
  for (const reason of Object.values(DenyReason)) {
    const wire = toWire(fromDecision({ allow: false, reason }));
    assert.deepEqual([wire.status, wire.type], want[reason], reason);
  }
});

/** Keys pino adds to every line. */
const PINO_KEYS = ['level', 'time', 'pid', 'hostname', 'msg'];

void test('L4: the body is exactly the envelope and no cause reaches the body or the log', async () => {
  const lines: string[] = [];
  const log = createLogger(
    'debug',
    new Writable({
      write(chunk: Buffer, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    }),
  );
  for (const code of [ErrorCode.not_found, ErrorCode.internal]) {
    const res = errorResponse(appError(code, 'm', new Error('CAUSE-1')), log, {
      route: 'getThing',
    });
    const text = await res.text();
    assert.equal(text.includes('CAUSE-1'), false);
    const body = JSON.parse(text) as { error: Record<string, unknown> };
    assert.deepEqual(Object.keys(body), ['error']);
    assert.deepEqual(Object.keys(body.error).sort(), ['message', 'type']);
    assert.equal(body.error['message'], 'm');
    assert.equal(res.headers.get('content-type'), 'application/json');
  }
  assert.equal(lines.length, 2);
  for (const line of lines) {
    assert.equal(line.includes('CAUSE-1'), false);
    const allowed = [
      ...PINO_KEYS,
      'route',
      'org',
      'principalKind',
      'type',
      'status',
    ];
    for (const key of Object.keys(JSON.parse(line) as object)) {
      assert.ok(allowed.includes(key), key);
    }
  }
});
