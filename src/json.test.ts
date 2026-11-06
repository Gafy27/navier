import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseJsonObject } from './json.ts';

const SUBJECT = 'ctx';
const SECRET_TEXT = 'secret-value';

void test('a plain JSON object is copied', () => {
  const raw = { a: [1, 'x', null], b: { c: true } };
  const parsed = parseJsonObject(raw, SUBJECT);
  assert.deepEqual(parsed.ok && parsed.value, raw);
});

void test('a bad value names the subject and path, never the value', () => {
  const cyclic: Record<string, unknown> = { text: SECRET_TEXT };
  cyclic['self'] = cyclic;
  for (const raw of [{ a: { b: [0, () => SECRET_TEXT] } }, cyclic]) {
    const parsed = parseJsonObject(raw, SUBJECT);
    if (parsed.ok) assert.fail('expected a refusal');
    assert.equal(parsed.error.code, 'invalid_argument');
    assert.ok(parsed.error.message.startsWith(`${SUBJECT}.`));
    assert.ok(!parsed.error.message.includes(SECRET_TEXT));
  }
  const notObject = parseJsonObject([], SUBJECT);
  assert.ok(!notObject.ok && notObject.error.message.startsWith(SUBJECT));
});
