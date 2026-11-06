import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stepPlan } from './step-plan.ts';
import type { StepAction } from './step-plan.ts';

function act(
  id: string,
  status: StepAction['status'],
  approved = false,
): StepAction {
  return { id, status, approved };
}

// --- V7: stepPlan ---

void test('all created, no blocked: run both, not waiting', () => {
  const result = stepPlan([act('a', 'created'), act('b', 'created')]);
  assert.deepEqual(result, { run: ['a', 'b'], waiting: false });
});

void test('one blocked, one created without approval: run none, waiting', () => {
  const result = stepPlan([act('a', 'blocked'), act('b', 'created')]);
  assert.deepEqual(result, { run: [], waiting: true });
});

void test('blocked + approved created + unapproved created: run only approved', () => {
  const result = stepPlan([
    act('a', 'blocked'),
    act('b', 'created', true),
    act('c', 'created'),
  ]);
  assert.deepEqual(result, { run: ['b'], waiting: true });
});

void test('errored + created, no blocked: run only created', () => {
  const result = stepPlan([act('a', 'errored'), act('b', 'created')]);
  assert.deepEqual(result, { run: ['b'], waiting: false });
});

void test('approved running + blocked: run only running, waiting', () => {
  const result = stepPlan([act('a', 'running', true), act('b', 'blocked')]);
  assert.deepEqual(result, { run: ['a'], waiting: true });
});

void test('succeeded + cancelled: run none, not waiting', () => {
  const result = stepPlan([act('a', 'succeeded'), act('b', 'cancelled')]);
  assert.deepEqual(result, { run: [], waiting: false });
});

void test('input order is preserved in run list', () => {
  const result = stepPlan([
    act('z', 'created', true),
    act('a', 'blocked'),
    act('m', 'created', true),
  ]);
  assert.deepEqual(result.run, ['z', 'm']);
});
