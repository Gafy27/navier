import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { parseOrgId } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';
import {
  DenyReason,
  formatScope,
  parsePrincipalId,
  PrincipalKind,
} from '../identity/index.ts';
import type { Authz, Caller, Decision, Scope } from '../identity/index.ts';
import { invokeScope, requireToolInvoke } from './edge.ts';

function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error('unexpected err');
  return r.value;
}

const org: OrgId = unwrap(parseOrgId('org-a'));
// The stub never reads the credential, so the caller carries only its principal.
const caller = {
  principal: {
    kind: PrincipalKind.person,
    id: unwrap(parsePrincipalId('user:ns~pat')),
  },
} as Caller;

const allow: Decision = { allow: true };
const deny = (reason: DenyReason): Decision => ({ allow: false, reason });

/** An authz whose `checkMany` answers each scope from `answers` (allow when absent). */
function authzAnswering(
  answers: Record<string, Decision> | Result<Decision[]>,
): { readonly authz: Authz; readonly calls: string[][] } {
  const calls: string[][] = [];
  const authz = {
    checkMany: (_org: OrgId, _caller: Caller, scopes: readonly Scope[]) => {
      const texts = scopes.map(formatScope);
      calls.push(texts);
      if ('ok' in answers) return Promise.resolve(answers);
      return Promise.resolve(ok(texts.map((s) => answers[s] ?? allow)));
    },
  } as unknown as Authz;
  return { authz, calls };
}

void test('invokeScope: the tool:invoke check string', () => {
  assert.equal(invokeScope('a.b'), 'tool:invoke:a.b');
});

void test('V15: duplicates are checked once, in version order, in one call', async () => {
  const stub = authzAnswering({});
  const result = await requireToolInvoke(stub.authz, org, caller, [
    't1',
    't1',
    't2',
  ]);
  assert.deepEqual(result, ok(undefined));
  assert.deepEqual(stub.calls, [['tool:invoke:t1', 'tool:invoke:t2']]);
});

void test('V15: an empty list sends nothing', async () => {
  const stub = authzAnswering({});
  assert.deepEqual(
    await requireToolInvoke(stub.authz, org, caller, []),
    ok(undefined),
  );
  assert.deepEqual(stub.calls, []);
});

void test('V14/V15: the first deny in version order is permission_denied', async () => {
  const stub = authzAnswering({
    'tool:invoke:t2': deny(DenyReason.no_grant),
    'tool:invoke:t3': deny(DenyReason.not_visible),
  });
  const result = await requireToolInvoke(stub.authz, org, caller, [
    't1',
    't2',
    't3',
  ]);
  assert.deepEqual(
    result,
    err(appError(ErrorCode.permission_denied, 'missing tool:invoke:t2')),
  );
});

void test('an unavailable answer is unavailable, never a missing grant', async () => {
  const stub = authzAnswering({
    'tool:invoke:t1': deny(DenyReason.no_grant),
    'tool:invoke:t2': deny(DenyReason.unavailable),
  });
  const result = await requireToolInvoke(stub.authz, org, caller, ['t1', 't2']);
  assert.deepEqual(
    result,
    err(appError(ErrorCode.unavailable, 'authz-api unavailable')),
  );
});

void test('a short answer fails closed as unavailable', async () => {
  const stub = authzAnswering(ok([allow]));
  const result = await requireToolInvoke(stub.authz, org, caller, ['t1', 't2']);
  assert.ok(!result.ok);
  assert.equal(result.error.code, ErrorCode.unavailable);
});

void test('V15: an err from checkMany passes through unchanged', async () => {
  const refused = err(
    appError(ErrorCode.internal, 'authz-api refused the check batch'),
  );
  const stub = authzAnswering(refused);
  assert.deepEqual(
    await requireToolInvoke(stub.authz, org, caller, ['t1']),
    refused,
  );
});
