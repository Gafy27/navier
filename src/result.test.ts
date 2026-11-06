import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appError, ErrorCode } from './errors.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';

void test('ok carries a value', () => {
  assert.deepEqual(ok(1), { ok: true, value: 1 });
});

void test('err carries an error', () => {
  const e = appError(ErrorCode.aborted, 'x');
  assert.deepEqual(err(e), { ok: false, error: e });
});

void test('ok and err fit a declared Result without a cast', () => {
  const f = (good: boolean): Result<number> =>
    good ? ok(1) : err(appError(ErrorCode.internal, 'x'));
  assert.equal(f(true).ok, true);
  assert.equal(f(false).ok, false);
});
