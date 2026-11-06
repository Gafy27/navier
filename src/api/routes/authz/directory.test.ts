import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../../../index.ts';
import { parseOrgId } from '../../../db/index.ts';
import { AuthzConfigSchema } from '../../../identity/index.ts';
import { directoryObject, DirectoryType } from './directory.ts';

function unwrap<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error('unexpected err');
  return r.value;
}

void test('a directory row is organization:<org>, or <type>:<org>~<id>', () => {
  const org = unwrap(parseOrgId('A'));
  assert.deepEqual(directoryObject(org, DirectoryType.enum.organization, 'A'), {
    type: 'organization',
    id: 'A',
  });
  assert.deepEqual(directoryObject(org, DirectoryType.enum.space, 's1'), {
    type: 'space',
    id: 'A~s1',
  });
});

void test('V13a: AUTHZ_CHECK_MAX_ITEMS is required and has no fallback', () => {
  const loaded = loadConfig(AuthzConfigSchema, {
    AUTHZ_API_URL: 'https://authz.test',
    AUTHZ_TIMEOUT_MS: '300',
    AUTHZ_TOKEN_URL: 'https://idp.test/token',
    AUTHZ_CLIENT_ID: 'svc',
    AUTHZ_CLIENT_SECRET_FILE: '/run/secret',
  });
  assert.equal(loaded.ok, false);
});
