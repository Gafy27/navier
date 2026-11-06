import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ActionStatus } from './actions.ts';
import { ActionReason } from './decide.ts';
import { STORED_ATTEMPT } from './step-contract.ts';
import { resolveAttempt } from './tool-call.ts';

const row = (status: string, attempt: number | null = null) => ({
  status,
  attempt,
});

void test('PD2: a runner number passes through', () => {
  assert.equal(resolveAttempt(3, [row(ActionStatus.created)]), 3);
});

void test('PD2: stored on a fresh action is 1', () => {
  assert.equal(resolveAttempt(STORED_ATTEMPT, [row(ActionStatus.created)]), 1);
});

void test('V2: stored after an interrupted running(1) is 2', () => {
  const rows = [row(ActionStatus.created), row(ActionStatus.running, 1)];
  assert.equal(resolveAttempt(STORED_ATTEMPT, rows), 2);
});

void test('PD2: null attempts are ignored and the max wins', () => {
  const rows = [
    row(ActionStatus.created),
    row(ActionStatus.running, 2),
    row(ActionStatus.running, 1),
    row(ActionStatus.blocked, null),
  ];
  assert.equal(resolveAttempt(STORED_ATTEMPT, rows), 3);
});

void test('V6: an approval created row starts a fresh budget', () => {
  const rows = [
    row(ActionStatus.created),
    row(ActionStatus.running, 1),
    row(ActionStatus.blocked, 1),
    {
      status: ActionStatus.created,
      attempt: null,
      reason: ActionReason.approved,
    },
  ];
  assert.equal(resolveAttempt(STORED_ATTEMPT, rows), 1);
});
