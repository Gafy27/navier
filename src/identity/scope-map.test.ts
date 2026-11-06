import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseOrgId } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';
import {
  AgentCreateAction,
  FsAction,
  ModelAction,
  parseScope,
  SandboxAction,
  ScopeResource,
  ToolAction,
} from './scope.ts';
import {
  agentVersionId,
  AuthzObjectType,
  authzObject,
  parseAgentVersionId,
  toAuthzCheck,
  toolKeyOf,
} from './scope-map.ts';

function org(raw: string): OrgId {
  const r = parseOrgId(raw);
  assert.ok(r.ok);
  return r.value;
}

function check(o: string, raw: string): ReturnType<typeof toAuthzCheck> {
  const s = parseScope(raw);
  assert.ok(s.ok);
  return toAuthzCheck(org(o), s.value);
}

const can = (action: string): string => `can_${action}`;

void test('toAuthzCheck puts the org inside the object id', () => {
  assert.deepEqual(check('org-a', 'tool:invoke:x'), {
    object: { type: ScopeResource.tool, id: 'org-a~x' },
    action: can(ToolAction.enum.invoke),
  });
  assert.equal(check('org-b', 'tool:invoke:x').object.id, 'org-b~x');
});

void test('toAuthzCheck percent-encodes fs ids', () => {
  assert.deepEqual(check('org-a', 'fs:write:/a b#c'), {
    object: { type: ScopeResource.fs, id: 'org-a~/a%20b%23c' },
    action: can(FsAction.enum.write),
  });
});

void test('id-less-sandbox', () => {
  assert.deepEqual(check('ga', 'sandbox:exec'), {
    object: { type: ScopeResource.sandbox, id: 'ga~org' },
    action: can(SandboxAction.enum.exec),
  });
});

void test('id-less-model', () => {
  assert.deepEqual(check('ga', 'model:admin'), {
    object: { type: ScopeResource.model, id: 'ga~org' },
    action: can(ModelAction.enum.admin),
  });
});

void test('id-less-agent-create', () => {
  assert.deepEqual(check('ga', 'agent_create:create'), {
    object: { type: ScopeResource.agent_create, id: 'ga~org' },
    action: can(AgentCreateAction.enum.create),
  });
});

void test('tool-key-org', () => {
  assert.deepEqual(check('ga', 'tool:invoke:org').object, {
    type: ScopeResource.tool,
    id: 'ga~org',
  });
});

void test('agent-id', () => {
  assert.deepEqual(check('ga', 'agent:write:a1').object, {
    type: ScopeResource.agent,
    id: 'ga~a1',
  });
});

void test('toAuthzCheck maps tool:enable to the tool object', () => {
  assert.deepEqual(check('ga', 'tool:enable:lookup'), {
    object: { type: ScopeResource.tool, id: 'ga~lookup' },
    action: can(ToolAction.enum.enable),
  });
});

void test('toAuthzCheck maps tool:register to the tool object', () => {
  assert.deepEqual(check('o1', 'tool:register:a.b'), {
    object: { type: ScopeResource.tool, id: 'o1~a.b' },
    action: can(ToolAction.enum.register),
  });
});

void test('agentVersionId builds the version id and parseAgentVersionId reads it back', () => {
  const o = org('o1');
  assert.equal(agentVersionId(o, 'a1', 3), 'o1~a1~3');
  assert.deepEqual(parseAgentVersionId(o, 'o1~a1~3'), {
    agentId: 'a1',
    version: 3,
  });
  assert.deepEqual(parseAgentVersionId(o, agentVersionId(o, 'a b', 2)), {
    agentId: 'a b',
    version: 2,
  });
});

void test('parseAgentVersionId refuses another org, another shape, and version 0 or a leading zero', () => {
  const o = org('o1');
  for (const bad of [
    'o2~a1~1',
    'o1~a1~0',
    'o1~a1~01',
    'o1~a1~x',
    'o1~a1',
    'o1~~1',
    'o1~a%zz~1',
    'o1~a%2fb~1',
  ]) {
    assert.equal(parseAgentVersionId(o, bad), undefined, bad);
  }
});

void test('a conversation object is conversation:<org>~<thread id>', () => {
  assert.deepEqual(authzObject(org('A'), AuthzObjectType.conversation, 't1'), {
    type: AuthzObjectType.conversation,
    id: 'A~t1',
  });
});

void test('V3: toolKeyOf reads a tool grant id', () => {
  assert.equal(
    toolKeyOf({ type: ScopeResource.tool, id: 'org-a~lookup' }),
    'lookup',
  );
  assert.equal(
    toolKeyOf({ type: ScopeResource.tool, id: 'org-a~a%20b' }),
    'a b',
  );
});

void test('V3: toolKeyOf refuses wrong org segment, malformed id, and non-tool type', () => {
  assert.equal(
    toolKeyOf({ type: ScopeResource.tool, id: 'org:bad~lookup' }),
    undefined,
  );
  for (const bad of ['org-a~', 'org-a', 'org-a~a1~2', 'org-a~a%zz', '']) {
    assert.equal(
      toolKeyOf({ type: ScopeResource.tool, id: bad }),
      undefined,
      bad,
    );
  }
  assert.equal(
    toolKeyOf({ type: AuthzObjectType.space, id: 'org-a~s1' }),
    undefined,
  );
});
