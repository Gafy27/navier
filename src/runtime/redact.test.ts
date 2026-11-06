import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { JsonValue } from '../index.ts';
import { redactEvent } from './redact.ts';

void test('V1: dropped keys are gone at every depth and the rest stays', () => {
  const event: JsonValue = {
    a: 1,
    instructions: 'x',
    nested: { tools: [], toolDefinitions: [], system: 's', keep: 2 },
    list: [{ system: 's', keep: 3 }, 'text', null],
  };
  assert.deepEqual(redactEvent(event), {
    a: 1,
    nested: { keep: 2 },
    list: [{ keep: 3 }, 'text', null],
  });
});

void test('V1: the input object is not mutated', () => {
  const event = { a: 1, instructions: 'x', nested: { tools: [1], keep: 2 } };
  const before = structuredClone(event);
  redactEvent(event);
  assert.deepEqual(event, before);
});

void test('V1: an event with no dropped key is returned deep-equal', () => {
  const event = { a: 1 };
  assert.deepEqual(redactEvent(event), event);
});

void test('V1: a value that is not an object passes through', () => {
  assert.equal(redactEvent('text'), 'text');
  assert.equal(redactEvent(null), null);
});

void test('V1: an own __proto__ key stays an own key', () => {
  const event = JSON.parse(
    '{"__proto__":{"keep":1},"system":"s"}',
  ) as JsonValue;
  const out = redactEvent(event);
  assert.deepEqual(Object.keys(out as object), ['__proto__']);
  assert.equal(Object.getPrototypeOf(out), Object.prototype);
});
