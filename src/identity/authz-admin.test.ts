import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Code, ConnectError } from '@connectrpc/connect';
import { ErrorCode } from '../index.ts';
import { failureCode, FailureOp } from './authz.ts';

const NEW_CASES = [
  [
    Code.InvalidArgument,
    ErrorCode.invalid_argument,
    ErrorCode.invalid_argument,
  ],
  [Code.AlreadyExists, ErrorCode.already_exists, ErrorCode.unavailable],
  [Code.Aborted, ErrorCode.aborted, ErrorCode.unavailable],
  [Code.NotFound, ErrorCode.not_found, ErrorCode.permission_denied],
] as const;

void test('C8: AlreadyExists and Aborted keep their codes on write only', () => {
  for (const [code, write, check] of NEW_CASES) {
    const e = new ConnectError('refused', code);
    assert.equal(failureCode(e, true, FailureOp.enum.write), write);
    assert.equal(failureCode(e, true, FailureOp.enum.check), check);
  }
});
