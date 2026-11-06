import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveStreamCursor } from './handler.ts';

void test('resolveStreamCursor merges header and query (D5)', () => {
  const headerOnly = resolveStreamCursor('3', undefined, 'message');
  assert.ok(headerOnly.ok);
  assert.deepEqual(headerOnly.value, {
    after: { seq: 3, end: false },
    requestId: '3',
  });
  const queryOnly = resolveStreamCursor(undefined, '3', 'message');
  assert.ok(queryOnly.ok);
  assert.deepEqual(queryOnly.value, {
    after: { seq: 3, end: false },
    requestId: '3',
  });
  assert.ok(resolveStreamCursor('3', '3', 'message').ok);
  assert.ok(!resolveStreamCursor('3', '4', 'message').ok);
});
