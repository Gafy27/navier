import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DenyReason } from './decision.ts';

void test('DenyReason is the closed set of four', () => {
  assert.deepEqual(Object.keys(DenyReason), [
    'no_grant',
    'not_visible',
    'unavailable',
    'invalid_scope',
  ]);
});
