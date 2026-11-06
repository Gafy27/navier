import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyKey } from './index.ts';

void test('an unknown adapter is invalid_argument, as generate returns', async () => {
  const result = await verifyKey(
    { adapter: 'nope', baseUrl: 'http://127.0.0.1', apiKey: 'k' },
    new AbortController().signal,
  );
  assert.deepEqual(result, {
    ok: false,
    error: { code: 'invalid_argument', message: 'adapter: unknown' },
  });
});
