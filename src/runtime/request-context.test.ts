import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorCode } from '../index.ts';
import type { Result } from '../index.ts';
import { parseOrgId } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';
import {
  ORG_ID_KEY,
  PRINCIPAL_ID_KEY,
  turnRequestContext,
} from './request-context.ts';

function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error('unexpected err');
  return r.value;
}

const org: OrgId = unwrap(parseOrgId('o1'));

void test('turnRequestContext merges identity and refuses reserved keys', () => {
  const merged = turnRequestContext({ tenant: 'acme' }, 'user:corp~p', org);
  assert.ok(merged.ok);
  assert.deepEqual(merged.value, {
    tenant: 'acme',
    [PRINCIPAL_ID_KEY]: 'user:corp~p',
    [ORG_ID_KEY]: org,
  });

  const reserved = turnRequestContext({ [ORG_ID_KEY]: 'other' }, 'p', org);
  assert.ok(!reserved.ok);
  assert.equal(reserved.error.code, ErrorCode.invalid_argument);
  assert.ok(reserved.error.message.includes(ORG_ID_KEY));
});
