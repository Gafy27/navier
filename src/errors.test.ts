import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorCode, appError } from './errors.ts';

void test('ErrorCode has exactly the eight codes', () => {
  assert.deepEqual(Object.values(ErrorCode).sort(), [
    'aborted',
    'already_exists',
    'internal',
    'invalid_argument',
    'not_found',
    'permission_denied',
    'unauthenticated',
    'unavailable',
  ]);
});

void test('appError without a cause has no cause key', () => {
  const e = appError(ErrorCode.not_found, 'missing');
  assert.deepEqual(e, { code: 'not_found', message: 'missing' });
  assert.equal('cause' in e, false);
});

void test('appError with a cause keeps it', () => {
  const cause = new Error('boom');
  const e = appError(ErrorCode.internal, 'failed', cause);
  assert.equal(e.cause, cause);
});
