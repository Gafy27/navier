import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { test } from 'node:test';
import { appError, ErrorCode } from '../index.ts';
import { SdkError } from './errors.ts';
import {
  ORG_ID_KEY,
  PRINCIPAL_ID_KEY,
  RequestContext,
} from './request-context.ts';

const SECRET_TEXT = 'secret-value';

function refuses(run: () => void, key: string): void {
  assert.throws(run, (e: unknown) => {
    assert.ok(e instanceof SdkError);
    assert.equal(e.code, ErrorCode.invalid_argument);
    assert.ok(e.message.includes(key));
    assert.ok(!e.message.includes(SECRET_TEXT));
    return true;
  });
}

void test('V7: set keeps JSON and toJSON returns an equal copy', () => {
  const ctx = new RequestContext();
  const nested = { a: [1, 'x', null] };
  ctx.set('n', 1);
  ctx.set('o', nested);
  assert.deepEqual(ctx.toJSON(), { n: 1, o: nested });
  assert.notEqual(ctx.toJSON()['o'], nested);
  assert.equal(ctx.has('n'), true);
  assert.equal(ctx.delete('n'), true);
  assert.equal(ctx.get('n'), undefined);
});

void test('V7: set refuses a function, a Date, and a cycle, naming the key', () => {
  const ctx = new RequestContext();
  refuses(() => {
    ctx.set('f', () => SECRET_TEXT);
  }, 'f');
  refuses(() => {
    ctx.set('d', new Date());
  }, 'd');
  const cyclic: Record<string, unknown> = { text: SECRET_TEXT };
  cyclic['self'] = cyclic;
  refuses(() => {
    ctx.set('c', cyclic);
  }, 'c');
  assert.equal(ctx.has('c'), false);
});

void test('V7: the constructor checks its initial object', () => {
  refuses(() => new RequestContext({ bad: () => SECRET_TEXT }), 'bad');
});

void test('V7: the identity keys are the reserved names', () => {
  assert.equal(PRINCIPAL_ID_KEY, 'sdk__principalId');
  assert.equal(ORG_ID_KEY, 'sdk__orgId');
});

void test('V8: SdkError keeps the code and message and drops the cause', () => {
  const cause = new Error(SECRET_TEXT);
  const error = new SdkError(
    appError(ErrorCode.permission_denied, 'missing scope', cause),
  );
  assert.equal(error.code, ErrorCode.permission_denied);
  assert.equal(error.message, 'missing scope');
  assert.equal('cause' in error, false);
  assert.ok(!inspect(error).includes(SECRET_TEXT));
});
