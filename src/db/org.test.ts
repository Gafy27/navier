import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseOrgId } from './org.ts';

void test('parseOrgId accepts a plain non-empty string', () => {
  const r = parseOrgId('org-a');
  assert.equal(r.ok && r.value, 'org-a');
});

void test('parseOrgId accepts 1 and 64 characters', () => {
  assert.equal(parseOrgId('a').ok, true);
  assert.equal(parseOrgId('a'.repeat(64)).ok, true);
});

void test('parseOrgId rejects reserved characters and bad lengths', () => {
  for (const bad of ['org:a', 'org#a', 'org~a', 'org a', 'a'.repeat(65)]) {
    const r = parseOrgId(bad);
    assert.equal(!r.ok && r.error.code, 'invalid_argument');
  }
});

void test('parseOrgId rejects empty, padded, and non-string input', () => {
  for (const bad of ['', ' org', 'org ', '\torg', 7, null, undefined]) {
    const r = parseOrgId(bad);
    assert.equal(!r.ok && r.error.code, 'invalid_argument');
  }
});
