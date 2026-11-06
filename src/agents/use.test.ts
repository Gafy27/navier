import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { parseOrgId } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';
import { parsePrincipalId, PrincipalKind } from '../identity/index.ts';
import type {
  AgentUse,
  AgentUseQuery,
  Authz,
  Caller,
} from '../identity/index.ts';
import { requireAgentUse, usableAgents } from './use.ts';

function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error('unexpected err');
  return r.value;
}

const org: OrgId = unwrap(parseOrgId('org-a'));
// The stubs below never read the credential, so the caller carries only its principal.
const caller = {
  principal: {
    kind: PrincipalKind.person,
    id: unwrap(parsePrincipalId('user:ns~pat')),
  },
} as Caller;

/** An authz whose `checkAgentUse` answers each query from `kinds`; unknown agents are not visible. */
function authzAnswering(kinds: Record<string, AgentUse>): {
  readonly authz: Authz;
  readonly calls: (readonly AgentUseQuery[])[];
} {
  const calls: (readonly AgentUseQuery[])[] = [];
  const authz = {
    checkAgentUse: (
      _caller: Caller,
      _org: OrgId,
      queries: readonly AgentUseQuery[],
    ) => {
      calls.push(queries);
      return Promise.resolve(
        ok(queries.map((q) => kinds[q.agentId] ?? { kind: 'not_visible' })),
      );
    },
  } as unknown as Authz;
  return { authz, calls };
}

void test('requireAgentUse: open and direct pass, not visible is not_found', async () => {
  const open = authzAnswering({ a: { kind: 'open', version: 3 } });
  assert.deepEqual(
    await requireAgentUse(open.authz, org, caller, 'a', 3),
    ok(undefined),
  );
  const direct = authzAnswering({ a: { kind: 'direct' } });
  assert.deepEqual(
    await requireAgentUse(direct.authz, org, caller, 'a', 3),
    ok(undefined),
  );
  const hidden = authzAnswering({});
  const refused = await requireAgentUse(hidden.authz, org, caller, 'a', 3);
  assert.deepEqual(
    refused,
    err(appError(ErrorCode.not_found, 'agent not found')),
  );
});

void test('requireAgentUse: names the pinned version to authz', async () => {
  const seen = authzAnswering({ a: { kind: 'direct' } });
  await requireAgentUse(seen.authz, org, caller, 'a', 7);
  assert.deepEqual(seen.calls, [[{ agentId: 'a', version: 7 }]]);
});

void test('requireAgentUse: an authz error passes through unchanged', async () => {
  const failing = {
    checkAgentUse: () =>
      Promise.resolve(
        err(appError(ErrorCode.unavailable, 'authz-api unavailable')),
      ),
  } as unknown as Authz;
  const failed = await requireAgentUse(failing, org, caller, 'a', 1);
  assert.deepEqual(
    failed,
    err(appError(ErrorCode.unavailable, 'authz-api unavailable')),
  );
});

void test('usableAgents: open and direct ids only, from one call with no versions', async () => {
  const stub = authzAnswering({
    a: { kind: 'open', version: 1 },
    b: { kind: 'direct' },
    c: { kind: 'not_visible' },
  });
  const usable = unwrap(
    await usableAgents(stub.authz, org, caller, ['a', 'b', 'c', 'd']),
  );
  assert.deepEqual([...usable].sort(), ['a', 'b']);
  assert.deepEqual(stub.calls, [
    [{ agentId: 'a' }, { agentId: 'b' }, { agentId: 'c' }, { agentId: 'd' }],
  ]);
});

void test('usableAgents: an authz error passes through', async () => {
  const failing = {
    checkAgentUse: () =>
      Promise.resolve(
        err(appError(ErrorCode.unauthenticated, 'authentication failed')),
      ),
  } as unknown as Authz;
  const failed = await usableAgents(failing, org, caller, ['a']);
  assert.deepEqual(
    failed,
    err(appError(ErrorCode.unauthenticated, 'authentication failed')),
  );
});
