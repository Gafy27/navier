import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createToolRegistry } from './tools.ts';
import type { ToolImplementation } from './tools.ts';

const impl = (
  key: string,
  implementationVersion: number,
): ToolImplementation => ({
  key,
  implementationVersion,
  execute: () => Promise.resolve(null),
});

void test('V9: a repeated key@version is refused; other versions of a key register', () => {
  const dup = createToolRegistry([impl('a.b', 1), impl('a.b', 1)]);
  assert.ok(!dup.ok);
  assert.equal(dup.error.code, 'already_exists');
  assert.match(dup.error.message, /a\.b@1/u);

  const both = createToolRegistry([impl('a.b', 1), impl('a.b', 2)]);
  assert.ok(both.ok);
  assert.equal(both.value.get('a.b', 1)?.implementationVersion, 1);
  assert.equal(both.value.get('a.b', 2)?.implementationVersion, 2);
  assert.equal(both.value.get('a.b', 3), undefined);
  assert.equal(both.value.get('c', 1), undefined);
});

void test('a malformed implementation is refused', () => {
  const bad = { key: '', implementationVersion: 1, execute: () => null };
  const r = createToolRegistry([bad as unknown as ToolImplementation]);
  assert.equal(!r.ok && r.error.code, 'invalid_argument');
});
