import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ok } from '../../index.ts';
import { parseOrgId } from '../../db/index.ts';
import {
  DenyReason,
  parsePrincipalId,
  PrincipalKind,
} from '../../identity/index.ts';
import type {
  Authz,
  AuthzAdmin,
  Caller,
  Decision,
  ObjectRef,
} from '../../identity/index.ts';
import { runCheck } from './check.ts';
import { toWire } from './errors.ts';
import { CheckKind, WireType } from './route-types.ts';
import type { Check } from './route-types.ts';
import { ScopeResource, SCOPE_ACTIONS } from './scope-names.ts';

function unwrap<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error('unexpected err');
  return r.value;
}

const orgA = unwrap(parseOrgId('A'));
/** The stub admin never reads the credential. */
const caller = {
  principal: {
    kind: PrincipalKind.person,
    id: unwrap(parsePrincipalId('user:ns~p')),
  },
} as unknown as Caller;
const authz = {} as unknown as Authz;

function adminAnswering(decision: Decision): {
  admin: AuthzAdmin;
  seen: { object: ObjectRef; action: string }[];
} {
  const seen: { object: ObjectRef; action: string }[] = [];
  const admin = {
    checkObjects: (_caller: Caller, _org: unknown, items: typeof seen) => {
      seen.push(...items);
      return Promise.resolve(ok([decision]));
    },
  } as unknown as AuthzAdmin;
  return { admin, seen };
}

const spaceCheck: Check = {
  kind: CheckKind.enum.object,
  type: 'space',
  idParams: ['org', 'space'],
  action: 'can_see',
};
const orgCheck: Check = {
  kind: CheckKind.enum.object,
  type: 'organization',
  idParams: ['org'],
  action: 'can_see',
};

void test('V7: the object arm checks <type>:<org>~<id>, and organization:<org>', async () => {
  const { admin, seen } = adminAnswering({ allow: true });
  const params = { org: 'A', space: 's1' };
  assert.ok(
    (await runCheck(spaceCheck, caller, orgA, params, authz, admin)).ok,
  );
  assert.ok((await runCheck(orgCheck, caller, orgA, params, authz, admin)).ok);
  assert.deepEqual(seen, [
    { object: { type: 'space', id: 'A~s1' }, action: 'can_see' },
    { object: { type: 'organization', id: 'A' }, action: 'can_see' },
  ]);
});

void test('V7: DENY is 403 forbidden and NOT_VISIBLE is 404 not_found', async () => {
  const params = { org: 'A', space: 's1' };
  const want: [DenyReason, number, WireType][] = [
    [DenyReason.no_grant, 403, WireType.enum.forbidden],
    [DenyReason.not_visible, 404, WireType.enum.not_found],
  ];
  for (const [reason, status, type] of want) {
    const { admin } = adminAnswering({ allow: false, reason });
    const r = await runCheck(spaceCheck, caller, orgA, params, authz, admin);
    assert.ok(!r.ok);
    const wire = toWire(r.error);
    assert.deepEqual([wire.status, wire.type], [status, type]);
  }
});

void test('V7: a missing id param or org is internal and sends no check', async () => {
  const { admin, seen } = adminAnswering({ allow: true });
  const missing = await runCheck(
    spaceCheck,
    caller,
    orgA,
    { org: 'A' },
    authz,
    admin,
  );
  const noOrg = await runCheck(
    spaceCheck,
    caller,
    undefined,
    { org: 'A', space: 's1' },
    authz,
    admin,
  );
  for (const r of [missing, noOrg]) {
    assert.ok(!r.ok);
    assert.equal(toWire(r.error).type, WireType.enum.internal);
  }
  assert.equal(seen.length, 0);
});

void test('C9: the scope arm appends a fixed id to the scope', async () => {
  const scopes: string[] = [];
  const recording = {
    check: (_org: unknown, _caller: Caller, scope: string) => {
      scopes.push(scope);
      return Promise.resolve(ok({ allow: true }));
    },
  } as unknown as Authz;
  const configAdmin: Check = {
    kind: CheckKind.enum.scope,
    resource: ScopeResource.enum.org,
    action: SCOPE_ACTIONS.org.enum.config,
    id: 'admin',
  };
  const { admin } = adminAnswering({ allow: true });
  const r = await runCheck(configAdmin, caller, orgA, {}, recording, admin);
  assert.ok(r.ok);
  assert.deepEqual(scopes, ['org:config:admin']);
});
